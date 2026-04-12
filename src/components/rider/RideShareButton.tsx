import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { isNativePlatform } from "@/lib/capacitorBridge";

interface RideShareButtonProps {
  rideId: string;
}

/**
 * مشاركة تتبع الرحلة — يعمل على الويب و Android (Capacitor)
 * الاستراتيجية:
 * 1. على Android: يستخدم @capacitor/share → يفتح Share Sheet الأصلي
 * 2. على الويب: يستخدم navigator.share أو dialog مع نسخ + واتساب
 */
export const RideShareButton = ({ rideId }: RideShareButtonProps) => {
  const [open, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateShareLink = async (): Promise<string | null> => {
    setLoading(true);
    try {
      // Check if a share link already exists
      const { data: existing } = await supabase
        .from('ride_share_links')
        .select('token')
        .eq('ride_id', rideId)
        .gt('expires_at', new Date().toISOString())
        .single();

      let link: string;
      if (existing) {
        link = `${window.location.origin}/track/${existing.token}`;
      } else {
        // Create new share link
        const { data, error } = await supabase
          .from('ride_share_links')
          .insert({ ride_id: rideId })
          .select('token')
          .single();

        if (error) throw error;
        link = `${window.location.origin}/track/${data.token}`;
      }

      setShareLink(link);
      return link;
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: "خطأ في إنشاء رابط المشاركة",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * ⚡ مشاركة أصلية (Android Share Sheet أو Web Share API)
   * يعمل بدون فتح dialog — ضغطة واحدة مباشرة
   */
  const handleNativeShare = async () => {
    const link = shareLink || await generateShareLink();
    if (!link) return;

    const shareText = `تابع رحلتي مباشرة 📍\n${link}\n\nعبر تطبيق ران 🚗`;

    // 1. على Capacitor (Android) → Share plugin الأصلي
    if (isNativePlatform) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({
          title: 'تتبع رحلتي — ران',
          text: shareText,
          url: link,
          dialogTitle: 'مشاركة رحلتي',
        });
        return; // تمت المشاركة عبر Android Share Sheet
      } catch (e: any) {
        // المستخدم ألغى المشاركة — طبيعي
        if (e?.message?.includes('canceled') || e?.message?.includes('cancelled')) return;
        console.warn('Capacitor Share fallback to dialog:', e);
      }
    }

    // 2. على الويب → Web Share API (Chrome/Safari)
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'تتبع رحلتي — ران',
          text: shareText,
          url: link,
        });
        toast({ title: "✅ تمت مشاركة الرحلة" });
        return;
      } catch (e: any) {
        if (e?.name === 'AbortError') return; // المستخدم ألغى
      }
    }

    // 3. Fallback: فتح Dialog مع نسخ + واتساب
    setOpen(true);
  };

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
    } catch {
      // Fallback for Android WebView where clipboard API may not work
      const textArea = document.createElement('textarea');
      textArea.value = shareLink;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    toast({ title: "✅ تم نسخ الرابط" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    if (!shareLink) return;
    const message = encodeURIComponent(
      `تابع رحلتي مباشرة 📍\n${shareLink}\n\nعبر تطبيق ران 🚗`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaTelegram = () => {
    if (!shareLink) return;
    const message = encodeURIComponent(
      `تابع رحلتي مباشرة 📍\n${shareLink}\n\nعبر تطبيق ران 🚗`
    );
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${message}`, '_blank');
  };

  return (
    <>
      {/* ═══ الزر الرئيسي — ضغطة واحدة ═══ */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleNativeShare}
        className="gap-2"
      >
        <Share2 className="h-4 w-4" />
        مشاركة الرحلة
      </Button>

      {/* ═══ Dialog احتياطي (يظهر فقط إذا Share API غير متاح) ═══ */}
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen && !shareLink) {
          generateShareLink();
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>مشاركة تتبع الرحلة</DialogTitle>
            <DialogDescription>
              شارك هذا الرابط ليتمكن أحد من تتبع رحلتك مباشرة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {loading ? (
              <div className="h-10 bg-muted animate-pulse rounded-md" />
            ) : shareLink ? (
              <>
                {/* حقل الرابط + نسخ */}
                <div className="flex gap-2">
                  <Input
                    value={shareLink}
                    readOnly
                    className="text-sm font-mono"
                    dir="ltr"
                  />
                  <Button variant="outline" size="icon" onClick={copyLink}>
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* أزرار المشاركة السريعة */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={shareViaWhatsApp}
                  >
                    <MessageCircle className="h-4 w-4 ml-2" />
                    واتساب
                  </Button>
                  <Button
                    className="bg-blue-500 hover:bg-blue-600 text-white"
                    onClick={shareViaTelegram}
                  >
                    <ExternalLink className="h-4 w-4 ml-2" />
                    تليغرام
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  صالح لمدة 24 ساعة
                </p>
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
