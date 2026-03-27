# Google Maps API Key Setup Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Google Maps API Key Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_KEY = "AIzaSyAYunRwU6ZASnx640BIVymHqtUEnh0aPKk"
$SUPABASE_URL = "https://wgolkcztdrwdphwjvqxt.supabase.co"

Write-Host "API Key: " -NoNewline -ForegroundColor Yellow
Write-Host $API_KEY -ForegroundColor Green
Write-Host ""

# SQL Script
$sql = @"
-- Add Google Maps API Key to Supabase
DELETE FROM app_settings WHERE key = 'google_maps_api_key';

INSERT INTO app_settings (key, value, description)
VALUES (
  'google_maps_api_key',
  '{"api_key": "$API_KEY"}'::jsonb,
  'Google Maps API Key - Maps JavaScript API, Directions API, Geocoding API, Static Maps API'
);

-- Verify insertion
SELECT * FROM app_settings WHERE key = 'google_maps_api_key';
"@

Write-Host "SQL Script to copy:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Gray
Write-Host $sql -ForegroundColor White
Write-Host "========================================" -ForegroundColor Gray
Write-Host ""

# Copy to clipboard
$sql | Set-Clipboard

Write-Host "SUCCESS: SQL copied to clipboard!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open Supabase Dashboard: $SUPABASE_URL" -ForegroundColor White
Write-Host "2. Go to SQL Editor" -ForegroundColor White
Write-Host "3. Paste the SQL (Ctrl+V)" -ForegroundColor White
Write-Host "4. Click Run" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Read-Host "Press Enter to exit"
