-- =============================================================================
-- MJ Nexus — Phase 2
--   1. 投稿の追跡コード（追跡リンクで問い合わせと投稿を紐づける）
--   2. 施策・AI提案の受け皿（docs/decision-support-design.md）
--   3. SNS指標ビュー（スナップショット単位・投稿単位）
-- 既存テーブルへの変更は NULL 可の列追加のみ。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 追跡コード
-- -----------------------------------------------------------------------------
alter table public.social_posts
  add column tracking_code text check (tracking_code ~ '^[a-z0-9]{4,16}$');
create unique index social_posts_tracking_code_uniq
  on public.social_posts (organization_id, tracking_code)
  where tracking_code is not null;

-- -----------------------------------------------------------------------------
-- 2. 施策・AI提案
-- -----------------------------------------------------------------------------
create type public.initiative_status as enum (
  'proposed', 'rejected', 'planned', 'in_progress', 'measuring', 'evaluated'
);
create type public.initiative_outcome as enum ('improved', 'no_change', 'worsened', 'inconclusive');
create type public.recommendation_status as enum ('open', 'adopted', 'dismissed');

create table public.ai_recommendations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  analysis_log_id  uuid references public.ai_analysis_logs (id) on delete set null,
  user_id          uuid references auth.users (id) on delete set null,
  title            text not null check (char_length(title) between 1 and 200),
  issue            text,              -- 経営課題（解釈）
  hypothesis       text,              -- 改善仮説（仮説）
  proposed_action  text not null,     -- 推奨施策
  target_kpi_id    text,              -- shared/kpi-catalog.json の id
  expected_change  text,
  evidence         jsonb not null default '[]'::jsonb,  -- 提案時点のツール結果（期間・n・計算式・限界）
  limitations      text[] not null default '{}',
  status           public.recommendation_status not null default 'open',
  dismissed_reason text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id)
);
create index ai_recommendations_org_time_idx on public.ai_recommendations (organization_id, created_at desc);

create table public.initiatives (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  recommendation_id      uuid,
  title                  text not null check (char_length(title) between 1 and 200),
  hypothesis             text,
  target_kpi_id          text,
  formula_version        int,      -- 評価時に同じ計算式を使うため
  baseline_value         numeric,
  baseline_period_start  date,
  baseline_period_end    date,
  target_value           numeric,
  starts_on              date,
  ends_on                date,
  evaluation_window_days int check (evaluation_window_days between 1 and 365),
  status                 public.initiative_status not null default 'proposed',
  result_value           numeric,
  result_n               int check (result_n >= 0),
  outcome                public.initiative_outcome,
  retrospective          text,
  evaluated_at           timestamptz,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, recommendation_id)
    references public.ai_recommendations (organization_id, id) on delete set null (recommendation_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on),
  check ((status = 'evaluated') = (outcome is not null))
);
create index initiatives_org_status_idx on public.initiatives (organization_id, status);

create table public.initiative_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  initiative_id   uuid not null,
  occurred_on     date not null,
  description     text not null check (char_length(description) between 1 and 2000),
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  foreign key (organization_id, initiative_id)
    references public.initiatives (organization_id, id) on delete cascade
);
create index initiative_events_initiative_idx on public.initiative_events (initiative_id, occurred_on);

alter table public.content_ideas add column initiative_id uuid;
alter table public.content_ideas
  add constraint content_ideas_initiative_fkey foreign key (organization_id, initiative_id)
  references public.initiatives (organization_id, id) on delete set null (initiative_id);
alter table public.campaigns add column initiative_id uuid;
alter table public.campaigns
  add constraint campaigns_initiative_fkey foreign key (organization_id, initiative_id)
  references public.initiatives (organization_id, id) on delete set null (initiative_id);

create trigger set_updated_at before update on public.ai_recommendations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.initiatives
  for each row execute function private.set_updated_at();

-- RLS
grant select, insert, update, delete on public.ai_recommendations, public.initiatives, public.initiative_events to authenticated;
revoke all on public.ai_recommendations, public.initiatives, public.initiative_events from anon;
alter table public.ai_recommendations enable row level security;
alter table public.ai_recommendations force row level security;
alter table public.initiatives enable row level security;
alter table public.initiatives force row level security;
alter table public.initiative_events enable row level security;
alter table public.initiative_events force row level security;

-- 施策: 全メンバー閲覧 / editor以上が編集
create policy initiatives_select on public.initiatives for select to authenticated
  using (private.has_role(organization_id, 'viewer'));
create policy initiatives_insert on public.initiatives for insert to authenticated
  with check (private.has_role(organization_id, 'editor'));
