-- =============================================================================
-- RLS・制約のテスト（scripts/test-db.sh から実行）
--   失敗すると例外で停止し、スクリプトが非0で終了する。
-- =============================================================================
\set ON_ERROR_STOP 1

create schema test;
grant usage on schema test to public;

-- 期待どおりのエラー(SQLSTATE)が起きることを確認する
create function test.expect_error(stmt text, expected_state text, label text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    if sqlstate = expected_state then
      return;
    end if;
    raise exception '[%] expected SQLSTATE %, got % (%)', label, expected_state, sqlstate, sqlerrm;
  end;
  raise exception '[%] expected SQLSTATE % but statement succeeded', label, expected_state;
end $$;

create function test.assert_eq(actual bigint, expected bigint, label text)
returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception '[%] expected %, got %', label, expected, actual;
  end if;
end $$;

create function test.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
end $$;

grant execute on all functions in schema test to public;

create table test.ids (k text primary key, v uuid);
grant all on test.ids to public;

-- テストユーザー: A=org1 owner, B=org1 viewer, D=org1 editor, C=org2 owner
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.invalid'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test.invalid'),
  ('00000000-0000-0000-0000-00000000000d', 'd@test.invalid');

select test.assert_eq((select count(*) from public.profiles), 4, 'profiles auto-created');

-- ---------------------------------------------------------------------------
-- 組織作成と初期マスタ
-- ---------------------------------------------------------------------------
set role authenticated;
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into test.ids values ('org1', public.create_organization('MJ テスト校'));
select test.assert_eq((select count(*) from public.content_themes), 6, 'default themes');
select test.assert_eq((select count(*) from public.marketing_channels), 5, 'default channels');

insert into public.organization_members (organization_id, user_id, role)
select v, '00000000-0000-0000-0000-00000000000b', 'viewer' from test.ids where k = 'org1';
insert into public.organization_members (organization_id, user_id, role)
select v, '00000000-0000-0000-0000-00000000000d', 'editor' from test.ids where k = 'org1';

-- 最後の owner は削除できない
select test.expect_error(
  $$delete from public.organization_members where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'P0001', 'last owner protected');

select test.act_as('00000000-0000-0000-0000-00000000000c');
insert into test.ids values ('org2', public.create_organization('別の組織'));
select test.assert_eq((select count(*) from public.organizations), 1, 'org2 owner sees only own org');
select test.assert_eq((select count(*) from public.content_themes), 6, 'org2 sees only own themes');
select test.assert_eq((select count(*) from public.organization_members), 1, 'org2 sees only own members');

-- 他組織のメンバーを勝手に追加できない
select test.expect_error(
  format($$insert into public.organization_members (organization_id, user_id, role)
           values (%L, '00000000-0000-0000-0000-00000000000c', 'owner')$$,
         (select v from test.ids where k = 'org1')),
  '42501', 'cannot join other org');

-- ---------------------------------------------------------------------------
-- editor: SNSデータを登録できる
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000d');
insert into public.social_accounts (organization_id, platform, handle)
select v, 'instagram', 'mj_school' from test.ids where k = 'org1'
returning id as acc \gset
insert into test.ids values ('acc', :'acc');

insert into public.social_posts (organization_id, account_id, title, format, status, published_at, post_url)
select o.v, a.v, 'テスト投稿', 'reel', 'published', '2026-11-01 19:00+09', 'https://www.instagram.com/p/test1/'
from test.ids o, test.ids a where o.k = 'org1' and a.k = 'acc'
returning id as post \gset
insert into test.ids values ('post', :'post');

-- 公開済みなのに公開日時なし → CHECK違反
select test.expect_error(
  format($$insert into public.social_posts (organization_id, account_id, title, format, status)
           values (%L, %L, 'x', 'reel', 'published')$$,
         (select v from test.ids where k = 'org1'), :'acc'),
  '23514', 'published requires published_at');

-- スナップショット（24時間後・72時間後）
insert into public.social_post_metrics (organization_id, post_id, recorded_at)
values ((select v from test.ids where k = 'org1'), :'post', '2026-11-02 19:00+09')
returning id as snap24 \gset
insert into public.social_post_metrics (organization_id, post_id, recorded_at)
values ((select v from test.ids where k = 'org1'), :'post', '2026-11-04 19:00+09')
returning id as snap72 \gset

