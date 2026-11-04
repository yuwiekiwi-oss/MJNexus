-- =============================================================================
-- Phase 3 のテスト: 入会記録RPCと集客ファネル
--   10 / 20 のユーザー・組織を前提とする（A=org1 owner, B=viewer, D=editor, C=org2 owner）
--   他のテストと混ざらないよう 2026年9月 の日付だけを使う
-- =============================================================================
\set ON_ERROR_STOP 1

set role authenticated;
select test.act_as('00000000-0000-0000-0000-00000000000a');  -- owner

select v as org from test.ids where k = 'org1' \gset
select id as ch_ig from public.marketing_channels where organization_id = :'org' and code = 'instagram' \gset
select id as ch_tt from public.marketing_channels where organization_id = :'org' and code = 'tiktok' \gset
select v as post from test.ids where k = 'post' \gset
select id as course from public.courses where organization_id = :'org' and name = 'スタンダード' \gset

-- i1: Instagram・追跡リンク経由・体験参加・入会（9/1 → 9/15 = 14日）
insert into public.inquiries (organization_id, inquired_at, channel_id, attribution, social_post_id)
values (:'org', '2026-09-01 10:00+09', :'ch_ig', 'tracked_link', :'post') returning id as i1 \gset
insert into public.trial_lessons (organization_id, inquiry_id, booked_at, scheduled_at, status, attended_at)
values (:'org', :'i1', '2026-09-02 10:00+09', '2026-09-08 16:00+09', 'attended', '2026-09-08 17:00+09');
select public.record_enrollment(:'i1', 'はなこ', 4::smallint, :'course', '2026-09-15') as e1 \gset

-- i2: Instagram・自己申告・体験申込のあとキャンセル
insert into public.inquiries (organization_id, inquired_at, channel_id, attribution)
values (:'org', '2026-09-05 10:00+09', :'ch_ig', 'self_reported') returning id as i2 \gset
insert into public.trial_lessons (organization_id, inquiry_id, booked_at, scheduled_at, status, cancelled_at)
values (:'org', :'i2', '2026-09-05 11:00+09', '2026-09-12 16:00+09', 'cancelled', '2026-09-10 09:00+09');

-- i3: TikTok・不明・体験なし・失注
insert into public.inquiries (organization_id, inquired_at, channel_id, attribution, closed_lost_at, closed_lost_reason)
values (:'org', '2026-09-07 10:00+09', :'ch_tt', 'unknown', '2026-09-20 10:00+09', '日程が合わない') returning id as i3 \gset

-- i4: チャネル未設定・欠席→振替で参加（体験2行でも1と数える）・入会（9/10 → 9/20 = 10日）
insert into public.inquiries (organization_id, inquired_at, attribution)
values (:'org', '2026-09-10 10:00+09', 'staff_inferred') returning id as i4 \gset
insert into public.trial_lessons (organization_id, inquiry_id, booked_at, scheduled_at, status)
values (:'org', :'i4', '2026-09-10 11:00+09', '2026-09-13 16:00+09', 'no_show');
insert into public.trial_lessons (organization_id, inquiry_id, booked_at, scheduled_at, status, attended_at)
values (:'org', :'i4', '2026-09-13 18:00+09', '2026-09-17 16:00+09', 'attended', '2026-09-17 17:00+09');
select public.record_enrollment(:'i4', 'じろう', 6::smallint, :'course', '2026-09-20', 10000) as e4 \gset

-- 10/1 00:30 JST（UTCでは9/30 15:30）の問い合わせは9月に入らない
insert into public.inquiries (organization_id, inquired_at) values (:'org', '2026-10-01 00:30+09');

-- 入会RPC: 生徒と契約を同時に作成し、月謝は指定値 or コースの月謝
select test.assert_eq((select monthly_fee_jpy from public.enrollments where id = :'e1'), 12000, 'fee defaults to course fee');
select test.assert_eq((select monthly_fee_jpy from public.enrollments where id = :'e4'), 10000, 'fee override');
select test.assert_eq((select count(*) from public.students s join public.enrollments e on e.student_id = s.id
                       where e.id = :'e1' and s.inquiry_id = :'i1' and s.joined_on = '2026-09-15'), 1, 'student created with enrollment');
