/**
 * صفحة مراقبة الرحلات المتوقفة - Admin Stopped Rides
 * عرض الرحلات التي تم اكتشاف توقفها لفترة طويلة
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  MapPin,
  Clock,
  Phone,
  RefreshCw,
  Loader2,
  Navigation,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface StoppedRide {
  id: string;
  ride_id: string;
  rider_id: string;
  driver_id: string;
  alert_level: 'warning' | 'critical';
  rider_last_update: string;
  driver_last_update: string;
  calculated_distance_meters: number;
  created_at: string;
  resolved_at: string | null;
  rides: {
    pickup_address: string;
    dropoff_address: string;
    status: string;
    driver_location: { lat: number; lng: number } | null;
    rider_location: { lat: number; lng: number } | null;
    rider_id: string;
    driver_id: string;
    rider?: { full_name: string; phone: string };
    driver?: { full_name: string; phone: string };
  };
}

const AdminStoppedRides = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  useAdminAuth();

  const fetchStoppedRides = async () => {
    const { data, error } = await supabase
      .from('dual_stop_alerts')
      .select(`
        *,
        rides!inner (
          pickup_address,
          dropoff_address,
          status,
          driver_location,
          rider_location,
          rider_id,
          driver_id
        )
      `)
      .is('resolved_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    let alertsData: any[] = data || [];

    const riderIds = Array.from(
      new Set(alertsData.map(a => a.rides?.rider_id).filter(Boolean))
    ) as string[];
    const driverIds = Array.from(
      new Set(alertsData.map(a => a.rides?.driver_id).filter(Boolean))
    ) as string[];

    if (riderIds.length || driverIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id,full_name,phone')
        .in('user_id', [...riderIds, ...driverIds]);
      const profileMap: Record<string, { full_name: string; phone: string }> = {};
      (profiles || []).forEach(p => {
        if (p.user_id) profileMap[p.user_id] = { full_name: p.full_name, phone: p.phone };
        });

        alertsData = alertsData.map(a => {
          const r = a.rides || {};
          return {
            ...a,
            rides: {
              ...r,
              rider: profileMap[r.rider_id] || undefined,
              driver: profileMap[r.driver_id] || undefined,
            },
          };
        });
      }

      return alertsData as StoppedRide[];
  };

  const { data: alerts = [], isLoading: loading } = useQuery({
    queryKey: ["stopped-rides"],
    queryFn: fetchStoppedRides,
  });

  // Realtime subscription
  useEffect(() => {
    const subscription = supabase
      .channel('stopped_rides_admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dual_stop_alerts',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["stopped-rides"] });
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const handleRefresh = () => {
    setRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ["stopped-rides"] }).then(() => setRefreshing(false));
  };

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase
        .from('dual_stop_alerts')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "تم وضع علامة حل",
        description: "تم وضع علامة على الإشعار كمحلول",
      });
      queryClient.invalidateQueries({ queryKey: ["stopped-rides"] });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResolve = (alertId: string) => {
    resolveMutation.mutate(alertId);
  };

  const getStopDuration = (lastUpdate: string) => {
    const minutes = Math.floor((Date.now() - new Date(lastUpdate).getTime()) / 60000);
    return `${minutes} دقيقة`;
  };

  const AlertCard = ({ alert }: { alert: StoppedRide }) => {
    const isCritical = alert.alert_level === 'critical';
    
    return (
      <Card className={`${isCritical ? 'border-red-500 border-2' : 'border-yellow-500 border'}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant={isCritical ? "destructive" : "default"}
                  className={`${isCritical ? 'animate-pulse bg-red-500' : 'bg-yellow-500'}`}
                >
                  {isCritical ? (
                    <>
                      <AlertTriangle className="w-3 h-3 ml-1" />
                      حرج - +10 دقائق
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 ml-1" />
                      تحذير - +5 دقائق
                    </>
                  )}
                </Badge>
                <Badge variant="outline">
                  {alert.rides.status}
                </Badge>
              </div>
              <CardTitle className="text-lg">
                رحلة متوقفة - {alert.ride_id.substring(0, 8)}
              </CardTitle>
            </div>
            <div className="text-left text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(alert.created_at), {
                addSuffix: true,
                locale: ar,
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* معلومات الموقع */}
          <div className="grid gap-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-1 mb-1">
                <MapPin className="w-4 h-4" />
                المسافة بين الطرفين
              </p>
              <p className="text-sm text-muted-foreground">
                {alert.calculated_distance_meters} متر
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-1">مدة التوقف</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">الراكب:</span>
                  <span className="font-medium mr-1">
                    {getStopDuration(alert.rider_last_update)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">السائق:</span>
                  <span className="font-medium mr-1">
                    {getStopDuration(alert.driver_last_update)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* معلومات الاتصال */}
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">معلومات الاتصال:</p>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    الراكب: {alert.rides.rider?.full_name || 'غير معروف'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {alert.rides.rider?.phone || ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => alert.rides.rider?.phone && window.open(`tel:${alert.rides.rider.phone}`)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    السائق: {alert.rides.driver?.full_name || 'غير معروف'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {alert.rides.driver?.phone || ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => alert.rides.driver?.phone && window.open(`tel:${alert.rides.driver.phone}`)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* معلومات الرحلة */}
          <div className="border-t pt-3">
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">من:</span>
                <p className="font-medium">{alert.rides.pickup_address}</p>
              </div>
              <div>
                <span className="text-muted-foreground">إلى:</span>
                <p className="font-medium">{alert.rides.dropoff_address}</p>
              </div>
            </div>
          </div>

          {/* الإجراءات */}
          <div className="flex gap-2 pt-2">
            {alert.rides.driver_location && alert.rides.rider_location && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `https://www.google.com/maps/dir/${alert.rides.driver_location.lat},${alert.rides.driver_location.lng}/${alert.rides.rider_location.lat},${alert.rides.rider_location.lng}`;
                  window.open(url, '_blank');
                }}
                className="flex-1"
              >
                <Navigation className="w-4 h-4 ml-1" />
                عرض على الخريطة
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => handleResolve(alert.id)}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 ml-1" />
              تم الحل
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout title="الرحلات المتوقفة" subtitle="مراقبة الرحلات التي توقفت لفترة طويلة">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">الرحلات المتوقفة</h1>
            <p className="text-muted-foreground">
              مراقبة الرحلات التي توقفت لفترة طويلة
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 ml-2" />
            )}
            تحديث
          </Button>
        </div>

        {/* الإحصائيات */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">إجمالي الإشعارات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alerts.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">تحذيرات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {alerts.filter(a => a.alert_level === 'warning').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">حرجة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">
                {alerts.filter(a => a.alert_level === 'critical').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* قائمة الإشعارات */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                لا توجد رحلات متوقفة حالياً
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                سيتم عرض الرحلات التي توقفت لأكثر من 5 دقائق هنا
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStoppedRides;
