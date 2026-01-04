import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Share2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ShareRideLocationProps {
  rideId: string;
  driverLocation?: { lat: number; lng: number };
  pickupLocation: { lat: number; lng: number; address: string };
  dropoffLocation: { lat: number; lng: number; address: string };
  estimatedFare?: number;
}

export const ShareRideLocation: React.FC<ShareRideLocationProps> = ({
  rideId,
  driverLocation,
  pickupLocation,
  dropoffLocation,
  estimatedFare
}) => {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const generateShareUrl = async () => {
    setIsSharing(true);
    try {
      // إنشاء رابط مشاركة مؤقت
      const shareData = {
        ride_id: rideId,
        driver_location: driverLocation,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        estimated_fare: estimatedFare,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 دقيقة
      };

      // استخدام ride_share_links بدلاً من ride_shares
      const { data, error } = await supabase
        .from('ride_share_links')
        .insert([{ ride_id: rideId }])
        .select()
        .single();

      if (error) throw error;

      // إنشاء الرابط باستخدام token
      const url = `${window.location.origin}/track-ride/${data.token}`;
      setShareUrl(url);

      // نسخ الرابط تلقائياً
      await navigator.clipboard.writeText(url);
      setIsCopied(true);

      setTimeout(() => setIsCopied(false), 2000);

      toast({
        title: "تم نسخ رابط التتبع! 🔗",
        description: "يمكنك مشاركة الرابط مع من تريد لمدة 30 دقيقة"
      });
    } catch (error) {
      console.error('Error sharing ride:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء رابط المشاركة",
        variant: "destructive"
      });
    } finally {
      setIsSharing(false);
    }
  };

  const copyToClipboard = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      toast({
        title: "تم نسخ الرابط! ✓",
        description: "الرابط في الحافظة الآن"
      });
    }
  };

  return (
    <div className="space-y-2">
      {!shareUrl ? (
        <Button
          onClick={generateShareUrl}
          disabled={isSharing}
          variant="outline"
          className="w-full flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" />
          {isSharing ? 'جاري الإنشاء...' : 'مشاركة الرحلة'}
        </Button>
      ) : (
        <div className="space-y-2">
          {/* عرض الرابط */}
          <div className="bg-secondary/50 rounded-lg p-3 flex items-center justify-between gap-2">
            <code className="text-xs text-muted-foreground truncate flex-1 text-left">
              {shareUrl.split('/').pop()}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyToClipboard}
              className="shrink-0"
            >
              {isCopied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* معلومات المشاركة */}
          <div className="text-xs text-muted-foreground space-y-1 bg-secondary/30 rounded-lg p-2">
            <p>✓ الرابط ينتهي بعد 30 دقيقة</p>
            <p>✓ شارك مع الأصدقاء والعائلة</p>
            <p>✓ يمكنهم متابعة الرحلة بدون حساب</p>
          </div>

          {/* زر لإعادة الإنشاء */}
          <Button
            onClick={() => setShareUrl(null)}
            variant="ghost"
            size="sm"
            className="w-full text-xs"
          >
            إنشاء رابط جديد
          </Button>
        </div>
      )}
    </div>
  );
};

export default ShareRideLocation;
