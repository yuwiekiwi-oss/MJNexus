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

-- 投稿 × 指標 の「最新の記録」
--   実績は累積値なので、合計すると二重計上になる。
--   投稿ごと・指標ごとに最新の記録1件だけを取り出す（ウィンドウ関数 row_number）。
create view public.social_post_latest_metric_values
with (security_invoker = true) as
with ranked as (
  select
    s.organization_id,
    s.post_id,
    s.id          as snapshot_id,
    s.recorded_at,
    v.metric,
    v.status,
    v.value,
    row_number() over (
      partition by s.post_id, v.metric
      order by s.recorded_at desc
    ) as rn
  from public.social_post_metrics s
  join public.social_post_metric_values v on v.snapshot_id = s.id
)
select
  r.organization_id,
  r.post_id,
  r.snapshot_id,
  r.recorded_at,
  r.metric,
  r.status,
  r.value,
  -- 公開から何時間後の記録か（24h / 72h / 7日後比較の基礎）
  round(extract(epoch from (r.recorded_at - p.published_at)) / 3600.0, 1) as hours_since_publish
from ranked r
join public.social_posts p on p.id = r.post_id
where r.rn = 1;

grant select on public.marketing_costs to authenticated;
grant select on public.social_post_latest_metric_values to authenticated;
revoke all on public.marketing_costs from anon;
revoke all on public.social_post_latest_metric_values from anon;
