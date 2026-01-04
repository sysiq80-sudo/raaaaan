import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Map, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface MapSettings {
  provider: 'mapbox' | 'google';
  google_maps_configured: boolean;
}

interface MapSettingsTabProps {
  onSettingsChange: (settings: MapSettings) => void;
}

const MapSettingsTab = ({ onSettingsChange }: MapSettingsTabProps) => {
  const [settings, setSettings] = useState<MapSettings>({
    provider: 'mapbox',
    google_maps_configured: false,
  });
  const [mapboxStatus, setMapboxStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'connected' | 'not_configured' | 'error'>('checking');
  const [testing, setTesting] = useState<'mapbox' | 'google' | null>(null);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maps')
          .single();

        if (!error && data?.value) {
          const value = data.value as Record<string, unknown>;
          setSettings({
            provider: (value.provider as 'mapbox' | 'google') || 'mapbox',
            google_maps_configured: Boolean(value.google_maps_configured),
          });
        }
      } catch (error) {
        console.error('Error loading map settings:', error);
      }
    };

    loadSettings();
    checkConnections();
  }, []);

  const checkConnections = async () => {
    // Check Mapbox
    setMapboxStatus('checking');
    try {
      const response = await fetch(
        'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token'
      );
      const data = await response.json();
      setMapboxStatus(data.token ? 'connected' : 'error');
    } catch {
      setMapboxStatus('error');
    }

    // Check Google Maps
    setGoogleStatus('checking');
    try {
      const response = await fetch(
        'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/google-maps-proxy?action=check'
      );
      const data = await response.json();
      if (data.configured) {
        setGoogleStatus('connected');
        setSettings(prev => ({ ...prev, google_maps_configured: true }));
      } else {
        setGoogleStatus('not_configured');
      }
    } catch {
      setGoogleStatus('error');
    }
  };

  const testConnection = async (provider: 'mapbox' | 'google') => {
    setTesting(provider);
    try {
      if (provider === 'mapbox') {
        const response = await fetch(
          'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=reverse-geocode&lat=33.4262&lng=43.2954'
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          toast.success('Mapbox يعمل بشكل صحيح');
          setMapboxStatus('connected');
        } else {
          toast.error('Mapbox: لا توجد نتائج');
          setMapboxStatus('error');
        }
      } else {
        const response = await fetch(
          'https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/google-maps-proxy?action=reverse-geocode&lat=33.4262&lng=43.2954'
        );
        const data = await response.json();
        if (data.error) {
          toast.error(`Google Maps: ${data.error}`);
          setGoogleStatus(data.configured === false ? 'not_configured' : 'error');
        } else if (data.features && data.features.length > 0) {
          toast.success('Google Maps يعمل بشكل صحيح');
          setGoogleStatus('connected');
          setSettings(prev => ({ ...prev, google_maps_configured: true }));
        }
      }
    } catch (error) {
      toast.error(`خطأ في اختبار ${provider === 'mapbox' ? 'Mapbox' : 'Google Maps'}`);
    } finally {
      setTesting(null);
    }
  };

  const handleProviderChange = (provider: 'mapbox' | 'google') => {
    // Don't allow switching to Google if not configured
    if (provider === 'google' && googleStatus !== 'connected') {
      toast.error('يجب إضافة مفتاح Google Maps API أولاً');
      return;
    }
    
    const newSettings = { ...settings, provider };
    setSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const getStatusBadge = (status: 'checking' | 'connected' | 'not_configured' | 'error') => {
    switch (status) {
      case 'checking':
        return <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />جاري الفحص</Badge>;
      case 'connected':
        return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle2 className="w-3 h-3" />متصل</Badge>;
      case 'not_configured':
        return <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3" />غير مُعد</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />خطأ</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Map className="w-5 h-5" />
          إعدادات الخرائط
        </CardTitle>
        <CardDescription>اختر مزود الخرائط المستخدم في التطبيق</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-4">
          <Label>مزود الخرائط الحالي</Label>
          <RadioGroup
            value={settings.provider}
            onValueChange={(value) => handleProviderChange(value as 'mapbox' | 'google')}
            className="space-y-3"
          >
            {/* Mapbox Option */}
            <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${settings.provider === 'mapbox' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="mapbox" id="mapbox" />
                <div>
                  <Label htmlFor="mapbox" className="font-medium cursor-pointer">Mapbox</Label>
                  <p className="text-sm text-muted-foreground">خرائط سريعة مع تصميم داكن جميل</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(mapboxStatus)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('mapbox')}
                  disabled={testing === 'mapbox'}
                >
                  {testing === 'mapbox' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'اختبار'}
                </Button>
              </div>
            </div>

            {/* Google Maps Option */}
            <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${settings.provider === 'google' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3">
                <RadioGroupItem 
                  value="google" 
                  id="google" 
                  disabled={googleStatus !== 'connected'}
                />
                <div>
                  <Label htmlFor="google" className={`font-medium ${googleStatus !== 'connected' ? 'text-muted-foreground' : 'cursor-pointer'}`}>
                    Google Maps
                  </Label>
                  <p className="text-sm text-muted-foreground">خرائط Google الرسمية مع Street View</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(googleStatus)}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testConnection('google')}
                  disabled={testing === 'google' || googleStatus === 'not_configured'}
                >
                  {testing === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'اختبار'}
                </Button>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Refresh Connections Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={checkConnections} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            إعادة فحص الاتصالات
          </Button>
        </div>

        {/* Google Maps Setup Instructions */}
        {googleStatus !== 'connected' && (
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">إعداد Google Maps</h4>
            <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-decimal list-inside">
              <li>اذهب إلى <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
              <li>أنشئ مشروع جديد أو اختر مشروع موجود</li>
              <li>فعّل APIs التالية: Maps JavaScript API, Directions API, Geocoding API, Places API</li>
              <li>أنشئ مفتاح API من صفحة Credentials</li>
              <li>أضف المفتاح في إعدادات Supabase Edge Functions Secrets باسم: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">GOOGLE_MAPS_API_KEY</code></li>
            </ol>
            <a 
              href="https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/settings/functions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm font-medium text-primary hover:underline"
            >
              فتح إعدادات Edge Functions Secrets ←
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MapSettingsTab;
