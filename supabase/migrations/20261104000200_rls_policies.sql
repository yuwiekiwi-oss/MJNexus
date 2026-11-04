-- =============================================================================
-- MJ Nexus — Row Level Security（行レベルセキュリティ）
-- -----------------------------------------------------------------------------
-- RLS: テーブルの「どの行を誰が読める・書けるか」をDB側で強制する仕組み。
-- フロントエンドのバグや改ざんがあっても、DBが権限外の行を返さない。
--
-- ロール設計（organization_members.role）
--   owner  : すべて + メンバー管理
--   admin  : すべての業務データ（個人情報・財務を含む）
--   editor : SNS・企画・集客データの編集、生徒の閲覧
--   viewer : SNS・企画・集客データの閲覧のみ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 権限判定関数
--   security definer: 関数所有者の権限で実行（organization_members を
--   RLSの再帰なしに参照するため）。search_path を固定して乗っ取りを防ぐ。
-- -----------------------------------------------------------------------------
create or replace function private.member_role(org uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.organization_members m
  where m.organization_id = org
    and m.user_id = (select auth.uid())
$$;

create or replace function private.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.member_role(org) is not null
$$;

-- 指定ロール以上か（owner > admin > editor > viewer）
create or replace function private.has_role(org uuid, min_role public.member_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_position(array['viewer','editor','admin','owner']::public.member_role[], private.member_role(org))
      >= array_position(array['viewer','editor','admin','owner']::public.member_role[], min_role),
    false
  )
$$;

revoke all on function private.member_role(uuid) from public;
revoke all on function private.is_member(uuid) from public;
revoke all on function private.has_role(uuid, public.member_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.member_role(uuid) to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.has_role(uuid, public.member_role) to authenticated;

-- -----------------------------------------------------------------------------
-- 匿名ユーザー（未ログイン）には一切のテーブルアクセスを与えない
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 全テーブルでRLSを有効化（ポリシーがなければ何も見えない = 安全側のデフォルト）
-- -----------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('alter table public.%I force row level security', t.tablename);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 組織・メンバー・プロフィール
-- -----------------------------------------------------------------------------
create policy org_select on public.organizations
  for select to authenticated using (private.is_member(id));
create policy org_update on public.organizations
  for update to authenticated
  using (private.has_role(id, 'admin')) with check (private.has_role(id, 'admin'));
-- INSERT は create_organization() 経由のみ。DELETE はクライアントから不可。

create policy members_select on public.organization_members
  for select to authenticated using (private.is_member(organization_id));
create policy members_insert on public.organization_members
  for insert to authenticated with check (private.has_role(organization_id, 'owner'));
create policy members_update on public.organization_members
  for update to authenticated
  using (private.has_role(organization_id, 'owner'))
  with check (private.has_role(organization_id, 'owner'));
create policy members_delete on public.organization_members
  for delete to authenticated using (private.has_role(organization_id, 'owner'));

-- 最後の owner を削除・降格できないようにする（組織が管理不能になるのを防ぐ）
create or replace function private.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.organization_members
       where organization_id = old.organization_id
         and role = 'owner'
         and user_id <> old.user_id
     )
     and exists (select 1 from public.organizations where id = old.organization_id)
  then
    raise exception 'cannot remove the last owner of an organization';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger protect_last_owner
  before update or delete on public.organization_members
  for each row execute function private.protect_last_owner();

create policy profiles_select on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members me
      join public.organization_members other
        on other.organization_id = me.organization_id
      where me.user_id = (select auth.uid()) and other.user_id = profiles.id
    )
  );
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 汎用ポリシー生成
--   read_role  : 閲覧に必要な最低ロール
--   write_role : 追加・更新・削除に必要な最低ロール
-- -----------------------------------------------------------------------------
create or replace function private.apply_org_policies(
  tbl text, read_role public.member_role, write_role public.member_role
) returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create policy %1$s_select on public.%1$I for select to authenticated
       using (private.has_role(organization_id, %2$L))', tbl, read_role);
  execute format(
    'create policy %1$s_insert on public.%1$I for insert to authenticated
       with check (private.has_role(organization_id, %2$L))', tbl, write_role);
  execute format(
    'create policy %1$s_update on public.%1$I for update to authenticated
       using (private.has_role(organization_id, %2$L))
       with check (private.has_role(organization_id, %2$L))', tbl, write_role);
  execute format(
    'create policy %1$s_delete on public.%1$I for delete to authenticated
       using (private.has_role(organization_id, %2$L))', tbl, write_role);
end;
$$;

-- SNS・企画・集客: 全メンバー閲覧 / editor以上が編集
select private.apply_org_policies('social_accounts',           'viewer', 'editor');
select private.apply_org_policies('content_themes',            'viewer', 'editor');
select private.apply_org_policies('content_ideas',             'viewer', 'editor');
select private.apply_org_policies('social_posts',              'viewer', 'editor');
select private.apply_org_policies('social_post_metrics',       'viewer', 'editor');
select private.apply_org_policies('social_post_metric_values', 'viewer', 'editor');
select private.apply_org_policies('marketing_channels',        'viewer', 'editor');
select private.apply_org_policies('campaigns',                 'viewer', 'editor');
select private.apply_org_policies('inquiries',                 'viewer', 'editor');
select private.apply_org_policies('trial_lessons',             'viewer', 'editor');

-- コース: 全メンバー閲覧 / admin以上が編集
select private.apply_org_policies('courses',                   'viewer', 'admin');

-- 生徒・契約（未成年の情報）: editor以上が閲覧 / admin以上が編集
select private.apply_org_policies('students',                  'editor', 'admin');
select private.apply_org_policies('enrollments',               'editor', 'admin');

-- 個人情報・財務・人件費: admin以上のみ
select private.apply_org_policies('inquiry_contacts',          'admin',  'admin');
select private.apply_org_policies('student_guardians',         'admin',  'admin');
select private.apply_org_policies('revenue_transactions',      'admin',  'admin');
select private.apply_org_policies('expense_transactions',      'admin',  'admin');
select private.apply_org_policies('staff',                     'admin',  'admin');
select private.apply_org_policies('staff_work_logs',           'admin',  'admin');

drop function private.apply_org_policies(text, public.member_role, public.member_role);

-- AI分析ログ: 本人の質問ログ、または admin 以上が閲覧。更新・削除は不可（監査証跡）
create policy ai_logs_select on public.ai_analysis_logs
  for select to authenticated using (
    private.is_member(organization_id)
    and (user_id = (select auth.uid()) or private.has_role(organization_id, 'admin'))
  );
create policy ai_logs_insert on public.ai_analysis_logs
  for insert to authenticated with check (
    private.is_member(organization_id) and user_id = (select auth.uid())
  );

-- -----------------------------------------------------------------------------
-- RPC: 組織の作成（作成者を owner にし、初期マスタを登録）
--   初期マスタは「設定値」であり、架空の実績データではない
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_org uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if org_name is null or char_length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  insert into public.organizations (name) values (trim(org_name)) returning id into new_org;
  insert into public.organization_members (organization_id, user_id, role)
    values (new_org, uid, 'owner');

  insert into public.content_themes (organization_id, name, sort_order) values
    (new_org, 'Robloxゲーム完成動画', 10),
    (new_org, 'AIを使ったゲーム制作過程', 20),
    (new_org, 'Vibe Codingの紹介', 30),
    (new_org, 'Roblox Studioのチュートリアル', 40),
    (new_org, '保護者向け教育コンテンツ', 50),
    (new_org, '体験授業の案内', 60);

  insert into public.marketing_channels (organization_id, code, name, kind, platform) values
    (new_org, 'instagram', 'Instagram（オーガニック）', 'organic_social', 'instagram'),
    (new_org, 'tiktok',    'TikTok（オーガニック）',    'organic_social', 'tiktok'),
    (new_org, 'referral',  '紹介',                      'referral',       null),
    (new_org, 'web',       'Webサイト・検索',            'web',            null),
    (new_org, 'other',     'その他・不明',               'other',          null);

  return new_org;
end;
$$;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;

-- 新規ユーザー作成時にプロフィールを自動作成
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
