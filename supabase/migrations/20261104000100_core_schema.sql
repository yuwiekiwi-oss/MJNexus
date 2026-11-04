-- =============================================================================
-- MJ Nexus — Phase 1 コアスキーマ
-- -----------------------------------------------------------------------------
-- 方針（詳細は docs/database-design.md）
--   * すべての業務テーブルは organization_id を持ち、RLSで組織単位に分離する
--   * 金額は円の整数（bigint）。浮動小数点の丸め誤差を避ける
--   * SNS実績は「スナップショット × 指標」の縦持ち（long format）で履歴保存し、
--     未記録 / 未取得 / 非対応 / 実測0 を区別する
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
create type public.post_format as enum (
  'reel', 'feed_image', 'carousel', 'story', 'short_video', 'live', 'other'
);
create type public.post_status as enum ('draft', 'scheduled', 'published', 'archived');
create type public.content_idea_status as enum (
  'idea', 'planning', 'production', 'ready', 'published', 'analyzed'
);
create type public.social_metric as enum (
  'views', 'reach', 'likes', 'comments', 'saves', 'shares',
  'profile_visits', 'follows_gained', 'link_clicks'
);
-- measured: 実測値（0を含む） / not_collected: 対応しているが未取得 / unsupported: プラットフォーム非対応
-- 「未記録」は値の行そのものが存在しない状態で表す
create type public.metric_status as enum ('measured', 'not_collected', 'unsupported');
create type public.data_source as enum ('manual', 'csv_import', 'api');
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
create type public.revenue_category as enum (
  'tuition', 'enrollment_fee', 'trial_fee', 'material', 'other'
);
create type public.expense_category as enum (
  'ad_spend', 'campaign', 'content_production',  -- マーケティング費用
  'labor', 'rent', 'software', 'equipment', 'other'
);
create type public.work_kind as enum ('lesson', 'preparation', 'content', 'admin', 'other');

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
-- MJ Social
-- -----------------------------------------------------------------------------
create table public.social_accounts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  platform        public.social_platform not null,
  handle          citext not null check (handle ~ '^[A-Za-z0-9._]{1,50}$'),
  display_name    text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, platform, handle),
  unique (organization_id, id)  -- 複合外部キーで「同じ組織のアカウント」を保証するため
);

-- 投稿テーマ（組織ごとに編集可能なマスタ）
create table public.content_themes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 50),
  description     text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.content_ideas (
  id                       uuid primary key default gen_random_uuid(),
  organization_id          uuid not null references public.organizations (id) on delete cascade,
  title                    text not null check (char_length(title) between 1 and 120),
  status                   public.content_idea_status not null default 'idea',
  platforms                public.social_platform[] not null default '{}',
  theme_id                 uuid,
  format                   public.post_format,
  target_audience          text,
  hook                     text,
  cta                      text,
  hypothesis               text,  -- 仮説: 「何が」「なぜ」成果につながると考えたか
  production_notes         text,
  planned_production_date  date,
  planned_publish_date     date,
  retrospective            text,  -- 投稿後の振り返り（仮説と結果の比較）
  ai_generated             boolean not null default false,  -- 将来: AIによる企画案の識別
  created_by               uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, theme_id)
    references public.content_themes (organization_id, id)
);
create index content_ideas_org_status_idx on public.content_ideas (organization_id, status);

create table public.social_posts (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  account_id         uuid not null,
  content_idea_id    uuid,
  theme_id           uuid,
  post_url           text check (post_url ~ '^https://'),
  title              text not null check (char_length(title) between 1 and 120),
  format             public.post_format not null,
  caption            text,
  hook               text,
  target_audience    text,
  cta                text,
  status             public.post_status not null default 'draft',
  published_at       timestamptz,
  production_minutes int check (production_minutes between 0 and 10000),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, post_url),
  foreign key (organization_id, account_id)
    references public.social_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, content_idea_id)
    references public.content_ideas (organization_id, id),
  foreign key (organization_id, theme_id)
    references public.content_themes (organization_id, id),
  -- 公開済みなら公開日時は必須
  check (status <> 'published' or published_at is not null)
);
create index social_posts_org_published_idx on public.social_posts (organization_id, published_at desc);
create index social_posts_account_idx on public.social_posts (account_id);
create index social_posts_idea_idx on public.social_posts (content_idea_id);

-- 実績スナップショット: 「いつ時点の数字か」を表す1回分の記録
create table public.social_post_metrics (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  post_id         uuid not null,
  recorded_at     timestamptz not null,
  source          public.data_source not null default 'manual',
  note            text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  -- 同じ投稿・同じ記録日時の二重登録を防ぐ
  unique (post_id, recorded_at),
  unique (organization_id, id),
  foreign key (organization_id, post_id)
    references public.social_posts (organization_id, id) on delete cascade
);
create index social_post_metrics_post_time_idx
  on public.social_post_metrics (post_id, recorded_at desc);

