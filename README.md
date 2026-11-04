# MJ Nexus

**School Intelligence Platform** — 小中学生向けRobloxゲーム制作スクール「MJ」の、SNS運用・集客・経営・教育運営を統合するプラットフォーム。

> **現在の状態: Phase 3（集客分析）完了**
> 実装済み: Overview・Social・Content Planner・Marketing・Settings。Analytics・AI Insights などは **Coming Soon** です。
> Supabase・OpenAIは **未接続** です（下記「セットアップ」で接続します）。集客の経営指標（問い合わせ〜入会・CPA・CAC）は実装済みですが、**実際の事業データでは未検証** です。売上・利益は未実装です。

## できること

**Phase 3（集客分析）**

- 問い合わせの登録（流入URLのUTM・追跡コードから投稿を照合、紐づけの確度を記録、連絡先は管理者のみ）
- 体験授業の申込・参加・欠席・キャンセル、入会（生徒と契約を同時に作成）、失注の記録
- 集客ファネル（問い合わせ月コホート、全体・チャネル別・紐づけ確度別・投稿のテーマ別・プラットフォーム別）
- CPA・CAC・問い合わせから入会までの日数（費用の未記録・権限なしを0円とみなさない）
- 集客チャネル・キャンペーン・コース・集客費用の管理

**Phase 2（SNS運用）**

- SNSアカウント・投稿テーマの管理
- 投稿の登録（テーマ・形式・フック・CTA・公開日時・制作時間・元の企画・追跡コード）
- 実績の時系列記録（24時間後・72時間後・7日後のプリセット、未記録 / 未取得 / 非対応 / 実測0 の区別）
- 投稿ごとの成長推移グラフと履歴
- SNSダッシュボード（プラットフォーム・テーマ・形式・時間帯・CTA別の中央値、件数・欠損・信頼度の表示）
- CSVエクスポート（式インジェクション対策）・実績のCSVインポート（全行を検証してから取り込み）
- Content Planner（カンバン・カレンダー、企画の仮説と投稿結果の比較、振り返り）
- 施策・AI提案を記録するテーブル（画面は Phase 5）

**Phase 1（共通基盤）**

- サイドバー付きの共通レイアウト（Light / Dark / システム設定、レスポンシブ）
- Supabase Auth によるログイン（パスワード / メールリンク、招待制）
- 初回ログイン時のスクール（組織）作成
- 全モジュール分のDBスキーマ、RLS（行レベルの権限制御）、二重計上防止の制約
- Supabase未接続時の「未接続モード」（画面確認のみ、データなし）
- テスト環境: Vitest（React）、pytest（Python）、SQLのRLSテスト、GitHub Actions

## 技術スタック

Vite / React / TypeScript (strict) / Tailwind CSS v4 / shadcn/ui / Recharts / Lucide / React Router / TanStack Query / Supabase (PostgreSQL, Auth, RLS, Edge Functions) / Python (pandas, NumPy, SciPy, statsmodels) / Vitest / pytest / Cloudflare Pages

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
| `OPENAI_API_KEY` | Supabase Edge Function の Secrets | Phase 5 で使用。**ブラウザ用の変数に入れない** | 未設定（Phase 5） |

service_role / secret キーや `sk-` で始まるキーを `VITE_` 変数に入れると、アプリは起動時に拒否して「設定エラー」を表示します。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 型チェック + 本番ビルド（`dist/`） |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | oxlint |
| `npm test` | Vitest（Reactコンポーネント・ユーティリティ） |
| `npm run test:py` | pytest（Python分析） |
| `npm run test:db` | マイグレーション + RLSテスト（PostgreSQLが必要。`PGHOST` 等で接続先を指定） |
| `npm run test:all` | 上記すべて |

## デプロイ（Cloudflare Pages）

- Build command: `npm run build` / Output directory: `dist`
- 環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` を設定
- `public/_headers`（CSP等）と `public/_redirects`（SPAルーティング）が自動で適用されます

## ドキュメント

| 文書 | 内容 |
|---|---|
| [docs/architecture.md](docs/architecture.md) | 全体構成・ディレクトリ・フェーズ・認証フロー |
| [docs/database-design.md](docs/database-design.md) | テーブル設計・設計判断・RLS |
| [docs/kpi-definitions.md](docs/kpi-definitions.md) | 指標の計算式と分母 |
| [docs/analysis-methods.md](docs/analysis-methods.md) | データ量に応じた分析手法 |
| [docs/decision-log.md](docs/decision-log.md) | 技術判断の記録 |
| [docs/ai-evaluation.md](docs/ai-evaluation.md) | AI回答の評価設計 |
| [docs/decision-support-design.md](docs/decision-support-design.md) | 経営判断支援への拡張設計（SNS分析と経営分析の区別） |
| [docs/phase-1-report.md](docs/phase-1-report.md) | Phase 1 の実装報告 |
| [docs/phase-2-report.md](docs/phase-2-report.md) | Phase 2 の実装報告 |
| [docs/phase-3-report.md](docs/phase-3-report.md) | Phase 3 の実装報告 |

## データの取り扱い

- 初期状態は空のDBです。架空の実績データは入れません。
- 生徒は呼び名と学年のみ。連絡先は別テーブルで admin 以上のみ閲覧可能。
- 実データを Tableau Public に公開しないでください。
- SNSの非公式スクレイピングは実装しません（公式API連携は将来機能）。