select test.expect_error(format($$select public.record_enrollment(%L, 'x', 4::smallint, %L, '2026-09-30')$$, :'i1', :'course'),
  '23505', 'second enrollment for same inquiry rejected');
select test.expect_error(format($$select public.record_enrollment(%L, 'x', 4::smallint, %L, '2026-09-01')$$, :'i2', :'course'),
  '22023', 'enrolled_on before inquiry rejected');
select test.assert_eq((select count(*) from public.students where display_name = 'x'), 0, 'failed enrollment left no student');
select test.expect_error(format($$select public.record_enrollment(%L, 'x', 4::smallint, gen_random_uuid(), '2026-09-30')$$, :'i2'),
  'P0002', 'unknown course rejected');

-- 費用: Instagram 6000、TikTok 2000（9月）、家賃は含めない、10月分は含めない
insert into public.expense_transactions (organization_id, occurred_on, category, amount_jpy, channel_id) values
  (:'org', '2026-09-03', 'ad_spend', 4000, :'ch_ig'),
  (:'org', '2026-09-20', 'content_production', 2000, :'ch_ig'),
  (:'org', '2026-09-10', 'ad_spend', 2000, :'ch_tt'),
  (:'org', '2026-10-01', 'ad_spend', 9999, :'ch_tt');
insert into public.expense_transactions (organization_id, occurred_on, category, amount_jpy)
values (:'org', '2026-09-01', 'rent', 50000);

-- ---------------------------------------------------------------------------
-- 全体
-- ---------------------------------------------------------------------------
create temp table f_total as select * from public.marketing_funnel(:'org', '2026-09-01', '2026-09-30');
select test.assert_eq((select count(*) from f_total), 1, 'total has one row');
select test.assert_eq((select inquiries from f_total), 4, 'inquiries (JST boundary)');
select test.assert_eq((select tracked_inquiries from f_total), 1, 'tracked inquiries');
select test.assert_eq((select trial_booked from f_total), 3, 'trial booked counts inquiries, not rows');
select test.assert_eq((select trial_attended from f_total), 2, 'trial attended');
select test.assert_eq((select enrolled from f_total), 2, 'enrolled');
select test.assert_eq((select closed_lost from f_total), 1, 'closed lost');
select test.assert_eq((select (median_days_to_enroll * 10)::bigint from f_total), 120, 'median days to enroll = 12');
select test.assert_eq((select cost_jpy from f_total), 8000, 'marketing cost total (excludes rent and other months)');
select test.assert_eq((select count(*) from f_total where cost_visible), 1, 'owner sees cost');

-- ---------------------------------------------------------------------------
-- チャネル別
-- ---------------------------------------------------------------------------
create temp table f_ch as select * from public.marketing_funnel(:'org', '2026-09-01', '2026-09-30', 'channel');
select test.assert_eq((select inquiries from f_ch where group_key = :'ch_ig'), 2, 'instagram inquiries');
select test.assert_eq((select enrolled from f_ch where group_key = :'ch_ig'), 1, 'instagram enrolled');
select test.assert_eq((select cost_jpy from f_ch where group_key = :'ch_ig'), 6000, 'instagram cost');
select test.assert_eq((select cost_jpy from f_ch where group_key = :'ch_tt'), 2000, 'tiktok cost');
select test.assert_eq((select count(*) from f_ch where group_key = '_none' and group_label = 'チャネル未設定' and cost_jpy is null), 1,
                      'no-channel group, cost null = not recorded');
select test.assert_eq((select sum(inquiries) from f_ch)::bigint, 4, 'channel groups sum to total');

