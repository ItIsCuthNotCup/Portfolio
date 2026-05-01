-- IMM Lab — weekly feature engineering
-- Adds modeling features the MMM consumes:
--   * Cyclical seasonality (sin/cos of week-of-year — both encode periodicity
--     while being differentiable, which keeps NUTS happy)
--   * Holiday dummy (one-hot over a small named set of US retail peaks)
--   * 4-week trailing competitor pressure (smoother than weekly)
--   * Promo lag indicators (current week + 1-week-after, since promos
--     pull demand forward)

WITH base AS (
  SELECT * FROM `{PROJECT}.{DATASET}.weekly_panel`
)
SELECT
  iso_week,
  week_idx,
  revenue,
  -- Seasonality features
  SIN(2 * ACOS(-1) * (week_idx % 52) / 52.0) AS season_sin,
  COS(2 * ACOS(-1) * (week_idx % 52) / 52.0) AS season_cos,
  -- Holiday one-hot
  IF(holiday_label IS NOT NULL AND holiday_label != '', 1, 0) AS is_holiday,
  IF(holiday_label LIKE 'BFCM%', 1, 0)                         AS is_bfcm,
  IF(holiday_label = 'December peak', 1, 0)                    AS is_dec_peak,
  -- Smoothed competitor pressure
  AVG(competitor_idx) OVER (
    ORDER BY week_idx ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
  ) AS competitor_idx_4wk,
  -- Promo + 1-week lag
  price_discount,
  LAG(price_discount, 1) OVER (ORDER BY week_idx) AS price_discount_lag1,
  -- Channel spend (already wide)
  tiktok_creator_spend, instagram_creator_spend, youtube_creator_spend,
  meta_paid_spend, tiktok_paid_spend, paid_search_spend,
  programmatic_spend, retail_media_spend
FROM base
ORDER BY week_idx;