create policy initiatives_update on public.initiatives for update to authenticated
  using (private.has_role(organization_id, 'editor')) with check (private.has_role(organization_id, 'editor'));
create policy initiatives_delete on public.initiatives for delete to authenticated
  using (private.has_role(organization_id, 'admin'));

create policy initiative_events_select on public.initiative_events for select to authenticated
  using (private.has_role(organization_id, 'viewer'));
create policy initiative_events_insert on public.initiative_events for insert to authenticated
  with check (private.has_role(organization_id, 'editor'));
create policy initiative_events_update on public.initiative_events for update to authenticated
  using (private.has_role(organization_id, 'editor')) with check (private.has_role(organization_id, 'editor'));
create policy initiative_events_delete on public.initiative_events for delete to authenticated
  using (private.has_role(organization_id, 'editor'));

-- AI提案: 根拠に財務データを含みうるため、作成者本人か admin 以上のみ閲覧
-- （AIはユーザーの権限で分析するので、作成者が見られないデータは根拠に入らない）
create policy ai_recommendations_select on public.ai_recommendations for select to authenticated
  using (private.is_member(organization_id)
         and (user_id = (select auth.uid()) or private.has_role(organization_id, 'admin')));
create policy ai_recommendations_insert on public.ai_recommendations for insert to authenticated
  with check (private.has_role(organization_id, 'editor') and user_id = (select auth.uid()));
create policy ai_recommendations_update on public.ai_recommendations for update to authenticated
  using (private.is_member(organization_id)
         and (user_id = (select auth.uid()) or private.has_role(organization_id, 'admin')))
  with check (private.is_member(organization_id)
         and (user_id = (select auth.uid()) or private.has_role(organization_id, 'admin')));

-- -----------------------------------------------------------------------------
-- 3. SNS指標ビュー
--   投稿の率は「同じ記録時点」の値どうしで計算する。
--   （24時間後のいいねと7日後のリーチを割ると、時点がずれて率が歪むため）
--   率の分子・分母のどれかが実測でない、または分母が0なら NULL（計算不能）。
-- -----------------------------------------------------------------------------
create view public.social_post_snapshot_kpis
with (security_invoker = true) as
with pivot as (
  select
    s.organization_id,
    s.post_id,
    s.id as snapshot_id,
    s.recorded_at,
    s.source,
    max(v.value)        filter (where v.metric = 'views')          as views,
    max(v.status::text) filter (where v.metric = 'views')          as views_status,
    max(v.value)        filter (where v.metric = 'reach')          as reach,
    max(v.status::text) filter (where v.metric = 'reach')          as reach_status,
    max(v.value)        filter (where v.metric = 'likes')          as likes,
    max(v.status::text) filter (where v.metric = 'likes')          as likes_status,
    max(v.value)        filter (where v.metric = 'comments')       as comments,
    max(v.status::text) filter (where v.metric = 'comments')       as comments_status,
    max(v.value)        filter (where v.metric = 'saves')          as saves,
    max(v.status::text) filter (where v.metric = 'saves')          as saves_status,
    max(v.value)        filter (where v.metric = 'shares')         as shares,
    max(v.status::text) filter (where v.metric = 'shares')         as shares_status,
    max(v.value)        filter (where v.metric = 'profile_visits') as profile_visits,
    max(v.status::text) filter (where v.metric = 'profile_visits') as profile_visits_status,
    max(v.value)        filter (where v.metric = 'follows_gained') as follows_gained,
    max(v.status::text) filter (where v.metric = 'follows_gained') as follows_gained_status,
    max(v.value)        filter (where v.metric = 'link_clicks')    as link_clicks,
    max(v.status::text) filter (where v.metric = 'link_clicks')    as link_clicks_status
  from public.social_post_metrics s
  left join public.social_post_metric_values v on v.snapshot_id = s.id
  group by s.organization_id, s.post_id, s.id, s.recorded_at, s.source
)
select
  p.*,
  round(extract(epoch from (p.recorded_at - sp.published_at)) / 3600.0, 1) as hours_since_publish,
  -- エンゲージメント数: 4項目すべて実測のときだけ
  case when p.likes is not null and p.comments is not null and p.saves is not null and p.shares is not null
       then p.likes + p.comments + p.saves + p.shares end as engagements,
  case when p.likes is not null and p.comments is not null and p.saves is not null and p.shares is not null
            and p.reach > 0
       then (p.likes + p.comments + p.saves + p.shares)::numeric / p.reach end as engagement_rate_reach,
  case when p.likes is not null and p.comments is not null and p.saves is not null and p.shares is not null
            and p.views > 0
       then (p.likes + p.comments + p.saves + p.shares)::numeric / p.views end as engagement_rate_views,
  case when p.saves is not null and p.reach > 0 then p.saves::numeric / p.reach end as save_rate,
  case when p.shares is not null and p.reach > 0 then p.shares::numeric / p.reach end as share_rate,
  case when p.profile_visits is not null and p.reach > 0 then p.profile_visits::numeric / p.reach end as profile_visit_rate,
  case when p.link_clicks is not null and p.profile_visits > 0 then p.link_clicks::numeric / p.profile_visits end as link_click_rate,
  case when p.reach is not null and sp.production_minutes > 0
       then p.reach::numeric / (sp.production_minutes / 60.0) end as reach_per_production_hour