-- 同じ投稿・同じ記録日時は二重登録できない
select test.expect_error(
  format($$insert into public.social_post_metrics (organization_id, post_id, recorded_at)
           values (%L, %L, '2026-11-02 19:00+09')$$,
         (select v from test.ids where k = 'org1'), :'post'),
  '23505', 'duplicate snapshot');

insert into public.social_post_metric_values (organization_id, snapshot_id, metric, status, value)
select v, :'snap24', m.metric::public.social_metric, m.status::public.metric_status, m.value
from test.ids, (values
  ('views', 'measured', 120::bigint),
  ('likes', 'measured', 0::bigint),        -- 実測0
  ('link_clicks', 'not_collected', null),  -- 未取得
  ('follows_gained', 'unsupported', null)  -- 非対応
) as m(metric, status, value)
where k = 'org1';
insert into public.social_post_metric_values (organization_id, snapshot_id, metric, status, value)
select v, :'snap72', 'views', 'measured', 300 from test.ids where k = 'org1';

-- 実測なのに値なし / 未取得なのに値あり → CHECK違反（0で埋めない）
select test.expect_error(
  format($$insert into public.social_post_metric_values (organization_id, snapshot_id, metric, status, value)
           values (%L, %L, 'shares', 'measured', null)$$, (select v from test.ids where k = 'org1'), :'snap24'),
  '23514', 'measured requires value');
select test.expect_error(
  format($$insert into public.social_post_metric_values (organization_id, snapshot_id, metric, status, value)
           values (%L, %L, 'shares', 'not_collected', 0)$$, (select v from test.ids where k = 'org1'), :'snap24'),
  '23514', 'not_collected must not have value');
select test.expect_error(
  format($$insert into public.social_post_metric_values (organization_id, snapshot_id, metric, status, value)
           values (%L, %L, 'shares', 'measured', -1)$$, (select v from test.ids where k = 'org1'), :'snap24'),
  '23514', 'negative metric');

-- 最新値ビュー: views は72時間後の300、likes は24時間後の0（実測0として残る）
select test.assert_eq((select value from public.social_post_latest_metric_values
                       where post_id = :'post' and metric = 'views'), 300, 'latest views');
select test.assert_eq((select value from public.social_post_latest_metric_values
                       where post_id = :'post' and metric = 'likes'), 0, 'latest likes is measured zero');
select test.assert_eq((select count(*) from public.social_post_latest_metric_values
                       where post_id = :'post' and status = 'measured'), 2, 'only measured rows have values');
select test.assert_eq((select hours_since_publish::bigint from public.social_post_latest_metric_values
                       where post_id = :'post' and metric = 'views'), 72, 'hours since publish');

-- editor は財務・個人情報を見られない／書けない
select test.assert_eq((select count(*) from public.revenue_transactions), 0, 'editor cannot read revenue');
select test.expect_error(
  format($$insert into public.expense_transactions (organization_id, occurred_on, category, amount_jpy)
           values (%L, '2026-11-01', 'ad_spend', 1000)$$, (select v from test.ids where k = 'org1')),
  '42501', 'editor cannot write expenses');

-- 問い合わせ（editor可）と連絡先（admin以上のみ）
insert into public.inquiries (organization_id, inquired_at, attribution, social_post_id)
select v, '2026-11-03 10:00+09', 'self_reported', :'post' from test.ids where k = 'org1'
returning id as inq \gset
insert into test.ids values ('inq', :'inq');
select test.expect_error(
  format($$insert into public.inquiry_contacts (organization_id, inquiry_id, guardian_name)
           values (%L, %L, '保護者')$$, (select v from test.ids where k = 'org1'), :'inq'),
  '42501', 'editor cannot write contacts');

-- ---------------------------------------------------------------------------
-- viewer: 閲覧のみ
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.assert_eq((select count(*) from public.social_posts), 1, 'viewer can read posts');
select test.expect_error(
  format($$insert into public.social_accounts (organization_id, platform, handle)
           values (%L, 'tiktok', 'mj_tt')$$, (select v from test.ids where k = 'org1')),
  '42501', 'viewer cannot insert');
with u as (update public.social_posts set title = 'hacked' returning 1)
select test.assert_eq((select count(*) from u), 0, 'viewer update affects 0 rows');

