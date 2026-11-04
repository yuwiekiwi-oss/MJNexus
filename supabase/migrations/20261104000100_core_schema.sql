-- =============================================================================
-- MJ Nexus — コアスキーマ（集客: 問い合わせ〜入会・集客費用）
-- -----------------------------------------------------------------------------
-- 方針（詳細は docs/database-design.md）
--   * すべての業務テーブルは organization_id を持ち、RLSで組織単位に分離する
--   * 金額は円の整数（bigint）。浮動小数点の丸め誤差を避ける
--   * 費用は expense_transactions を唯一の台帳とし、マーケティング費用はビューで
--     参照する（二重計上の防止）
--   * 個人情報（保護者の連絡先など）は別テーブルに分け、より強い権限で保護する
-- =============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- 大文字小文字を区別しない文字列（メール等）

create schema if not exists private;       -- API（PostgREST）に公開しない内部関数用
revoke all on schema private from public;

-- -----------------------------------------------------------------------------
-- 列挙型（enum）
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'editor', 'viewer');
create type public.social_platform as enum ('instagram', 'tiktok');
create type public.channel_kind as enum (
  'organic_social', 'paid_social', 'search', 'referral', 'offline', 'web', 'other'
);
create type public.attribution_method as enum (
  'tracked_link',   -- UTM付きリンク等で機械的に識別
  'self_reported',  -- 問い合わせ時に本人が回答（「何で知りましたか」）
  'staff_inferred', -- スタッフの推定
  'unknown'
);
create type public.trial_status as enum ('booked', 'attended', 'no_show', 'cancelled');
create type public.enrollment_status as enum ('active', 'paused', 'ended');
create type public.student_status as enum ('active', 'paused', 'withdrawn');
create type public.expense_category as enum (
  'ad_spend', 'campaign', 'content_production',  -- マーケティング費用
  'labor', 'rent', 'software', 'equipment', 'other'
);

-- -----------------------------------------------------------------------------
-- 共通: updated_at 自動更新トリガー
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 組織・ユーザー
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 100),
  timezone    text not null default 'Asia/Tokyo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- users: Supabase Auth の auth.users を正とし、アプリ側の表示情報のみ保持
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 50),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            public.member_role not null default 'viewer',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);

