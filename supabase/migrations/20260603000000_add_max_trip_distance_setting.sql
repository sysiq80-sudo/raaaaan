-- Admin-controlled maximum trip distance for fare calculation.
-- RAAN allows zero-distance trips, but the upper bound should be operationally
-- controlled from AdminFareSettings instead of hard-coded in clients/functions.

INSERT INTO public.app_settings (key, value, description)
VALUES (
  'fare_calculation',
  jsonb_build_object(
    'service_fee_percentage', 5,
    'min_service_fee', 500,
    'max_trip_distance_km', 2000,
    'surge_pricing_enabled', true,
    'max_surge_multiplier', 2.0,
    'subscription_discounts_enabled', true,
    'tier_discounts_enabled', true
  ),
  'إعدادات حساب الأجرة والعمولات'
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings
SET value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('max_trip_distance_km', 2000)
WHERE key = 'fare_calculation'
  AND NOT (COALESCE(value, '{}'::jsonb) ? 'max_trip_distance_km');
