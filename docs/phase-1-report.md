# Phase 1 実装報告（共通基盤）

日付: 2026-11-04

## 1. 完成した機能

| 機能 | 状態 | 補足 |
|---|---|---|
| Vite + React + TypeScript（strict） | ✅ | `noUncheckedIndexedAccess` も有効 |
| デザインシステム | ✅ | Tailwind v4 + shadcn/ui 準拠部品（Button, Card, Badge, Input, Label, Alert, Sheet, DropdownMenu, Skeleton, Separator）。ニュートラル + インディゴ、OKLCHトークン |
| 共通レイアウト・サイドバー | ✅ | 12メニュー。未実装10件に「Soon」バッジ、ページは「Coming Soon — Phase N で実装予定」 |
| Light / Dark / システム | ✅ | 描画前に適用してちらつき防止 |
| レスポンシブ | ✅ | モバイルはドロワー型メニュー |
| Empty / Loading / Error / Coming Soon 状態 | ✅ | 共通コンポーネント |
| Supabase接続 | ✅（未接続） | 環境変数の検証付き。未設定なら未接続モード |
| Auth | ✅（未接続） | パスワード / メールリンク、招待制、認証ガード、組織作成 |
| DBスキーマ | ✅ | 全モジュール分 23テーブル + 2ビュー |
| RLS | ✅ | 4ロール、全テーブルで有効化、ローカルPostgreSQLで検証済み |
| テスト環境 | ✅ | Vitest / pytest / SQLテスト / GitHub Actions |
| Social〜Learning の各画面 | ❌ 未実装 | Coming Soon 表示のみ |

## 2. 採用した技術と理由

- **TanStack Query**: サーバーデータの取得・キャッシュ・再試行を担当し、Loading/Error状態を画面ごとに書かずに済む。
- **zod**: 入力値と環境変数の検証。型とバリデーションを一か所で定義できる。
- **Radix UI（shadcn/uiの土台）**: メニューやドロワーのキーボード操作・アクセシビリティを担保。
- **oxlint**: Viteテンプレート既定のLinter。
- その他の判断は [decision-log.md](decision-log.md)（shadcn CLI が使えず手書きした件を含む）。

## 3. データの処理方法

- 画面 → Supabase（PostgREST API）→ PostgreSQL。JWTに含まれるユーザーIDでRLSが行を絞り込む。
- SNS実績は「記録時点 × 指標」で履歴保存。最新値はウィンドウ関数のビューで取り出す。
- 未記録 / 未取得 / 非対応 / 実測0 をDB制約・TypeScript型・Pythonの3か所で同じ規則で扱う。
- CSV出力は式インジェクション対策済みのユーティリティ（`src/lib/csv.ts`）を用意。インポート検証は Phase 2。

## 4. 経営指標の意味と計算式

Phase 1 では指標の集計はまだありません。定義は [kpi-definitions.md](kpi-definitions.md) に記載し、共通ルール（分母0・未取得は「計算不能」として0%と区別）を `safeRate`（TS）と `safe_rate`（Python）で実装済みです。

## 5. テスト・検証結果

| 対象 | ツール | 件数 | 結果 |
|---|---|---|---|
| 型チェック | `tsc -b` | — | エラー0 |
| Lint | oxlint | — | 警告0 |
| フロントエンド | Vitest + Testing Library | 37 | 全件成功 |
| Python分析 | pytest | 19 | 全件成功 |
| DB（マイグレーション・RLS・制約） | PostgreSQL 16 + シム | 38アサーション | 全件成功 |
| 本番ビルド | Vite | — | 成功（JS 約800KB / gzip 約240KB） |
| 表示確認 | Playwright | Light / Dark / モバイル | コンソールエラーなし |

DBテストの主な確認内容: 他組織のデータが見えない・書けない、viewerは書けない、editorは財務・連絡先を読めない、未ログインは全拒否、実測なのに値なし・未取得なのに0はCHECK違反、同時点の実績の二重登録・同一問い合わせの二重入会・同月の月謝の二重計上はユニーク違反、最後のownerは削除不可。RLSポリシーを意図的に緩めるとテストが失敗することも確認済み。

**未検証**: 実際のSupabaseプロジェクト上での動作（未接続のため）。接続後に招待→ログイン→組織作成を確認してください。

## 6. 今後の改善課題

- Supabase接続後、`supabase gen types` で `src/types/database.ts` を自動生成版に置き換える。
- JSバンドルが約800KBのため、ページ単位の遅延読み込み（コード分割）を Phase 2 で導入。
- 複数組織の切り替えUI（現状は最初の所属組織を使用）。
- メンバー招待・ロール変更の画面（現状はSupabaseダッシュボードとSQLで操作）。
- CSVインポートの検証（Phase 2）。

## セキュリティ上の対策

- 全テーブルでRLSを有効化（`force`）、未ログインからの権限をすべて取り消し。
- 権限判定関数は `security definer` + `search_path` 固定 + API非公開スキーマ。
- 複合外部キーで組織間のデータ混在を防止。
- 個人情報は別テーブル・admin以上のみ。生徒は呼び名と学年のみ。
- フロントエンドにシークレットキーが設定されたら起動時に拒否。
- 招待制（新規登録無効）、メールリンクで未登録ユーザーを作らない。
- 認証エラーの詳細を画面に出さない（日本語の定型メッセージに変換）。
- CSPなどのセキュリティヘッダー（`public/_headers`）、`noindex`。
- CSV出力の式インジェクション対策。
- AIログは更新・削除不可（監査証跡）。

## 次の開発フェーズ（Phase 2: SNS運用）

1. SNSアカウント・投稿の登録フォーム（短時間で入力できる設計）
2. 実績の記録フォーム（記録時点・指標ごとの状態を選択）
3. 投稿一覧・投稿詳細（成長推移グラフ）
4. Content Planner（カンバン・カレンダー、企画と投稿の紐づけ、振り返り）
5. CSVインポート（検証付き）・エクスポート
6. SNSダッシュボード（テーマ別・形式別・時間帯別・プラットフォーム別、n と欠損を併記）
