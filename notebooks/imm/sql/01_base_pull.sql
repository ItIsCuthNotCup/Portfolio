-- IMM Lab — base data pull
-- Resolves the 104-week panel from the BigQuery dataset, joining the
-- weekly fact tables to the dimension tables and the controls table.
-- Sunday-anchored ISO weeks. All channels left-joined so weeks with zero
-- spend on a channel still appear (zero-spend weeks are signal, not noise).

SELECT
  d.iso_week,
  d.year_week,
  rev.gross_revenue,
  rev.units_sold,
  SUM(IF(s.channel = 'tiktok_creator',    s.spend, 0)) AS tiktok_creator_spend,
  SUM(IF(s.channel = 'instagram_creator', s.spend, 0)) AS instagram_creator_spend,
  SUM(IF(s.channel = 'youtube_creator',   s.spend, 0)) AS youtube_creator_spend,
  SUM(IF(s.channel = 'meta_paid',         s.spend, 0)) AS meta_paid_spend,
  SUM(IF(s.channel = 'tiktok_paid',       s.spend, 0)) AS tiktok_paid_spend,
  SUM(IF(s.channel = 'paid_search',       s.spend, 0)) AS paid_search_spend,
  SUM(IF(s.channel = 'programmatic',      s.spend, 0)) AS programmatic_spend,
  SUM(IF(s.channel = 'retail_media',      s.spend, 0)) AS retail_media_spend,
  ctrl.competitor_idx,
  ctrl.price_discount_active,
  ctrl.holiday_label
FROM      `{PROJECT}.{DATASET}.dim_week`             d
LEFT JOIN `{PROJECT}.{DATASET}.fct_revenue_weekly`   rev   USING (iso_week)
LEFT JOIN `{PROJECT}.{DATASET}.fct_channel_spend_wk` s     USING (iso_week)
LEFT JOIN `{PROJECT}.{DATASET}.dim_controls`         ctrl  USING (iso_week)
WHERE     d.iso_week BETWEEN '2024-01-01' AND '2025-12-28'
GROUP BY  d.iso_week, d.year_week, rev.gross_revenue, rev.units_sold,
          ctrl.competitor_idx, ctrl.price_discount_active, ctrl.holiday_label
ORDER BY  d.iso_week;
