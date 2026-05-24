-- Add Google Maps API Key to app_settings
-- This migration adds the Google Maps API key required for the Maps JavaScript API

-- Remove any existing Google Maps key
DELETE FROM app_settings WHERE key = 'google_maps_api_key';

-- Add the new Google Maps API key
INSERT INTO app_settings (key, value, description)
VALUES (
  'google_maps_api_key',
  '{"api_key": "AIzaSyAYunRwU6ZASnx640BIVymHqtUEnh0aPKk", "type": "Maps JavaScript API", "created_date": "2026-02-10"}'::jsonb,
  'Google Maps API Key - Used for Maps JavaScript API, Directions API, Geocoding API, and Static Maps API. Includes libraries: places, geocoding'
);

-- Verify the addition
SELECT * FROM app_settings WHERE key = 'google_maps_api_key';
