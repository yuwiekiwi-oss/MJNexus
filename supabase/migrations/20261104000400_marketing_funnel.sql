-- =============================================================================
-- MJ Nexus — 集客ファネル
--   記録した問い合わせ・体験・入会・費用を数える（経営指標）。
--   定義: docs/kpi-definitions.md / shared/kpi-catalog.json
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 入会の記録（生徒 + 契約を1トランザクションで作成）
--   security invoker: 呼び出したユーザーのRLSで書き込む（students/enrollments は admin 以上）
-- -----------------------------------------------------------------------------
create or replace function public.record_enrollment(
  p_inquiry_id uuid,
  p_display_name text,
  p_grade smallint,
  p_course_id uuid,
  p_enrolled_on date,
  p_monthly_fee_jpy bigint default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_inquired date;
  v_fee bigint;
  v_student uuid;
  v_enrollment uuid;
begin
  select organization_id, (inquired_at at time zone 'Asia/Tokyo')::date
    into v_org, v_inquired
  from public.inquiries where id = p_inquiry_id;
  if v_org is null then
    raise exception 'inquiry not found' using errcode = 'P0002';
  end if;
  if p_enrolled_on < v_inquired then
    raise exception 'enrolled_on is before the inquiry date' using errcode = '22023';
  end if;
  select coalesce(p_monthly_fee_jpy, c.monthly_fee_jpy) into v_fee
  from public.courses c where c.id = p_course_id and c.organization_id = v_org;
  if v_fee is null then
    raise exception 'course not found' using errcode = 'P0002';
  end if;

  insert into public.students (organization_id, display_name, grade, inquiry_id, joined_on)
  values (v_org, p_display_name, p_grade, p_inquiry_id, p_enrolled_on)
  returning id into v_student;

  insert into public.enrollments (organization_id, student_id, course_id, inquiry_id, enrolled_on, monthly_fee_jpy)
  values (v_org, v_student, p_course_id, p_inquiry_id, p_enrolled_on, v_fee)
  returning id into v_enrollment;

  return v_enrollment;
end;
$$;
revoke all on function public.record_enrollment(uuid, text, smallint, uuid, date, bigint) from public, anon;
grant execute on function public.record_enrollment(uuid, text, smallint, uuid, date, bigint) to authenticated;

-- -----------------------------------------------------------------------------
-- 集客ファネル（問い合わせ月コホート）
--
--   対象: 期間内（日本時間の日付）に問い合わせた人
--   各段階はその問い合わせが「その後」到達したかどうかで数える
--     trial_booked   … 体験の記録が1件以上ある（振替で複数あっても1と数える）
--     trial_attended … status='attended' の体験が1件以上ある
--     enrolled       … その問い合わせに紐づく入会がある（1問い合わせ1入会はユニーク制約で保証）
--   率の計算は画面側で行わず、件数をそのまま返す（分母が0なら画面で「計算不能」）
--
--   p_group: total / channel / attribution
--
--   権限: editor 以上（viewer は入会データを読めず、入会0件と誤表示されるため拒否）
--   費用: admin 以上のみ（それ以外は NULL = 権限なし）。費用の記録がなければ NULL = 未記録
-- -----------------------------------------------------------------------------
create or replace function public.marketing_funnel(
  p_org uuid,
  p_from date,
  p_to date,
  p_group text default 'total'
) returns table (
  group_key text,
  group_label text,
  inquiries bigint,
  tracked_inquiries bigint,
  trial_booked bigint,
  trial_attended bigint,
  enrolled bigint,
  closed_lost bigint,
  open_recent bigint,
  median_days_to_enroll numeric,
  cost_jpy bigint,
  cost_visible boolean
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if not private.has_role(p_org, 'editor') then
    raise exception 'editor role required' using errcode = '42501';
  end if;
  if p_group not in ('total', 'channel', 'attribution') then
    raise exception 'invalid group: %', p_group using errcode = '22023';
  end if;
  if p_to < p_from or p_to - p_from > 731 then
    raise exception 'invalid period' using errcode = '22023';
  end if;

  return query
  with inq as (
    select
      i.id,
      i.channel_id,
      i.attribution,
      i.inquired_at,
      i.closed_lost_at
    from public.inquiries i
    where i.organization_id = p_org
      and (i.inquired_at at time zone 'Asia/Tokyo')::date between p_from and p_to
  ),
  facts as (
    select
      inq.*,
      case p_group
        when 'total' then 'all'
        when 'channel' then coalesce(inq.channel_id::text, '_none')
        when 'attribution' then inq.attribution::text
      end as gkey,
      exists (select 1 from public.trial_lessons t where t.inquiry_id = inq.id) as booked,
      exists (select 1 from public.trial_lessons t where t.inquiry_id = inq.id and t.status = 'attended') as attended,
      e.enrolled_on,
      e.enrolled_on - (inq.inquired_at at time zone 'Asia/Tokyo')::date as days_to_enroll
    from inq
    left join public.enrollments e on e.inquiry_id = inq.id
  ),
  agg as (
    select
      f.gkey,
      count(*)                                                    as n_inquiries,
      count(*) filter (where f.attribution = 'tracked_link')      as n_tracked,
      count(*) filter (where f.booked)                            as n_booked,
      count(*) filter (where f.attended)                          as n_attended,
      count(*) filter (where f.enrolled_on is not null)           as n_enrolled,
      count(*) filter (where f.closed_lost_at is not null and f.enrolled_on is null) as n_lost,
      count(*) filter (where f.enrolled_on is null and f.closed_lost_at is null
                         and f.inquired_at > now() - interval '30 days') as n_open_recent,
      percentile_cont(0.5) within group (order by f.days_to_enroll)
        filter (where f.days_to_enroll is not null)               as med_days
    from facts f
    group by f.gkey
  ),
  costs as (
    select
      case p_group when 'total' then 'all' when 'channel' then coalesce(mc.channel_id::text, '_none') end as gkey,
      sum(mc.amount_jpy)::bigint as amount
    from public.marketing_costs mc
    where mc.organization_id = p_org
      and mc.occurred_on between p_from and p_to
      and p_group in ('total', 'channel')
    group by 1
  ),
  keys as (
    select a.gkey from agg a
    union
    select c.gkey from costs c   -- 費用はあるが問い合わせ0件のチャネルも表示する
  )
  select
    k.gkey,
    case
      when p_group = 'total' then '全体'
      when k.gkey = '_none' then 'チャネル未設定'
      when p_group = 'channel' then (select ch.name from public.marketing_channels ch where ch.id::text = k.gkey)
      else k.gkey
    end,
    coalesce(a.n_inquiries, 0),
    coalesce(a.n_tracked, 0),
    coalesce(a.n_booked, 0),
    coalesce(a.n_attended, 0),
    coalesce(a.n_enrolled, 0),
    coalesce(a.n_lost, 0),
    coalesce(a.n_open_recent, 0),
    round(a.med_days::numeric, 1),
    c.amount,
    private.has_role(p_org, 'admin')
  from keys k
  left join agg a on a.gkey = k.gkey
  left join costs c on c.gkey = k.gkey
  order by coalesce(a.n_inquiries, 0) desc, k.gkey;
end;
$$;
revoke all on function public.marketing_funnel(uuid, date, date, text) from public, anon;
grant execute on function public.marketing_funnel(uuid, date, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 問い合わせの進捗一覧（画面の一覧・詳細用）
--   stage: new / trial_booked / trial_attended / trial_missed / enrolled / closed_lost
--     trial_missed … 体験はあるが、すべてキャンセルか欠席（振替待ちなど）
--   入会は editor 以上しか読めない（生徒の情報のため）。viewer には stage と入会日を
--   NULL（= 権限なし）で返し、「未入会」と誤表示しない。
-- -----------------------------------------------------------------------------
create view public.inquiry_pipeline
with (security_invoker = true) as
select
  i.id,
  i.organization_id,
  i.inquired_at,
  i.channel_id,
  ch.name  as channel_name,
  i.campaign_id,
  cp.name  as campaign_name,
  i.attribution,
  i.utm_source,
  i.utm_medium,
  i.utm_campaign,
  i.utm_content,
  i.child_grade,
  i.closed_lost_at,
  i.closed_lost_reason,
  i.notes,
  coalesce(t.trial_count, 0)    as trial_count,
  coalesce(t.attended_count, 0) as attended_count,
  t.next_trial_at,
  private.has_role(i.organization_id, 'editor') as enrollment_visible,
  e.enrolled_on,
  case
    when not private.has_role(i.organization_id, 'editor') then null
    when e.id is not null then 'enrolled'
    when i.closed_lost_at is not null then 'closed_lost'
    when coalesce(t.attended_count, 0) > 0 then 'trial_attended'
    when coalesce(t.booked_count, 0) > 0 then 'trial_booked'
    when coalesce(t.trial_count, 0) > 0 then 'trial_missed'
    else 'new'
  end as stage
from public.inquiries i
left join public.marketing_channels ch on ch.id = i.channel_id
left join public.campaigns cp on cp.id = i.campaign_id
left join public.enrollments e on e.inquiry_id = i.id
left join lateral (
  select
    count(*)                                    as trial_count,
    count(*) filter (where tl.status = 'attended') as attended_count,
    count(*) filter (where tl.status = 'booked')   as booked_count,
    min(tl.scheduled_at) filter (where tl.status = 'booked') as next_trial_at
  from public.trial_lessons tl
  where tl.inquiry_id = i.id
) t on true;

grant select on public.inquiry_pipeline to authenticated;
revoke all on public.inquiry_pipeline from anon;
