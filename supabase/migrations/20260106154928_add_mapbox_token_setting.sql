-- Add Mapbox token setting
INSERT INTO app_settings (key, value, description)
VALUES ('mapbox_token', 'pk.eyJ1IjoicmFhbmFpIiwiYSI6ImNtajQxYjQ1YzB3M3ozZnM0bW9xaDB2eXgifQ.k9lvJOuDjRHL198DEb9YVw', 'Mapbox API token for maps and geocoding')
ON CONFLICT (key) DO NOTHING;