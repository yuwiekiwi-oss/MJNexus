-- =============================================================================
-- MJ Nexus — 基礎ビュー
--   security_invoker = true: ビューを呼び出したユーザーの権限でRLSを評価する
--   （これを付けないとビュー所有者の権限で実行され、RLSをすり抜けてしまう）
-- =============================================================================

-- マーケティング費用: expense_transactions の該当カテゴリのみを参照する
-- 別テーブルに二重入力しないことで、損益計算と集客単価で同じ数字を使える
create view public.marketing_costs
with (security_invoker = true) as
select
  e.id,
  e.organization_id,
  e.occurred_on,
  e.category,
  e.amount_jpy,
  e.channel_id,
  e.campaign_id,
  e.vendor,
  e.description
from public.expense_transactions e
where e.category in ('ad_spend', 'campaign', 'content_production');

grant select on public.marketing_costs to authenticated;
revoke all on public.marketing_costs from anon;
