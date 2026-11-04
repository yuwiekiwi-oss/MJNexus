# 意思決定ログ

技術・設計の判断とその理由を記録します（ADR: Architecture Decision Record の簡易版）。

## 2026-11-04 Phase 1

### D-001 フロントエンドは Vite + React（Next.js不使用）
- **理由**: 仕様の指定。管理画面はSEOやサーバーレンダリングが不要で、静的SPAで十分。Cloudflare Pagesで配信できる。

### D-002 shadcn/ui は手書きで導入
- **状況**: 開発環境のネットワーク制限で `npx shadcn add` がレジストリ（ui.shadcn.com）に接続できなかった。
- **判断**: shadcn/ui と同じ構成（Radix UI + class-variance-authority + Tailwind、`components.json`、`src/components/ui/`）で必要な部品を手書きした。
- **影響**: 今後、ネットワークが使える環境では `npx shadcn add <component>` でそのまま追加できる。

### D-003 マルチテナント構造（organization_id）を最初から入れる
- **理由**: 現時点はスクール1つだが、RLSの判定単位として「組織への所属」があると権限設計が単純になる。後から全テーブルに列を足すより安い。
- **代償**: 全テーブルに `organization_id` が必要。複合外部キーで組織間の混在を防ぐ。

### D-004 SNS指標は縦持ち（スナップショット × 指標）
- **理由**: プラットフォームによって取得できる指標が異なり、さらに「未取得・非対応・実測0」を区別する必要がある。横持ち（列ごと）だと状態列が指標数だけ必要になる。
- **代償**: 画面表示や分析では横に並べ直す（ピボット）処理が必要。ビューとPythonで用意する。

### D-005 費用は単一の台帳 + マーケティング費用はビュー
- **理由**: 仕様の `marketing_costs` を独立テーブルにすると、広告費を「費用」と「マーケ費用」に二重入力するリスクがある。
- **判断**: `expense_transactions` に一本化し、`marketing_costs` は `category in ('ad_spend','campaign','content_production')` のビューにした。

### D-006 個人情報は別テーブル・admin以上のみ
- **理由**: 未成年の情報を扱う。分析に必要なのは件数や日付であり、氏名・連絡先は不要。
- **判断**: 問い合わせ・生徒の本体には個人情報を置かず、連絡先を `inquiry_contacts` / `student_guardians` に分離。生徒は呼び名と学年のみ。

### D-007 招待制（新規登録無効）
- **理由**: 誰でもアカウントを作れると、組織を作成してシステムを使えてしまう。業務システムとして利用者を限定する。

### D-008 DBテストは素のPostgreSQL + Supabase互換シム
- **理由**: Supabase CLI のローカル環境はDockerが必要。CIや手元で軽く回せるよう、`auth.uid()` とロールだけを模倣したシムでマイグレーションとRLSを検証する。
- **限界**: Supabase固有の機能（Storage・Realtime等）は検証できない。接続後に Supabase のステージング環境でも確認する。

### D-009 Supabase未接続でも画面を確認できる
- **理由**: Supabase の準備前でもデザイン・レイアウトを確認できるようにする。
- **安全策**: 未接続モードでは常に警告バナーを出し、データを一切扱わず、サンプル値も表示しない。

### D-010 TypeScript 7 / Vite 8 / React Router 8 / Tailwind v4
- **理由**: 2026年11月時点の各ツールの最新安定版を `npm create vite` の既定構成から採用。仕様の技術スタックから変更はない。
- **注意**: Lintは Vite の既定テンプレートに含まれる oxlint を使用（ESLintより高速。仕様に指定がないため既定のまま）。
