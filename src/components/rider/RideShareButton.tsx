import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";
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

interface RideShareButtonProps {
  rideId: string;
}

export const RideShareButton = ({ rideId }: RideShareButtonProps) => {
  const [open, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateShareLink = async () => {
    setLoading(true);
    try {
      // Check if a share link already exists
      const { data: existing } = await supabase
        .from('ride_share_links')
        .select('token')
        .eq('ride_id', rideId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (existing) {
        setShareLink(`${window.location.origin}/track/${existing.token}`);
      } else {
        // Create new share link
        const { data, error } = await supabase
          .from('ride_share_links')
          .insert({ ride_id: rideId })
          .select('token')
          .single();

        if (error) throw error;
        setShareLink(`${window.location.origin}/track/${data.token}`);
      }
    } catch (error) {
      console.error('Error generating share link:', error);
      toast({
        title: "خطأ في إنشاء رابط المشاركة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast({ title: "تم نسخ الرابط" });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    if (!shareLink) return;
    const message = encodeURIComponent(
      `تابع رحلتي مباشرة عبر هذا الرابط:\n${shareLink}\n\nمرسل من تطبيق رعان`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen && !shareLink) {
        generateShareLink();
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 ml-2" />
          مشاركة الرحلة
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>مشاركة تتبع الرحلة</DialogTitle>
          <DialogDescription>
            شارك هذا الرابط مع أي شخص ليتمكن من تتبع رحلتك مباشرة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="h-10 bg-muted animate-pulse rounded-md" />
          ) : shareLink ? (
            <>
              <div className="flex gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="text-sm"
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

              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={shareViaWhatsApp}
              >
                <MessageCircle className="h-4 w-4 ml-2" />
                مشاركة عبر واتساب
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                صالح لمدة 24 ساعة
              </p>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
