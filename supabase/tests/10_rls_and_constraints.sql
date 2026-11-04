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
select test.assert_eq((select count(*) from public.marketing_channels), 5, 'org2 sees only own channels');
select test.assert_eq((select count(*) from public.organization_members), 1, 'org2 sees only own members');

-- 他組織のメンバーを勝手に追加できない
select test.expect_error(
  format($$insert into public.organization_members (organization_id, user_id, role)
           values (%L, '00000000-0000-0000-0000-00000000000c', 'owner')$$,
         (select v from test.ids where k = 'org1')),
  '42501', 'cannot join other org');

-- ---------------------------------------------------------------------------
-- editor: 集客データを登録できる
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000d');
insert into public.campaigns (organization_id, name, utm_campaign)
select v, 'テスト体験会', 'trial_test' from test.ids where k = 'org1';
select test.expect_error(
  format($$insert into public.campaigns (organization_id, name, utm_campaign) values (%L, 'dup', 'trial_test')$$,
         (select v from test.ids where k = 'org1')),
  '23505', 'utm_campaign unique');
select test.expect_error(
  format($$insert into public.marketing_channels (organization_id, code, name, kind) values (%L, 'Bad Code', 'x', 'other')$$,
         (select v from test.ids where k = 'org1')),
  '23514', 'channel code format');

-- editor は費用・個人情報を見られない／書けない
select test.expect_error(
  format($$insert into public.expense_transactions (organization_id, occurred_on, category, amount_jpy)
           values (%L, '2026-11-01', 'ad_spend', 1000)$$, (select v from test.ids where k = 'org1')),
  '42501', 'editor cannot write expenses');

-- 問い合わせ（editor可）と連絡先（admin以上のみ）
insert into public.inquiries (organization_id, inquired_at, attribution)
select v, '2026-11-03 10:00+09', 'self_reported' from test.ids where k = 'org1'
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
select test.assert_eq((select count(*) from public.inquiries), 1, 'viewer can read inquiries');
select test.expect_error(
  format($$insert into public.inquiries (organization_id, inquired_at) values (%L, now())$$,
         (select v from test.ids where k = 'org1')),
  '42501', 'viewer cannot insert');
with u as (update public.inquiries set notes = 'hacked' returning 1)
select test.assert_eq((select count(*) from u), 0, 'viewer update affects 0 rows');

-- ---------------------------------------------------------------------------
-- 他組織からは見えない・参照できない
-- ---------------------------------------------------------------------------
select test.act_as('00000000-0000-0000-0000-00000000000c');
select test.assert_eq((select count(*) from public.inquiries), 0, 'org2 cannot see org1 inquiries');
-- 他組織の問い合わせIDを使った体験は複合外部キーで拒否される
select test.expect_error(
  format($$insert into public.trial_lessons (organization_id, inquiry_id, booked_at, scheduled_at)
           values (%L, %L, now(), now())$$, (select v from test.ids where k = 'org2'), (select v from test.ids where k = 'inq')),
  '23503', 'cross-org inquiry reference');
-- organization_id を他組織に偽装しての書き込みはRLSで拒否
select test.expect_error(
  format($$insert into public.inquiries (organization_id, inquired_at) values (%L, now())$$,
         (select v from test.ids where k = 'org1')),
  '42501', 'cannot write into other org');

-- ---------------------------------------------------------------------------
-- owner: 入会の二重計上防止・費用の区分
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

-- editor は生徒を閲覧できるが連絡先は見られない
select test.act_as('00000000-0000-0000-0000-00000000000d');
select test.assert_eq((select count(*) from public.students), 1, 'editor can read students');
select test.assert_eq((select count(*) from public.inquiry_contacts), 0, 'editor cannot read contacts');

-- ---------------------------------------------------------------------------
-- 未ログイン（anon）は何も読めない
-- ---------------------------------------------------------------------------
reset role;
set role anon;
select test.expect_error($$select * from public.inquiries$$, '42501', 'anon denied inquiries');
select test.expect_error($$select * from public.inquiry_contacts$$, '42501', 'anon denied contacts');
select test.expect_error($$select public.create_organization('x')$$, '42501', 'anon cannot create org');
reset role;

\echo 'rls_and_constraints: all assertions passed'