-- ---------------------------------------------------------------------------
-- 他組織からは見えない・参照できない
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.assert_eq((select count(*) from public.social_posts), 0, 'org2 cannot see org1 posts');
select test.assert_eq((select count(*) from public.social_post_latest_metric_values), 0, 'view respects RLS');
-- 他組織のアカウントIDを使った投稿は複合外部キーで拒否される
select test.expect_error(
  format($$insert into public.social_posts (organization_id, account_id, title, format)
           values (%L, %L, 'x', 'reel')$$, (select v from test.ids where k = 'org2'), (select v from test.ids where k = 'acc')),
  '23503', 'cross-org account reference');
-- organization_id を他組織に偽装しての書き込みはRLSで拒否
select test.expect_error(
  format($$insert into public.inquiries (organization_id, inquired_at) values (%L, now())$$,
         (select v from test.ids where k = 'org1')),
  '42501', 'cannot write into other org');

-- ---------------------------------------------------------------------------
-- owner: 財務・入会の二重計上防止
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000a');
insert into public.inquiry_contacts (organization_id, inquiry_id, guardian_name, email)
select v, :'inq', '保護者テスト', 'parent@test.invalid' from test.ids where k = 'org1';

insert into public.courses (organization_id, name, monthly_fee_jpy)
select v, 'スタンダード', 12000 from test.ids where k = 'org1' returning id as course \gset
insert into public.students (organization_id, display_name, grade, inquiry_id, joined_on)
select v, 'たろう', 5, :'inq', '2026-11-10' from test.ids where k = 'org1' returning id as student \gset
insert into public.enrollments (organization_id, student_id, course_id, inquiry_id, enrolled_on, monthly_fee_jpy)
select v, :'student', :'course', :'inq', '2026-11-10', 12000 from test.ids where k = 'org1'
returning id as enr \gset

select test.expect_error(
  format($$insert into public.enrollments (organization_id, student_id, course_id, inquiry_id, enrolled_on, monthly_fee_jpy)
           values (%L, %L, %L, %L, '2026-12-01', 12000)$$,
         (select v from test.ids where k = 'org1'), :'student', :'course', :'inq'),
  '23505', 'one enrollment per inquiry');

insert into public.revenue_transactions (organization_id, occurred_on, category, amount_jpy, enrollment_id, billing_month)
select v, '2026-11-10', 'tuition', 12000, :'enr', '2026-11-01' from test.ids where k = 'org1';
select test.expect_error(
  format($$insert into public.revenue_transactions (organization_id, occurred_on, category, amount_jpy, enrollment_id, billing_month)
           values (%L, '2026-11-11', 'tuition', 12000, %L, '2026-11-01')$$,
         (select v from test.ids where k = 'org1'), :'enr'),
  '23505', 'tuition once per month');

insert into public.expense_transactions (organization_id, occurred_on, category, amount_jpy, channel_id)
select o.v, '2026-11-01', 'ad_spend', 5000, c.id
from test.ids o join public.marketing_channels c on c.organization_id = o.v and c.code = 'instagram'
where o.k = 'org1';
insert into public.expense_transactions (organization_id, occurred_on, category, amount_jpy)
select v, '2026-11-01', 'rent', 30000 from test.ids where k = 'org1';
select test.assert_eq((select sum(amount_jpy) from public.marketing_costs)::bigint, 5000, 'marketing_costs view = ad categories only');

-- viewer は生徒情報を見られない（未成年の情報）
select test.act_as('00000000-0000-0000-0000-00000000000b');
select test.assert_eq((select count(*) from public.students), 0, 'viewer cannot read students');
select test.assert_eq((select count(*) from public.inquiry_contacts), 0, 'viewer cannot read contacts');

-- editor は生徒を閲覧できるが保護者連絡先は見られない
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.assert_eq((select count(*) from public.students), 1, 'editor can read students');
select test.assert_eq((select count(*) from public.student_guardians), 0, 'editor cannot read guardians');
select test.assert_eq((select count(*) from public.inquiry_contacts), 0, 'editor cannot read contacts');

-- ---------------------------------------------------------------------------
-- 未ログイン（anon）は何も読めない
-- ---------------------------------------------------------------------------
reset role;
set role anon;
select test.expect_error($$select * from public.social_posts$$, '42501', 'anon denied posts');
select test.expect_error($$select * from public.inquiry_contacts$$, '42501', 'anon denied contacts');
select test.expect_error($$select public.create_organization('x')$$, '42501', 'anon cannot create org');
reset role;

\echo 'rls_and_constraints: all assertions passed'
