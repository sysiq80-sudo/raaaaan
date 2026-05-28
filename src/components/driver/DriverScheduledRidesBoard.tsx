import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, MapPin, Users, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import ScheduledRideConfirmationDialog from '@/components/driver/ScheduledRideConfirmationDialog';

interface ScheduledRide {
  id: string;
  scheduled_at: string;
  pickup_address: string;
  dropoff_address: string;
  trip_type: 'one_way' | 'round_trip';
  return_at?: string;
  stops?: any[];
  status: 'scheduled' | 'reserved' | 'confirmed' | 'processing' | 'cancelled' | 'expired';
  prefer_women_driver?: boolean;
  high_priority?: boolean;
  estimated_fare?: number;
  rider_id: string;
  driver_id?: string;
  accepted_at?: string;
  driver_confirmed_at?: string;
  group_id?: string;
  notes?: string;
}

export default function DriverScheduledRidesBoard() {
  const [selectedRide, setSelectedRide] = useState<ScheduledRide | null>(null);
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // جلب الرحلات المجدولة المتاحة
  const { data: availableRides, isLoading: loadingAvailable } = useQuery({
    queryKey: ['available_scheduled_rides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_rides')
        .select('*')
        .eq('status', 'scheduled')
        .is('driver_id', null)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(50);

      if (error) throw error;
      return (data || []) as ScheduledRide[];
    },
    refetchInterval: 30000, // 30 ثانية — الرحلات المجدولة لا تتغير بسرعة
  });

  // جلب الرحلات المحجوزة من قبل السائق الحالي
  const { data: myScheduledRides, isLoading: loadingMy } = useQuery({
    queryKey: ['my_scheduled_rides'],
    queryFn: async () => {
      const { data: driverData } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();

      if (!driverData) return [];

      const { data, error } = await supabase
        .from('scheduled_rides')
        .select('*')
        .eq('driver_id', driverData.id)
        .in('status', ['reserved', 'confirmed', 'processing'])
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return (data || []) as ScheduledRide[];
    },
    refetchInterval: 30000,
  });

  const handleAcceptRide = async (ride: ScheduledRide) => {
    setSelectedRide(ride);
    setShowConfirmationDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: any; color: string }> = {
      scheduled: { label: 'متاح', variant: 'secondary', color: 'bg-blue-100' },
      reserved: { label: 'مع سائق', variant: 'outline', color: 'bg-yellow-100' },
      confirmed: { label: 'مؤكد', variant: 'default', color: 'bg-green-100' },
      processing: { label: 'جاري', variant: 'default', color: 'bg-purple-100' },
      cancelled: { label: 'ملغى', variant: 'destructive', color: 'bg-red-100' },
      expired: { label: 'انتهى', variant: 'secondary', color: 'bg-gray-100' },
    };

    const config = statusConfig[status] || statusConfig.scheduled;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRideTypeLabel = (tripType: string) => {
    return tripType === 'round_trip' ? '🔄 ذهاب وإياب' : '→ ذهاب فقط';
  };

  const formatScheduleTime = (date: string) => {
    try {
      return format(new Date(date), 'EEEE، d MMMM HH:mm', { locale: ar });
    } catch {
      return date;
    }
  };

  if (loadingAvailable && loadingMy) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const rides = filterStatus === 'available' ? availableRides || [] : myScheduledRides || [];

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">الرحلات المجدولة</h1>
        <p className="text-sm text-gray-600">
          إدارة الحجوزات المجدولة والمؤكدة
        </p>
      </div>

      {/* Tabs/Filters */}
      <div className="flex gap-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('all')}
          className="rounded-full"
        >
          رحلاتي ({myScheduledRides?.length || 0})
        </Button>
        <Button
          variant={filterStatus === 'available' ? 'default' : 'outline'}
          onClick={() => setFilterStatus('available')}
          className="rounded-full"
        >
          متاح ({availableRides?.length || 0})
        </Button>
      </div>

      {/* Rides List */}
      <div className="space-y-3">
        {rides.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-600 text-center">
                لا توجد رحلات {filterStatus === 'available' ? 'متاحة' : 'محجوزة'} حالياً
              </p>
            </CardContent>
          </Card>
        ) : (
          rides.map((ride) => (
            <Card key={ride.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">
                        {getRideTypeLabel(ride.trip_type)}
                      </h3>
                      {ride.high_priority && (
                        <Badge variant="destructive" className="text-xs">
                          ⚡ أولوية
                        </Badge>
                      )}
                      {ride.prefer_women_driver && (
                        <Badge variant="outline" className="text-xs">
                          👩 نسائي
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {ride.id.substring(0, 8)}
                    </p>
                  </div>
                  {getStatusBadge(ride.status)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Location Info */}
                <div className="space-y-2">
                  <div className="flex gap-3">
                    <MapPin className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">انطلاق</p>
                      <p className="text-sm font-medium">{ride.pickup_address}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <MapPin className="h-4 w-4 text-red-600 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">وجهة</p>
                      <p className="text-sm font-medium">{ride.dropoff_address}</p>
                    </div>
                  </div>

                  {/* Stops */}
                  {ride.stops && ride.stops.length > 0 && (
                    <div className="mt-2 ml-3 pl-3 border-l-2 border-blue-200">
                      <p className="text-xs text-gray-500 mb-1">محطات إضافية:</p>
                      <ul className="space-y-1">
                        {ride.stops.map((stop: any, idx: number) => (
                          <li key={idx} className="text-sm text-blue-600">
                            • {stop.address || stop.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Schedule Time */}
                <div className="flex gap-3">
                  <Clock className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-500">موعد الرحلة</p>
                    <p className="text-sm font-medium">
                      {formatScheduleTime(ride.scheduled_at)}
                    </p>
                    {ride.return_at && ride.trip_type === 'round_trip' && (
                      <p className="text-xs text-gray-600 mt-1">
                        ← العودة: {formatScheduleTime(ride.return_at)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fare Info */}
                {ride.estimated_fare && (
                  <div className="flex gap-3">
                    <Badge variant="outline" className="text-green-600">
                      {ride.estimated_fare.toFixed(0)} د.ع
                    </Badge>
                  </div>
                )}

                {/* Notes */}
                {ride.notes && (
                  <div className="bg-blue-50 p-2 rounded text-xs text-blue-900">
                    <strong>ملاحظات:</strong> {ride.notes}
                  </div>
                )}

                {/* Status Info */}
                <div className="flex gap-2 text-xs text-gray-600">
                  {ride.accepted_at && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      قبلت: {format(new Date(ride.accepted_at), 'HH:mm')}
                    </span>
                  )}
                  {ride.driver_confirmed_at && (
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      تأكيد: {format(new Date(ride.driver_confirmed_at), 'HH:mm')}
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  {ride.status === 'scheduled' && !ride.driver_id && (
                    <Button
                      onClick={() => handleAcceptRide(ride)}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      ✓ قبول الرحلة
                    </Button>
                  )}
                  {ride.status === 'reserved' && ride.driver_id && (
                    <Button
                      onClick={() => {
                        setSelectedRide(ride);
                        setShowConfirmationDialog(true);
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      ✓ تأكيد الجاهزية
                    </Button>
                  )}
                  {(ride.status === 'reserved' || ride.status === 'confirmed') && (
                    <Button
                      variant="outline"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    >
                      ✕ إلغاء
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Confirmation Dialog */}
      {selectedRide && (
        <ScheduledRideConfirmationDialog
          ride={selectedRide}
          open={showConfirmationDialog}
          onOpenChange={setShowConfirmationDialog}
          onSuccess={() => {
            setSelectedRide(null);
            setShowConfirmationDialog(false);
          }}
        />
      )}
    </div>
  );
}
