# MJ Nexus

小中学生向けRobloxゲーム制作スクール「MJ」の **集客管理ツール**。問い合わせから体験授業・入会までを記録し、集客の成果と費用対効果を確認します。

> **現在の状態**
> できること: 問い合わせ・体験・入会の記録と、集客ファネル・集客費用の分析だけです。必要だと分かった機能だけを、その都度追加する方針です。
> Supabase は **未接続** です（下記「セットアップ」で接続します）。実際の事業データではまだ検証していません。

## できること

- 問い合わせの登録（流入URLのUTMからチャネル・キャンペーンを自動選択、きっかけの確度を記録、連絡先は管理者のみ）
- 体験授業の申込・参加・欠席・キャンセル（振替も可）、入会（生徒と契約を同時に作成）、失注の記録
- 集客ファネル（問い合わせ月コホート。全体・チャネル別・きっかけの確度別）
- CPA・CAC・問い合わせから入会までの日数（費用が未記録・権限なしのときは0円とみなさない）
- 集客チャネル・キャンペーン・コース・集客費用の管理
- 共通: ログイン（招待制）、スクール（組織）と権限（owner / admin / editor / viewer）、Light / Dark、スマホ表示

## 技術スタック

Vite / React / TypeScript (strict) / Tailwind CSS v4 / shadcn/ui / Recharts / Lucide / React Router / TanStack Query / Supabase (PostgreSQL, Auth, RLS) / Python (pandas、KPIカタログとデータ量の確認のみ) / Vitest / pytest / Cloudflare Pages

詳細は [docs/architecture.md](docs/architecture.md)。

## クイックスタート（Supabaseなし）

```bash
npm install
npm run dev                          # http://localhost:5173 （未接続モードで起動）
VITE_DEMO_MODE=true npm run dev      # 【サンプル】データで画面を確認するデモ表示（読み取り専用）
```

デモ表示のサンプルデータは `src/demo/` にあり、通常のビルドには含まれません（動的 import で除外）。

## セットアップ（Supabase接続）

1. [Supabase](https://supabase.com) でプロジェクトを作成（リージョンは Tokyo 推奨）。
2. スキーマを適用する。どちらかの方法で:
   - **CLI**: `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push`
   - **ダッシュボード**: SQL Editor で `supabase/migrations/` のファイルを番号順に実行
3. ダッシュボード > Authentication > Sign In / Providers で **「Allow new users to sign up」をオフ**（招待制）。
4. Authentication > Users > **Invite user** で自分のメールアドレスを招待し、届いたメールからパスワードを設定。
5. Authentication > URL Configuration の Site URL に `http://localhost:5173`（本番はCloudflare PagesのURL）を設定。
6. `.env.local` を作成:
   ```bash
   cp .env.example .env.local
   # Project Settings > API の URL と anon（publishable）キーを設定
   ```
7. `npm run dev` → ログイン → スクール名を入力して作成。

### 環境変数

| 変数 | 置き場所 | 内容 | 状態 |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env.local` / Cloudflare Pages | SupabaseのURL | 未設定 |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` / Cloudflare Pages | anon（publishable）キー。公開されても安全な設計（権限はRLSが守る） | 未設定 |

service_role / secret キーや `sk-` で始まるキーを `VITE_` 変数に入れると、アプリは起動時に拒否して「設定エラー」を表示します。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド（`dist/`） |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | oxlint |
| `npm test` | Vitest（Reactコンポーネント・ユーティリティ） |
| `npm run test:py` | pytest（KPIカタログの整合性など） |
| `npm run test:db` | マイグレーション + RLSテスト（PostgreSQLが必要。`PGHOST` 等で接続先を指定） |
| `npm run test:all` | 上記すべて |

## デプロイ（Cloudflare Pages）

- Build command: `npm run build` / Output directory: `dist`
- 環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を設定
- `public/_headers`（CSP等）と `public/_redirects`（SPAルーティング）が自動で適用されます

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 全体構成・ディレクトリ・認証フロー |
| [docs/database-design.md](docs/database-design.md) | テーブル設計・設計判断・RLS |
| [docs/kpi-definitions.md](docs/kpi-definitions.md) | 指標の計算式と分母 |
| [docs/decision-log.md](docs/decision-log.md) | 技術判断の記録 |

## データの取り扱い

- 初期状態は空のDBです。架空の実績データは入れません。
- 生徒は呼び名と学年のみ。連絡先は別テーブルで admin 以上のみ閲覧可能。
- 問い合わせのメモには個人を特定できる情報を書かない運用です（画面でも注意を出します）。
