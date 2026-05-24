import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Map, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface MapSettings {
  provider: 'mapbox' | 'google';
  google_maps_configured: boolean;
}

interface MapSettingsTabProps {
  onSettingsChange: (settings: MapSettings) => void;
}

const MapSettingsTab = ({ onSettingsChange }: MapSettingsTabProps) => {
  const [googleStatus, setGoogleStatus] = useState<'checking' | 'connected' | 'not_configured' | 'error'>('checking');
  const [testing, setTesting] = useState(false);

  const checkGoogleMaps = async () => {
    setGoogleStatus('checking');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-maps-proxy?action=check`
      );
      const data = await response.json();
      if (data.configured) {
        setGoogleStatus('connected');
        onSettingsChange({ provider: 'google', google_maps_configured: true });
      } else {
        setGoogleStatus('not_configured');
        onSettingsChange({ provider: 'google', google_maps_configured: false });
      }
    } catch {
      setGoogleStatus('error');
      onSettingsChange({ provider: 'google', google_maps_configured: false });
    }
  };

  useEffect(() => {
    checkGoogleMaps();
  }, []);

  const testConnection = async () => {
    setTesting(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-maps-proxy?action=reverse-geocode&lat=33.4262&lng=43.2954`
      );
      const data = await response.json();
      if (data.error) {
        toast.error(`Google Maps: ${data.error}`);
        setGoogleStatus(data.configured === false ? 'not_configured' : 'error');
      } else if (data.features && data.features.length > 0) {
        toast.success('Google Maps يعمل بشكل صحيح');
        setGoogleStatus('connected');
        onSettingsChange({ provider: 'google', google_maps_configured: true });
      }
    } catch {
      toast.error('خطأ في اختبار Google Maps');
      setGoogleStatus('error');
    } finally {
      setTesting(false);
    }
  };

  const getStatusBadge = (status: typeof googleStatus) => {
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
        <CardDescription>التطبيق يستخدم Google Maps حصراً لجميع خدمات الخرائط</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Google Maps Status */}
        <div className={`flex items-center justify-between p-4 rounded-lg border ${googleStatus === 'connected' ? 'border-green-500 bg-green-500/5' : 'border-border'}`}>
          <div className="flex items-center gap-3">
            <img src="https://maps.gstatic.com/mapfiles/api-3/images/google_gray.svg" alt="Google Maps" className="w-6 h-6" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <p className="font-medium">Google Maps API</p>
              <p className="text-sm text-muted-foreground">Maps JS · Geocoding · Places · Directions · Static Maps</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(googleStatus)}
            <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'اختبار'}
            </Button>
          </div>
        </div>

        {/* Refresh Button */}
        <div className="flex justify-end">
          <Button variant="outline" onClick={checkGoogleMaps} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            إعادة الفحص
          </Button>
        </div>

        {/* Setup Instructions (shown when not configured) */}
        {googleStatus !== 'connected' && (
          <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">إعداد Google Maps API</h4>
            <ol className="text-sm text-amber-700 dark:text-amber-300 space-y-1.5 list-decimal list-inside">
              <li>افتح <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
              <li>فعّل: Maps JavaScript API · Geocoding API · Places API · Directions API · Maps Static API</li>
              <li>أنشئ مفتاح API من صفحة Credentials</li>
              <li>
                أضف المفتاح في متغير البيئة:
                <code className="block mt-1 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded text-xs font-mono">VITE_GOOGLE_MAPS_API_KEY=AIza...</code>
              </li>
              <li>
                أو في Supabase Edge Functions Secrets:
                <code className="block mt-1 bg-amber-100 dark:bg-amber-900 px-2 py-1 rounded text-xs font-mono">GOOGLE_MAPS_API_KEY=AIza...</code>
              </li>
            </ol>
            <div className="flex gap-3 mt-3 flex-wrap">
              <a
                href="https://supabase.com/dashboard/project/wgolkcztdrwdphwjvqxt/settings/functions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                فتح Supabase Secrets ←
              </a>
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary hover:underline"
              >
                فتح Google Credentials ←
              </a>
            </div>
          </div>
        )}

        {/* Env var hint when connected */}
        {googleStatus === 'connected' && (
          <div className="p-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
            <p className="text-sm text-green-700 dark:text-green-300">
              Google Maps متصل ويعمل بشكل صحيح. جميع شاشات الخريطة تستخدم Google Maps.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MapSettingsTab;
