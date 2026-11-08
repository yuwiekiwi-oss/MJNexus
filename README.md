# MJ Nexus

MJ PC & English School の集客を見るためのアプリです。画面は2つだけです。

- **ダッシュボード**：入会者数・LINE追加数・体験申込数・体験→入会率と、流入経路ごとのファネル（LINE追加 → 体験申込 → 体験参加 → 入会）
- **体験・入会台帳**：生徒ごとに「名前・学年・流入経路・LINE追加日・状態」を登録する。状態を変えるだけで、ダッシュボードの数字が更新される

## 数え方

- 期間は **LINE追加日** で区切ります（今月／直近3か月／直近6か月／すべて）。
- 状態は「LINE追加のみ → 体験申込 → 体験参加 → 入会」と「見送り」です。
- 見送りにしても、それまでに進んだ段はファネルに数えます（例：体験参加の後に見送り → 体験参加までは数える）。
- 状態を変えた日時はアプリが自動で記録します（入力は不要）。

## 動かす

```bash
npm install
npm run dev     # http://localhost:5173
```

Supabase を設定しないと、データは **そのブラウザだけ** に保存されます（お試し用）。空のときはダッシュボードの「サンプルデータで試す」で画面を確認できます。

## 講師と共有する（Supabase に接続）

1. [Supabase](https://supabase.com) でプロジェクトを作る
2. SQL Editor で `supabase/migrations/20261108000100_students.sql` を実行する
3. Authentication → Sign In / Providers で「Allow new users to sign up」をオフにする（招待した人だけがログインできるようにする）
4. Authentication → Users の「Invite user」で、自分と講師のメールアドレスを招待する
5. `.env.example` を `.env.local` にコピーし、Project Settings → API の URL と anon key を入れる

ログインはメールに届くリンクを押すだけです。ログインした人は全員、台帳を見る・登録・編集・削除できます。

## 公開する

`npm run build` でできる `dist/` を、Cloudflare Pages などの静的ホスティングに置きます。環境変数 `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を設定し、すべてのパスを `index.html` に返す設定（SPA）にしてください。Cloudflare Pages は `public/_redirects` で対応済みです。

## 開発

```bash
npm run typecheck
npm test
npm run build
```

構成：Vite / React / TypeScript / React Router / Supabase（PostgreSQL・Auth・RLS）/ Vitest
