-- ════════════════════════════════════════════════════════════════════════════
-- Phase 3 Dispatch v2 — Performance Benchmark
-- Date: 2026-04-20
-- Purpose: Compare v1 (basic distance scoring) vs v2 (multi-factor scoring)
-- Run AFTER `phase3_reactivate_v2.sql` to ensure v2 is active.
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Current dispatch version
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'CURRENT_VERSION' AS metric,
  value->>'dispatch_version' AS dispatch_version,
  value->>'max_radius_km' AS max_radius_km,
  value->>'weight_distance' AS weight_distance,
  value->>'weight_rating' AS weight_rating,
  value->>'weight_acceptance_rate' AS weight_acceptance_rate,
  value->>'weight_completion_rate' AS weight_completion_rate
FROM app_settings
WHERE key = 'matching_settings';

-- ────────────────────────────────────────────────────────────────────────────
-- 2. ride_matching_log activity in last 7 days (v2 telemetry)
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'MATCHING_LOG_7D' AS metric,
  COUNT(*) AS total_attempts,
  COUNT(DISTINCT ride_id) AS unique_rides,
  COUNT(DISTINCT driver_id) AS unique_drivers,
  ROUND(AVG((metadata->>'score')::numeric)::numeric, 3) AS avg_score,
  ROUND(AVG((metadata->>'distance_km')::numeric)::numeric, 2) AS avg_distance_km,
  ROUND(AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (PARTITION BY ride_id ORDER BY created_at))))::numeric, 2) AS avg_seconds_between_attempts
FROM ride_matching_log
WHERE created_at > NOW() - INTERVAL '7 days';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Driver matching stats distribution
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'DRIVER_STATS_DIST' AS metric,
  COUNT(*) AS total_drivers,
  ROUND(AVG(acceptance_rate)::numeric, 3) AS avg_acceptance,
  ROUND(AVG(completion_rate)::numeric, 3) AS avg_completion,
  ROUND(AVG(avg_rating)::numeric, 2) AS avg_rating,
  ROUND(MIN(acceptance_rate)::numeric, 3) AS min_acceptance,
  ROUND(MAX(acceptance_rate)::numeric, 3) AS max_acceptance
FROM driver_matching_stats;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. directions_cache utilization
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'CACHE_UTIL' AS metric,
  COUNT(*) AS total_entries,
  pg_size_pretty(pg_total_relation_size('directions_cache')) AS table_size,
  ROUND(AVG(hit_count)::numeric, 2) AS avg_hits_per_entry,
  MAX(hit_count) AS max_hits,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS new_entries_24h,
  COUNT(*) FILTER (WHERE last_accessed > NOW() - INTERVAL '1 hour') AS active_entries_1h
FROM directions_cache;

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Match success rate (rides matched within first 30 seconds)
-- ────────────────────────────────────────────────────────────────────────────
WITH ride_outcomes AS (
  SELECT
    r.id,
    r.created_at AS ride_created,
    MIN(rml.created_at) AS first_match_attempt,
    r.driver_id,
    r.status,
    EXTRACT(EPOCH FROM (MIN(rml.created_at) - r.created_at)) AS seconds_to_first_match
  FROM rides r
  LEFT JOIN ride_matching_log rml ON rml.ride_id = r.id
  WHERE r.created_at > NOW() - INTERVAL '7 days'
  GROUP BY r.id
)
SELECT
  'MATCH_PERFORMANCE_7D' AS metric,
  COUNT(*) AS total_rides,
  COUNT(*) FILTER (WHERE driver_id IS NOT NULL) AS rides_with_driver,
  ROUND(100.0 * COUNT(*) FILTER (WHERE driver_id IS NOT NULL) / NULLIF(COUNT(*), 0), 2) AS match_rate_pct,
  ROUND(AVG(seconds_to_first_match)::numeric, 2) AS avg_seconds_to_first_attempt,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY seconds_to_first_match)::numeric, 2) AS median_seconds,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY seconds_to_first_match)::numeric, 2) AS p95_seconds
FROM ride_outcomes;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Top scoring drivers (composite score from v2)
-- ────────────────────────────────────────────────────────────────────────────
SELECT
  'TOP_DRIVERS' AS metric,
  driver_id,
  acceptance_rate,
  completion_rate,
  avg_rating,
  total_rides,
  -- Composite score (matches v2 weights from app_settings)
  ROUND(
    (acceptance_rate * 0.30 + completion_rate * 0.20 + (avg_rating / 5.0) * 0.20)::numeric,
    3
  ) AS composite_quality_score
FROM driver_matching_stats
WHERE total_rides >= 5
ORDER BY composite_quality_score DESC
LIMIT 10;