-- 指標値: 1スナップショット × 1指標 = 1行
create table public.social_post_metric_values (
  organization_id uuid not null,
  snapshot_id     uuid not null,
  metric          public.social_metric not null,
  status          public.metric_status not null,
  value           bigint check (value >= 0),
  primary key (snapshot_id, metric),
  foreign key (organization_id, snapshot_id)
    references public.social_post_metrics (organization_id, id) on delete cascade,
  -- 実測なら値が必須、未取得・非対応なら値を持たない（0で埋めない）
  check ((status = 'measured') = (value is not null))
);

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
  social_post_id      uuid,
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
    references public.campaigns (organization_id, id),
  foreign key (organization_id, social_post_id)
    references public.social_posts (organization_id, id)
);
create index inquiries_org_time_idx on public.inquiries (organization_id, inquired_at desc);
create index inquiries_channel_idx on public.inquiries (channel_id);
create index inquiries_post_idx on public.inquiries (social_post_id);

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
-- MJ Students / Staff
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

create table public.student_guardians (
  student_id      uuid primary key,
  organization_id uuid not null,
  guardian_name   text not null check (char_length(guardian_name) <= 50),
  email           citext check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text check (phone ~ '^[0-9+\-() ]{6,20}$'),
  created_at      timestamptz not null default now(),
  foreign key (organization_id, student_id)
    references public.students (organization_id, id) on delete cascade
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

create table public.staff (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid references auth.users (id) on delete set null,
  display_name     text not null check (char_length(display_name) between 1 and 50),
  role_title       text,
  hourly_rate_jpy  bigint check (hourly_rate_jpy >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.staff_work_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  staff_id        uuid not null,
  work_date       date not null,
  minutes         int not null check (minutes between 1 and 1440),
  kind            public.work_kind not null,
  note            text,
  created_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, staff_id)
    references public.staff (organization_id, id) on delete cascade
);
create index staff_work_logs_staff_date_idx on public.staff_work_logs (staff_id, work_date);

-- -----------------------------------------------------------------------------
-- MJ Finance
-- -----------------------------------------------------------------------------
create table public.revenue_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  occurred_on     date not null,
  category        public.revenue_category not null,
  amount_jpy      bigint not null check (amount_jpy <> 0),  -- 返金はマイナス
  enrollment_id   uuid,
  billing_month   date check (billing_month = date_trunc('month', billing_month)::date),
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, enrollment_id)
    references public.enrollments (organization_id, id),
  check (category <> 'tuition' or (enrollment_id is not null and billing_month is not null))
);
-- 同じ契約・同じ月の月謝の二重計上を防止（返金は別カテゴリ/マイナス金額で表す）
create unique index revenue_tuition_once_per_month
  on public.revenue_transactions (enrollment_id, billing_month)
  where category = 'tuition' and amount_jpy > 0;
create index revenue_org_date_idx on public.revenue_transactions (organization_id, occurred_on);

-- 費用の唯一の台帳。マーケティング費用もここに記録し、channel/campaign で紐づける
create table public.expense_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  occurred_on     date not null,
  category        public.expense_category not null,
  amount_jpy      bigint not null check (amount_jpy > 0),
  channel_id      uuid,
  campaign_id     uuid,
  staff_id        uuid,
  vendor          text,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, channel_id)
    references public.marketing_channels (organization_id, id),
  foreign key (organization_id, campaign_id)
    references public.campaigns (organization_id, id),
  foreign key (organization_id, staff_id)
    references public.staff (organization_id, id)
);
create index expense_org_date_idx on public.expense_transactions (organization_id, occurred_on);
create index expense_channel_idx on public.expense_transactions (channel_id);

-- -----------------------------------------------------------------------------
-- AI Insights
-- -----------------------------------------------------------------------------
create table public.ai_analysis_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  question        text not null check (char_length(question) <= 2000),
  tool_calls      jsonb not null default '[]'::jsonb,  -- 呼び出した分析ツールと引数（個人情報は含めない）
  answer          jsonb,                               -- 構造化出力（結論・根拠・限界など）
  model           text,
  input_tokens    int,
  output_tokens   int,
  error           text,
  created_at      timestamptz not null default now()
);
create index ai_logs_org_time_idx on public.ai_analysis_logs (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- updated_at トリガー
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','social_accounts','content_ideas','social_posts',
    'campaigns','inquiries','trial_lessons','students','enrollments','staff',
    'revenue_transactions','expense_transactions'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function private.set_updated_at()', t);
  end loop;
end $$;
