import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle, Clock, MapPin, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

interface ScheduledRide {
  id: string;
  scheduled_at: string;
  pickup_address: string;
  dropoff_address: string;
  trip_type: 'one_way' | 'round_trip';
  return_at?: string;
  stops?: any[];
  status: string;
  prefer_women_driver?: boolean;
  high_priority?: boolean;
  estimated_fare?: number;
  rider_id: string;
  driver_id?: string;
  notes?: string;
  group_id?: string;
}

interface ScheduledRideConfirmationDialogProps {
  ride: ScheduledRide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ScheduledRideConfirmationDialog({
  ride,
  open,
  onOpenChange,
  onSuccess,
}: ScheduledRideConfirmationDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<'accept' | 'confirm' | 'cancel' | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const queryClient = useQueryClient();

  const handleAcceptRide = async () => {
    if (!agreedToTerms) {
      toast.error('يجب الموافقة على الشروط أولاً');
      return;
    }

    setIsLoading(true);
    try {
      // استدعاء الدالة المُعرّفة في Supabase
      const { data, error } = await supabase.rpc('accept_scheduled_ride', {
        p_scheduled_ride_id: ride.id,
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'فشل قبول الرحلة');
        return;
      }

      toast.success('✓ تم قبول الرحلة بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['available_scheduled_rides'] });
      queryClient.invalidateQueries({ queryKey: ['my_scheduled_rides'] });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error accepting ride:', err);
      toast.error(err.message || 'خطأ في قبول الرحلة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmRide = async () => {
    if (!agreedToTerms) {
      toast.error('يجب الموافقة على الشروط أولاً');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('confirm_scheduled_ride', {
        p_scheduled_ride_id: ride.id,
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'فشل تأكيد الرحلة');
        return;
      }

      toast.success('✓ تم تأكيد الجاهزية بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['my_scheduled_rides'] });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error confirming ride:', err);
      toast.error(err.message || 'خطأ في تأكيد الرحلة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في إلغاء الرحلة؟\nقد يترتب على ذلك رسوم إلغاء')) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('cancel_scheduled_ride_by_driver', {
        p_scheduled_ride_id: ride.id,
      });

      if (error) throw error;

      if (!data.success) {
        toast.error(data.error || 'فشل إلغاء الرحلة');
        return;
      }

      toast.success('✓ تم إلغاء الرحلة');
      queryClient.invalidateQueries({ queryKey: ['my_scheduled_rides'] });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error cancelling ride:', err);
      toast.error(err.message || 'خطأ في إلغاء الرحلة');
    } finally {
      setIsLoading(false);
    }
  };

  const timeUntilRide = () => {
    const rideTime = new Date(ride.scheduled_at);
    const now = new Date();
    const diffMs = rideTime.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours < 0) return 'انتهى الموعد';
    if (diffHours === 0) return `${diffMinutes} دقيقة`;
    return `${diffHours} ساعة و${diffMinutes} دقيقة`;
  };

  const isLateCancel = () => {
    const rideTime = new Date(ride.scheduled_at);
    const now = new Date();
    const diffMinutes = (rideTime.getTime() - now.getTime()) / (1000 * 60);
    return diffMinutes < 60;
  };

  const shouldShowAccept = ride.status === 'scheduled' && !ride.driver_id;
  const shouldShowConfirm = ride.status === 'reserved' && ride.driver_id;
  const shouldShowCancel = ['reserved', 'confirmed'].includes(ride.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {shouldShowAccept ? '✓ قبول الرحلة' : shouldShowConfirm ? '✓ تأكيد الجاهزية' : '✕ إلغاء الرحلة'}
          </DialogTitle>
          <DialogDescription>
            تفاصيل الرحلة المجدولة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ride Details */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            {/* Time */}
            <div className="flex gap-3">
              <Clock className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">موعد الرحلة</p>
                <p className="text-sm font-medium">
                  {format(new Date(ride.scheduled_at), 'EEEE، d MMMM HH:mm', { locale: ar })}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  ({timeUntilRide()})
                </p>
              </div>
            </div>

            {/* Locations */}
            <div className="space-y-2">
              <div className="flex gap-3">
                <MapPin className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">من</p>
                  <p className="text-sm font-medium truncate">{ride.pickup_address}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="h-4 w-4 text-red-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-gray-500">إلى</p>
                  <p className="text-sm font-medium truncate">{ride.dropoff_address}</p>
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {ride.trip_type === 'round_trip' && (
                <Badge variant="outline">🔄 ذهاب وإياب</Badge>
              )}
              {ride.high_priority && (
                <Badge variant="destructive">⚡ أولوية</Badge>
              )}
              {ride.prefer_women_driver && (
                <Badge variant="outline">👩 نسائي</Badge>
              )}
              {ride.estimated_fare && (
                <Badge variant="secondary">{ride.estimated_fare.toFixed(0)} د.ع</Badge>
              )}
            </div>
          </div>

          {/* Warnings */}
          {isLateCancel() && shouldShowCancel && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                الإلغاء الآن قد يترتب عليه حظر مؤقت لمدة ساعة واحدة!
              </AlertDescription>
            </Alert>
          )}

          {shouldShowAccept && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                بقبولك للرحلة، تلتزم بتوفير الخدمة في الموعد المحدد أو قبله بـ 5 دقائق.
              </AlertDescription>
            </Alert>
          )}

          {shouldShowConfirm && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                تأكيد الجاهزية يعني أنك وصلت إلى نقطة الانطلاق وجاهز لاستقبال الراكب.
              </AlertDescription>
            </Alert>
          )}

          {/* Terms Checkbox */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={agreedToTerms}
              onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              className="mt-1"
            />
            <label
              htmlFor="terms"
              className="text-xs text-gray-600 cursor-pointer leading-relaxed"
            >
              أوافق على شروط الخدمة وأتحمل مسؤولية الحضور في الوقت المحدد
            </label>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            إلغاء
          </Button>
          {shouldShowAccept && (
            <Button
              onClick={handleAcceptRide}
              disabled={!agreedToTerms || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? '⏳ جاري...' : '✓ نعم، قبول'}
            </Button>
          )}
          {shouldShowConfirm && (
            <Button
              onClick={handleConfirmRide}
              disabled={!agreedToTerms || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? '⏳ جاري...' : '✓ نعم، تأكيد'}
            </Button>
          )}
          {shouldShowCancel && (
            <Button
              onClick={handleCancelRide}
              disabled={isLoading}
              variant="destructive"
            >
              {isLoading ? '⏳ جاري...' : '✕ نعم، إلغاء'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
