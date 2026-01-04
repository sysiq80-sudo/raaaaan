import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, X, Car, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ScheduledRide {
  id: string;
  pickup_address: string;
  dropoff_address: string;
  pickup_location: unknown;
  dropoff_location: unknown;
  scheduled_at: string;
  vehicle_type: string;
  estimated_fare: number;
  status: string;
}

const vehicleTypeLabels: Record<string, string> = {
  economy: 'اقتصادي',
  comfort: 'مريح',
  premium: 'فاخر',
  women_only: 'نسائي'
};

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { label: 'مجدول', variant: 'default' },
  processing: { label: 'قيد المعالجة', variant: 'secondary' },
  created: { label: 'تم إنشاء الرحلة', variant: 'outline' },
  cancelled: { label: 'ملغي', variant: 'destructive' },
  expired: { label: 'منتهي', variant: 'destructive' }
};

export function ScheduledRidesList() {
  const [scheduledRides, setScheduledRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRide, setEditingRide] = useState<ScheduledRide | null>(null);
  const [editForm, setEditForm] = useState({
    scheduled_at: '',
    pickup_address: '',
    dropoff_address: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchScheduledRides();

    const channel = supabase
      .channel('scheduled-rides-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_rides'
        },
        () => {
          fetchScheduledRides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchScheduledRides = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('scheduled_rides')
        .select('*')
        .eq('rider_id', user.id)
        .in('status', ['scheduled', 'processing'])
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setScheduledRides(data || []);
    } catch (error) {
      console.error('Error fetching scheduled rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelScheduledRide = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      // Direct update - remove the status filter to allow cancellation
      const { data, error } = await supabase
        .from('scheduled_rides')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('rider_id', user.id)
        .select();

      if (error) {
        console.error('Cancellation error:', error);
        toast.error('حدث خطأ في إلغاء الرحلة - ' + error.message);
        return;
      }

      if (!data || data.length === 0) {
        toast.error('لا يمكن إلغاء هذه الرحلة - تأكد من أنها رحلتك');
        return;
      }

      toast.success('تم إلغاء الرحلة المجدولة بنجاح');
      fetchScheduledRides();
    } catch (error: any) {
      console.error('Error cancelling scheduled ride:', error);
      toast.error(error.message || 'حدث خطأ في إلغاء الرحلة - حاول مرة أخرى');
    }
  };

  const openEditDialog = (ride: ScheduledRide) => {
    const scheduledDate = new Date(ride.scheduled_at);
    const localDateTime = format(scheduledDate, "yyyy-MM-dd'T'HH:mm");

    setEditForm({
      scheduled_at: localDateTime,
      pickup_address: ride.pickup_address,
      dropoff_address: ride.dropoff_address
    });
    setEditingRide(ride);
  };

  const saveEditedRide = async () => {
    if (!editingRide) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('يرجى تسجيل الدخول أولاً');
        return;
      }

      // Validate scheduled time is in the future
      const newScheduledAt = new Date(editForm.scheduled_at);
      if (newScheduledAt <= new Date()) {
        toast.error('يجب أن يكون وقت الرحلة في المستقبل');
        return;
      }

      const { data, error } = await supabase
        .from('scheduled_rides')
        .update({
          scheduled_at: newScheduledAt.toISOString(),
          pickup_address: editForm.pickup_address,
          dropoff_address: editForm.dropoff_address,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingRide.id)
        .eq('rider_id', user.id)
        .eq('status', 'scheduled')
        .select();

      if (error) {
        console.error('Edit error:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        toast.error('لا يمكن تعديل هذه الرحلة');
        return;
      }

      toast.success('تم تعديل الرحلة المجدولة بنجاح');
      setEditingRide(null);
      fetchScheduledRides();
    } catch (error) {
      console.error('Error editing scheduled ride:', error);
      toast.error('حدث خطأ في تعديل الرحلة');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scheduledRides.length === 0) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            الرحلات المجدولة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduledRides.map((ride) => (
            <div
              key={ride.id}
              className="border rounded-lg p-3 space-y-2 bg-muted/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {format(new Date(ride.scheduled_at), 'EEEE d MMMM - HH:mm', { locale: ar })}
                  </span>
                </div>
                <Badge variant={statusLabels[ride.status]?.variant || 'default'}>
                  {statusLabels[ride.status]?.label || ride.status}
                </Badge>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground line-clamp-1">{ride.pickup_address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                  <span className="text-muted-foreground line-clamp-1">{ride.dropoff_address}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    <Car className="h-3.5 w-3.5" />
                    {vehicleTypeLabels[ride.vehicle_type] || ride.vehicle_type}
                  </span>
                  <span className="font-medium text-primary">
                    {ride.estimated_fare?.toLocaleString()} د.ع
                  </span>
                </div>

                {['scheduled', 'processing'].includes(ride.status) && (
                  <div className="flex items-center gap-1">
                    {/* Edit Button */}
                    {ride.status === 'scheduled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary"
                        onClick={() => openEditDialog(ride)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Cancel Button */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <X className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>إلغاء الرحلة المجدولة؟</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من إلغاء هذه الرحلة المجدولة؟ لا يمكن التراجع عن هذا الإجراء.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row-reverse gap-2">
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => cancelScheduledRide(ride.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            تأكيد الإلغاء
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRide} onOpenChange={(open) => !open && setEditingRide(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الرحلة المجدولة</DialogTitle>
            <DialogDescription>
              يمكنك تغيير وقت الرحلة أو العناوين قبل موعدها
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Scheduled Time */}
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">وقت الرحلة</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={editForm.scheduled_at}
                onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_at: e.target.value }))}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                className="text-right"
              />
            </div>

            {/* Pickup Address */}
            <div className="space-y-2">
              <Label htmlFor="pickup_address">موقع الانطلاق</Label>
              <Input
                id="pickup_address"
                value={editForm.pickup_address}
                onChange={(e) => setEditForm(prev => ({ ...prev, pickup_address: e.target.value }))}
                placeholder="أدخل عنوان الانطلاق"
                className="text-right"
              />
            </div>

            {/* Dropoff Address */}
            <div className="space-y-2">
              <Label htmlFor="dropoff_address">موقع الوصول</Label>
              <Input
                id="dropoff_address"
                value={editForm.dropoff_address}
                onChange={(e) => setEditForm(prev => ({ ...prev, dropoff_address: e.target.value }))}
                placeholder="أدخل عنوان الوصول"
                className="text-right"
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setEditingRide(null)}>
              إلغاء
            </Button>
            <Button onClick={saveEditedRide} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