from pivot p
join public.social_posts sp on sp.id = p.post_id;

-- 投稿 × 最新の記録時点（未記録の投稿も含む: 記録がなければ指標は NULL）
create view public.social_post_kpis
with (security_invoker = true) as
with latest as (
  select k.*, row_number() over (partition by k.post_id order by k.recorded_at desc) as rn,
         count(*) over (partition by k.post_id) as snapshot_count
  from public.social_post_snapshot_kpis k
)
select
  sp.id as post_id,
  sp.organization_id,
  sp.account_id,
  a.platform,
  a.handle as account_handle,
  sp.title,
  sp.theme_id,
  t.name as theme_name,
  sp.format,
  sp.cta,
  sp.status,
  sp.published_at,
  -- 公開時間帯（日本時間）
  extract(hour from (sp.published_at at time zone 'Asia/Tokyo'))::int as published_hour_jst,
  extract(isodow from (sp.published_at at time zone 'Asia/Tokyo'))::int as published_dow_jst,
  sp.production_minutes,
  sp.content_idea_id,
  sp.tracking_code,
  coalesce(l.snapshot_count, 0) as snapshot_count,
  l.snapshot_id, l.recorded_at, l.hours_since_publish,
  l.views, l.views_status, l.reach, l.reach_status, l.likes, l.likes_status,
  l.comments, l.comments_status, l.saves, l.saves_status, l.shares, l.shares_status,
  l.profile_visits, l.profile_visits_status, l.follows_gained, l.follows_gained_status,
  l.link_clicks, l.link_clicks_status,
  l.engagements, l.engagement_rate_reach, l.engagement_rate_views, l.save_rate, l.share_rate,
  l.profile_visit_rate, l.link_click_rate, l.reach_per_production_hour
from public.social_posts sp
join public.social_accounts a on a.id = sp.account_id
left join public.content_themes t on t.id = sp.theme_id
left join latest l on l.post_id = sp.id and l.rn = 1;

grant select on public.social_post_snapshot_kpis, public.social_post_kpis to authenticated;
revoke all on public.social_post_snapshot_kpis, public.social_post_kpis from anon;

-- -----------------------------------------------------------------------------
-- 4. 実績スナップショットの一括保存（スナップショット + 指標値を1トランザクションで）
--   security invoker: 呼び出したユーザーのRLSで書き込む
-- -----------------------------------------------------------------------------
create or replace function public.record_post_metrics(
  p_post_id uuid,
  p_recorded_at timestamptz,
  p_values jsonb,            -- [{"metric":"views","status":"measured","value":120}, ...]
  p_source public.data_source default 'manual',
  p_note text default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid;
  v_snapshot uuid;
  v_item jsonb;
begin
  select organization_id into v_org from public.social_posts where id = p_post_id;
  if v_org is null then
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  if p_recorded_at > now() + interval '1 hour' then
    raise exception 'recorded_at is in the future' using errcode = '22023';
  end if;
  if jsonb_typeof(p_values) <> 'array' or jsonb_array_length(p_values) = 0 then
    raise exception 'at least one metric is required' using errcode = '22023';
  end if;

  insert into public.social_post_metrics (organization_id, post_id, recorded_at, source, note, created_by)
  values (v_org, p_post_id, p_recorded_at, p_source, p_note, (select auth.uid()))
  returning id into v_snapshot;

  for v_item in select * from jsonb_array_elements(p_values) loop
    insert into public.social_post_metric_values (organization_id, snapshot_id, metric, status, value)
    values (
      v_org, v_snapshot,
      (v_item ->> 'metric')::public.social_metric,
      (v_item ->> 'status')::public.metric_status,
      (v_item ->> 'value')::bigint
    );
  end loop;
  return v_snapshot;
end;
$$;
revoke all on function public.record_post_metrics(uuid, timestamptz, jsonb, public.data_source, text) from public, anon;
grant execute on function public.record_post_metrics(uuid, timestamptz, jsonb, public.data_source, text) to authenticated;