-- -----------------------------------------------------------------------------
-- MJ Marketing
-- -----------------------------------------------------------------------------
create table public.marketing_channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code            text not null check (code ~ '^[a-z0-9_]{1,40}$'),  -- UTM source と対応させる
  name            text not null,
  kind            public.channel_kind not null,
  platform        public.social_platform,  -- SNSチャネルの場合
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel_id      uuid,
  name            text not null check (char_length(name) between 1 and 100),
  utm_campaign    text check (utm_campaign ~ '^[a-z0-9_-]{1,60}$'),
  starts_on       date,
  ends_on         date,
  budget_jpy      bigint check (budget_jpy >= 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, utm_campaign),
  unique (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.marketing_channels (organization_id, id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- 問い合わせ: 個人を特定できる情報は持たない（連絡先は inquiry_contacts へ分離）
create table public.inquiries (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  inquired_at         timestamptz not null,
  channel_id          uuid,
  campaign_id         uuid,
  attribution         public.attribution_method not null default 'unknown',
  -- 将来のUTM流入識別用（現時点では任意入力）
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_content         text,
  child_grade         smallint check (child_grade between 1 and 9),  -- 小1=1 … 中3=9
  closed_lost_at      timestamptz,
  closed_lost_reason  text,
  notes               text,  -- 個人情報を書かない運用（UIでも注意喚起）
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.marketing_channels (organization_id, id),
  foreign key (organization_id, campaign_id)
    references public.campaigns (organization_id, id)
);
create index inquiries_org_time_idx on public.inquiries (organization_id, inquired_at desc);
create index inquiries_channel_idx on public.inquiries (channel_id);

-- 保護者の連絡先（個人情報）: owner/admin のみ参照可能
create table public.inquiry_contacts (
  inquiry_id      uuid primary key,
  organization_id uuid not null,
  guardian_name   text not null check (char_length(guardian_name) <= 50),
  email           citext check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text check (phone ~ '^[0-9+\-() ]{6,20}$'),
  created_at      timestamptz not null default now(),
  foreign key (organization_id, inquiry_id)
    references public.inquiries (organization_id, id) on delete cascade
);

create table public.trial_lessons (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  inquiry_id      uuid not null,
  booked_at       timestamptz not null,  -- 体験申込日時
  scheduled_at    timestamptz not null,  -- 体験実施予定日時
  status          public.trial_status not null default 'booked',
  attended_at     timestamptz,
  cancelled_at    timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, inquiry_id)
    references public.inquiries (organization_id, id) on delete cascade,
  check ((status = 'attended') = (attended_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create index trial_lessons_inquiry_idx on public.trial_lessons (inquiry_id);
create index trial_lessons_org_scheduled_idx on public.trial_lessons (organization_id, scheduled_at);

-- -----------------------------------------------------------------------------
-- 生徒・契約（入会の記録に必要な最小限）
-- -----------------------------------------------------------------------------
create table public.courses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  monthly_fee_jpy  bigint not null check (monthly_fee_jpy >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

-- 生徒（未成年）: 氏名ではなく呼び名、生年月日ではなく学年のみ保持
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  display_name    text not null check (char_length(display_name) between 1 and 30),
  grade           smallint check (grade between 1 and 9),
  status          public.student_status not null default 'active',
  inquiry_id      uuid,
  joined_on       date not null,
  withdrawn_on    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, inquiry_id)
    references public.inquiries (organization_id, id),
  check ((status = 'withdrawn') = (withdrawn_on is not null)),
  check (withdrawn_on is null or withdrawn_on >= joined_on)
);

create table public.enrollments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  student_id      uuid not null,
  course_id       uuid not null,
  inquiry_id      uuid,   -- どの問い合わせからの入会か（ファネル集計用）
  enrolled_on     date not null,
  ended_on        date,
  status          public.enrollment_status not null default 'active',
  monthly_fee_jpy bigint not null check (monthly_fee_jpy >= 0),  -- 契約時点の月謝を固定保存
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, student_id)
    references public.students (organization_id, id) on delete cascade,
  foreign key (organization_id, course_id)
    references public.courses (organization_id, id),
  foreign key (organization_id, inquiry_id)
    references public.inquiries (organization_id, id),
  check ((status = 'ended') = (ended_on is not null)),
  check (ended_on is null or ended_on >= enrolled_on)
);
-- 1件の問い合わせが複数の入会として数えられないようにする（入会転換率の二重計上防止）
create unique index enrollments_inquiry_uniq on public.enrollments (inquiry_id) where inquiry_id is not null;
create index enrollments_org_enrolled_idx on public.enrollments (organization_id, enrolled_on);

-- -----------------------------------------------------------------------------
-- 費用
-- -----------------------------------------------------------------------------
-- 費用の台帳。集客費用は channel/campaign で紐づけ、ビュー marketing_costs で読む
create table public.expense_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  occurred_on     date not null,
  category        public.expense_category not null,
  amount_jpy      bigint not null check (amount_jpy > 0),
  channel_id      uuid,
  campaign_id     uuid,
  vendor          text,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.marketing_channels (organization_id, id),
  foreign key (organization_id, campaign_id)
    references public.campaigns (organization_id, id)
);
create index expense_org_date_idx on public.expense_transactions (organization_id, occurred_on);
create index expense_channel_idx on public.expense_transactions (channel_id);

-- -----------------------------------------------------------------------------
-- updated_at トリガー
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles',
    'campaigns','inquiries','trial_lessons','students','enrollments',
    'expense_transactions'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end $$;
