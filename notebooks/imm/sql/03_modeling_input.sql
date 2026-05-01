-- IMM Lab — modeling input
-- Final SELECT consumed by the Python training pipeline. Renames columns
-- to the canonical contract the Meridian model expects:
--   * one row per ISO week
--   * one column per channel spend (raw weekly $)
--   * controls block (seasonality, holidays, competitor, promo)
--   * outcome (revenue) as the last column for clarity

SELECT
  iso_week,
  week_idx,
  -- Outcome
  revenue,
  -- Channel spend (8 columns, sorted by category)
  tiktok_creator_spend     AS spend_tiktok_creator,
  instagram_creator_spend  AS spend_instagram_creator,
  youtube_creator_spend    AS spend_youtube_creator,
  meta_paid_spend          AS spend_meta_paid,
  tiktok_paid_spend        AS spend_tiktok_paid,
  paid_search_spend        AS spend_paid_search,
  programmatic_spend       AS spend_programmatic,
  retail_media_spend       AS spend_retail_media,
  -- Controls
  season_sin,
  season_cos,
  is_holiday,
  is_bfcm,
  is_dec_peak,
  competitor_idx_4wk,
  price_discount,
  price_discount_lag1
FROM `{PROJECT}.{DATASET}.v_weekly_features`
ORDER BY week_idx;
