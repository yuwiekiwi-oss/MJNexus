-- MJ Nexus: 体験・入会台帳
create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  grade text not null,
  channel text not null check (channel in ('Instagram', '検索', '紹介・口コミ', 'チラシ・その他')),
  line_added_on date not null,
  -- どこまで進んだか（見送りになっても到達した段は残す）
  stage text not null default 'line' check (stage in ('line', 'applied', 'attended', 'enrolled')),
  declined boolean not null default false,
  -- 状態を最後に変えた日時（アプリが自動で記録）
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index students_line_added_on_idx on public.students (line_added_on);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ログインした人（招待された講師）は全員、閲覧・登録・編集・削除できる
alter table public.students enable row level security;

create policy "logged in users can read" on public.students
  for select to authenticated using (true);
create policy "logged in users can insert" on public.students
  for insert to authenticated with check (true);
create policy "logged in users can update" on public.students
  for update to authenticated using (true) with check (true);
create policy "logged in users can delete" on public.students
  for delete to authenticated using (true);
