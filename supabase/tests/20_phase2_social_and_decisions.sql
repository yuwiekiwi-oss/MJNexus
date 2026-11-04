-- =============================================================================
-- Phase 2 のテスト（10_rls_and_constraints.sql のユーザー・組織を前提とする）
--   A=org1 owner, B=org1 viewer, D=org1 editor, C=org2 owner
-- =============================================================================
\set ON_ERROR_STOP 1

set role authenticated;
select test.act_as('00000000-0000-0000-0000-00000000000d');  -- editor

-- 新しい投稿（TikTok、追跡コード付き、制作120分）
insert into public.social_accounts (organization_id, platform, handle)
select v, 'tiktok', 'mj_tiktok' from test.ids where k = 'org1' returning id as tt \gset
insert into public.social_posts (organization_id, account_id, title, format, status, published_at, production_minutes, tracking_code)
select v, :'tt', 'TikTokテスト', 'short_video', 'published', '2026-11-01 12:00+09', 120, 'tt01'
from test.ids where k = 'org1' returning id as p2 \gset

-- 追跡コードは組織内で一意
select test.expect_error(
  format($$insert into public.social_posts (organization_id, account_id, title, format, tracking_code)
           values (%L, %L, 'dup', 'reel', 'tt01')$$, (select v from test.ids where k = 'org1'), :'tt'),
  '23505', 'tracking_code unique');
select test.expect_error(
  format($$insert into public.social_posts (organization_id, account_id, title, format, tracking_code)
           values (%L, %L, 'bad', 'reel', 'NG!')$$, (select v from test.ids where k = 'org1'), :'tt'),
  '23514', 'tracking_code format');

-- record_post_metrics: 1回目（24時間後）
select public.record_post_metrics(
  :'p2', '2026-11-02 12:00+09',
  '[{"metric":"views","status":"measured","value":1000},
    {"metric":"reach","status":"measured","value":800},
    {"metric":"likes","status":"measured","value":40},
    {"metric":"comments","status":"measured","value":5},
    {"metric":"saves","status":"measured","value":10},
    {"metric":"shares","status":"measured","value":5},
    {"metric":"profile_visits","status":"measured","value":20},
    {"metric":"link_clicks","status":"unsupported","value":null}]'::jsonb) as s1 \gset

-- 2回目（72時間後）: saves は未取得
select public.record_post_metrics(
  :'p2', '2026-11-04 12:00+09',
  '[{"metric":"views","status":"measured","value":3000},
    {"metric":"reach","status":"measured","value":2000},
    {"metric":"likes","status":"measured","value":100},
    {"metric":"comments","status":"measured","value":10},
    {"metric":"saves","status":"not_collected","value":null},
    {"metric":"shares","status":"measured","value":20}]'::jsonb);

-- 不正な指標が1つでもあれば、スナップショットごと保存されない（原子性）
select test.expect_error(
  format($$select public.record_post_metrics(%L, '2026-11-03 12:00+09',
           '[{"metric":"views","status":"measured","value":1},{"metric":"views_typo","status":"measured","value":1}]')$$, :'p2'),
  '22P02', 'invalid metric rejected');
select test.assert_eq((select count(*) from public.social_post_metrics where post_id = :'p2'), 2, 'failed call left no snapshot');
select test.expect_error(
  format($$select public.record_post_metrics(%L, '2026-11-03 12:00+09', '[]')$$, :'p2'),
  '22023', 'empty metrics rejected');
select test.expect_error(
  format($$select public.record_post_metrics(%L, now() + interval '2 days', '[{"metric":"views","status":"measured","value":1}]')$$, :'p2'),
  '22023', 'future recorded_at rejected');

-- スナップショット単位の率（24時間後）: (40+5+10+5)/800 = 0.075
select test.assert_eq((select round(engagement_rate_reach * 1000)::bigint from public.social_post_snapshot_kpis
                       where snapshot_id = :'s1'), 75, 'engagement rate (reach) at 24h');
select test.assert_eq((select round(engagement_rate_views * 1000)::bigint from public.social_post_snapshot_kpis
                       where snapshot_id = :'s1'), 60, 'engagement rate (views) at 24h');
select test.assert_eq((select round(profile_visit_rate * 1000)::bigint from public.social_post_snapshot_kpis
                       where snapshot_id = :'s1'), 25, 'profile visit rate');
-- リンククリックが非対応なら、率は計算不能（0ではない）
select test.assert_eq((select count(*) from public.social_post_snapshot_kpis
                       where snapshot_id = :'s1' and link_click_rate is null and link_clicks_status = 'unsupported'), 1,
                      'link click rate null when unsupported');
select test.assert_eq((select hours_since_publish::bigint from public.social_post_snapshot_kpis where snapshot_id = :'s1'), 24, 'hours since publish');

