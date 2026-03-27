import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type MapProvider = 'google'; // Google Maps only

interface MapSettings {
  provider: MapProvider;
  google_maps_configured: boolean;
}

const defaultSettings: MapSettings = {
  provider: 'google',
  google_maps_configured: true,
};

export const useMapProvider = () => {
  const [settings, setSettings] = useState<MapSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maps')
          .single();

        if (error) {
          // Setting doesn't exist yet, use defaults
          if (error.code === 'PGRST116') {
            setSettings(defaultSettings);
          } else {
            console.error('Error fetching map settings:', error);
          }
        } else if (data?.value) {
          const value = data.value as Record<string, unknown>;
          setSettings({
            provider: 'google', // Always use Google Maps
            google_maps_configured: Boolean(value.google_maps_configured),
          });
        }
      } catch (error) {
        console.error('Error fetching map settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('map_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.maps',
        },
        (payload) => {
          if (payload.new && 'value' in payload.new) {
            const value = payload.new.value as Record<string, unknown>;
            setSettings({
              provider: 'google', // Always use Google Maps
              google_maps_configured: Boolean(value.google_maps_configured),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    provider: settings.provider,
    isGoogleConfigured: settings.google_maps_configured,
    loading,
  };
};