-- 紐づけ確度別 / プラットフォーム別
create temp table f_attr as select * from public.marketing_funnel(:'org', '2026-09-01', '2026-09-30', 'attribution');
select test.assert_eq((select inquiries from f_attr where group_key = 'tracked_link'), 1, 'attribution tracked_link');
select test.assert_eq((select count(*) from f_attr where cost_jpy is not null), 0, 'cost only for total/channel');
create temp table f_pf as select * from public.marketing_funnel(:'org', '2026-09-01', '2026-09-30', 'platform');
select test.assert_eq((select inquiries from f_pf where group_key = 'instagram'), 1, 'platform via linked post');
select test.assert_eq((select inquiries from f_pf where group_key = '_none'), 3, 'unlinked posts grouped as _none');

-- ---------------------------------------------------------------------------
-- 権限
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000d');  -- editor
create temp table f_ed as select * from public.marketing_funnel(:'org', '2026-09-01', '2026-09-30');
select test.assert_eq((select enrolled from f_ed), 2, 'editor sees enrollments');
select test.assert_eq((select count(*) from f_ed where cost_jpy is null and not cost_visible), 1, 'editor: cost hidden (not zero)');
select test.expect_error(format($$select public.record_enrollment(%L, 'x', 4::smallint, %L, '2026-09-30')$$, :'i2', :'course'),
  '42501', 'editor cannot record enrollment');

select test.act_as('00000000-0000-0000-0000-00000000000b');  -- viewer
select test.expect_error(format($$select * from public.marketing_funnel(%L, '2026-09-01', '2026-09-30')$$, :'org'),
  '42501', 'viewer cannot run funnel');

select test.act_as('00000000-0000-0000-0000-00000000000c');  -- 他組織
select test.expect_error(format($$select * from public.marketing_funnel(%L, '2026-09-01', '2026-09-30')$$, :'org'),
  '42501', 'other org cannot run funnel');
select test.expect_error(format($$select public.record_enrollment(%L, 'x', 4::smallint, %L, '2026-09-30')$$, :'i2', :'course'),
  'P0002', 'other org cannot see inquiry');

-- ---------------------------------------------------------------------------
-- 進捗一覧ビュー
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.assert_eq((select count(*) from public.inquiry_pipeline where id = :'i1' and stage = 'enrolled' and enrolled_on = '2026-09-15'), 1, 'pipeline: enrolled');
select test.assert_eq((select count(*) from public.inquiry_pipeline where id = :'i2' and stage = 'trial_missed'), 1, 'pipeline: cancelled trial only');
select test.assert_eq((select count(*) from public.inquiry_pipeline where id = :'i3' and stage = 'closed_lost'), 1, 'pipeline: closed lost');
select test.assert_eq((select trial_count from public.inquiry_pipeline where id = :'i4'), 2, 'pipeline: trial rows');
select test.assert_eq((select count(*) from public.inquiry_pipeline where id = :'i1' and channel_name = 'Instagram（オーガニック）' and post_title is not null), 1, 'pipeline: joined names');
select test.act_as('00000000-0000-0000-0000-00000000000b');  -- viewer
select test.assert_eq((select count(*) from public.inquiry_pipeline where id = :'i1' and stage is null and enrolled_on is null and not enrollment_visible), 1,
                      'pipeline: viewer gets null stage (not "not enrolled")');
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.assert_eq((select count(*) from public.inquiry_pipeline where id = :'i1'), 0, 'pipeline: other org cannot see');

select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.expect_error(format($$select * from public.marketing_funnel(%L, '2026-09-01', '2026-09-30', 'bogus')$$, :'org'),
  '22023', 'invalid group');
select test.expect_error(format($$select * from public.marketing_funnel(%L, '2026-09-30', '2026-09-01')$$, :'org'),
  '22023', 'invalid period');

reset role;
set role anon;
select test.expect_error(format($$select * from public.marketing_funnel(%L, '2026-09-01', '2026-09-30')$$, :'org'),
  '42501', 'anon denied');
reset role;

\echo phase3_marketing: all assertions passed