-- 投稿単位（最新=72時間後）: saves が未取得なのでエンゲージメント率は計算不能
select test.assert_eq((select snapshot_count from public.social_post_kpis where post_id = :'p2'), 2, 'snapshot count');
select test.assert_eq((select views from public.social_post_kpis where post_id = :'p2'), 3000, 'latest views');
select test.assert_eq((select count(*) from public.social_post_kpis where post_id = :'p2' and engagement_rate_reach is null), 1,
                      'engagement rate null when a component is not collected');
select test.assert_eq((select round(share_rate * 1000)::bigint from public.social_post_kpis where post_id = :'p2'), 10, 'share rate latest');
-- 制作効率: リーチ2000 ÷ 2時間 = 1000
select test.assert_eq((select reach_per_production_hour::bigint from public.social_post_kpis where post_id = :'p2'), 1000, 'reach per production hour');
select test.assert_eq((select published_hour_jst from public.social_post_kpis where post_id = :'p2'), 12, 'published hour JST');

-- 記録のない投稿も一覧に出る（指標は NULL = 未記録）
insert into public.social_posts (organization_id, account_id, title, format)
select v, :'tt', '未記録の下書き', 'short_video' from test.ids where k = 'org1' returning id as p3 \gset
select test.assert_eq((select snapshot_count from public.social_post_kpis where post_id = :'p3'), 0, 'unrecorded post listed');

-- viewer は実績を記録できない
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.expect_error(
  format($$select public.record_post_metrics(%L, '2026-11-03 12:00+09', '[{"metric":"views","status":"measured","value":1}]')$$, :'p2'),
  '42501', 'viewer cannot record metrics');

-- 他組織からは投稿が見えないので記録できない
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.expect_error(
  format($$select public.record_post_metrics(%L, '2026-11-03 12:00+09', '[{"metric":"views","status":"measured","value":1}]')$$, :'p2'),
  'P0002', 'other org cannot record metrics');
select test.assert_eq((select count(*) from public.social_post_kpis), 0, 'other org sees no kpis');

-- -----------------------------------------------------------------------------
-- 施策・AI提案
-- -----------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000d');  -- editor
insert into public.ai_recommendations (organization_id, user_id, title, proposed_action, target_kpi_id, evidence)
select v, '00000000-0000-0000-0000-00000000000d', '保存率の高いテーマを増やす', 'チュートリアル投稿を週2本に', 'save_rate',
       '[{"kpi_id":"save_rate","n":3,"verification":"insufficient_sample"}]'
from test.ids where k = 'org1' returning id as rec \gset

insert into public.initiatives (organization_id, recommendation_id, title, target_kpi_id, status)
select v, :'rec', 'チュートリアル投稿を増やす', 'save_rate', 'planned' from test.ids where k = 'org1'
returning id as ini \gset
insert into public.initiative_events (organization_id, initiative_id, occurred_on, description)
select v, :'ini', '2026-11-05', 'チュートリアル動画を1本追加' from test.ids where k = 'org1';

-- 評価済みにするなら評価結果が必須
select test.expect_error(
  format($$update public.initiatives set status = 'evaluated' where id = %L$$, :'ini'),
  '23514', 'evaluated requires outcome');
update public.initiatives set status = 'evaluated', outcome = 'inconclusive', evaluated_at = now() where id = :'ini';

-- 企画を施策に紐づけられる
insert into public.content_ideas (organization_id, title, initiative_id)
select v, '施策由来の企画', :'ini' from test.ids where k = 'org1';

-- viewer: 施策は見えるが、他人のAI提案は見えない
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.assert_eq((select count(*) from public.initiatives), 1, 'viewer reads initiatives');
select test.assert_eq((select count(*) from public.ai_recommendations), 0, 'viewer cannot read others recommendations');
select test.expect_error(
  format($$insert into public.initiatives (organization_id, title) values (%L, 'x')$$, (select v from test.ids where k = 'org1')),
  '42501', 'viewer cannot create initiatives');

-- editor は他人名義でAI提案を作れない
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.expect_error(
  format($$insert into public.ai_recommendations (organization_id, user_id, title, proposed_action)
           values (%L, '00000000-0000-0000-0000-00000000000a', 'x', 'y')$$, (select v from test.ids where k = 'org1')),
  '42501', 'cannot impersonate recommendation author');

-- owner は組織内のAI提案をすべて見られる
select test.act_as('00000000-0000-0000-0000-00000000000a');
select test.assert_eq((select count(*) from public.ai_recommendations), 1, 'admin reads all recommendations');

-- 他組織からは見えない
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.assert_eq((select count(*) from public.initiatives), 0, 'other org cannot read initiatives');

reset role;
set role anon;
select test.expect_error($$select * from public.initiatives$$, '42501', 'anon denied initiatives');
select test.expect_error($$select * from public.social_post_kpis$$, '42501', 'anon denied kpis');
reset role;

\echo 'phase2_social_and_decisions: all assertions passed'
