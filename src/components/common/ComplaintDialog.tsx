/**
 * مربع حوار الشكوى
 * يُستخدم لتقديم شكوى بعد إنهاء رحلة بشكل طارئ
 */

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertCircle, 
  DollarSign, 
  UserX, 
  MapPin, 
  Clock, 
  Ban, 
  ShieldAlert,
  FileText,
  Upload,
  Loader2
} from "lucide-react";

interface ComplaintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  complainantType: 'rider' | 'driver';
  otherPartyName: string;
}

const COMPLAINT_TYPES = [
  {
    value: 'ride_not_ended',
    label: 'لم تنته الرحلة فعلياً',
    icon: AlertCircle,
    priority: 'high'
  },
  {
    value: 'wrong_fare',
    label: 'مبلغ خاطئ',
    icon: DollarSign,
    priority: 'medium'
  },
  {
    value: 'inappropriate_behavior',
    label: 'سلوك غير لائق',
    icon: UserX,
    priority: 'high'
  },
  {
    value: 'wrong_route',
    label: 'مسار غير صحيح',
    icon: MapPin,
    priority: 'medium'
  },
  {
    value: 'excessive_delay',
    label: 'تأخير كبير',
    icon: Clock,
    priority: 'medium'
  },
  {
    value: 'unjustified_cancellation',
    label: 'إلغاء تعسفي',
    icon: Ban,
    priority: 'high'
  },
  {
    value: 'fraud',
    label: 'احتيال',
    icon: ShieldAlert,
    priority: 'urgent'
  },
  {
    value: 'other',
    label: 'أخرى',
    icon: FileText,
    priority: 'medium'
  },
];

export const ComplaintDialog = ({
  open,
  onOpenChange,
  rideId,
  complainantType,
  otherPartyName,
}: ComplaintDialogProps) => {
  const { toast } = useToast();
  const [complaintType, setComplaintType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        // التحقق من حجم الملف (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "ملف كبير جداً",
            description: `${file.name} أكبر من 5MB`,
            variant: "destructive",
          });
          continue;
        }

        // رفع إلى storage
        const fileExt = file.name.split('.').pop();
        const fileName = `${rideId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
          .from('complaint-evidence')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        // الحصول على الرابط العام
        const { data: { publicUrl } } = supabase.storage
          .from('complaint-evidence')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      setEvidenceUrls([...evidenceUrls, ...uploadedUrls]);
      toast({
        title: "تم الرفع",
        description: `تم رفع ${uploadedUrls.length} ملف`,
      });
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "خطأ في الرفع",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!complaintType || !description.trim()) {
      toast({
        title: "معلومات ناقصة",
        description: "يرجى اختيار نوع الشكوى وكتابة وصف تفصيلي",
        variant: "destructive",
      });
      return;
    }

    if (description.length < 20) {
      toast({
        title: "وصف قصير جداً",
        description: "يرجى كتابة وصف أكثر تفصيلاً (20 حرف على الأقل)",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل دخول");

      const selectedType = COMPLAINT_TYPES.find(t => t.value === complaintType);
      
      const complaintData = {
        ride_id: rideId,
        complainant_id: user.id,
        complainant_type: complainantType,
        complaint_type: complaintType,
        title: selectedType?.label || 'شكوى',
        description: description.trim(),
        evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
        priority: selectedType?.priority || 'medium',
        status: 'pending'
      };

      console.log('📝 Submitting complaint:', complaintData);

      const { data, error } = await supabase
        .from('ride_complaints')
        .insert(complaintData)
        .select()
        .single();

      if (error) {
        console.error('❌ Complaint submission error:', error);
        throw new Error(`فشل تقديم الشكوى: ${error.message}`);
      }

      if (!data) {
        throw new Error('لم يتم إنشاء الشكوى');
      }

      console.log('✅ Complaint submitted successfully:', data);

      // تسجيل في emergency usage log
      await supabase
        .from('emergency_usage_log')
        .insert({
          user_id: user.id,
          user_type: complainantType,
          ride_id: rideId,
          action_type: 'end_ride',
          reason: `complaint_filed: ${complaintType}`
        });

      toast({
        title: "✅ تم تقديم الشكوى",
        description: "سيتم مراجعتها من قبل الإدارة خلال 24 ساعة",
      });

      onOpenChange(false);
      
      // إعادة تعيين النموذج
      setComplaintType("");
      setDescription("");
      setEvidenceUrls([]);

    } catch (error: any) {
      console.error('❌ Error submitting complaint:', error);
      toast({
        title: "فشل تقديم الشكوى",
        description: error.message || "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً",
        variant: "destructive",
        duration: 7000
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <AlertCircle className="w-6 h-6 text-warning" />
            تقديم شكوى
          </DialogTitle>
          <DialogDescription className="text-right">
            تم إنهاء الرحلة من قبل {otherPartyName}. إذا كنت غير موافق، يمكنك تقديم شكوى للإدارة.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* نوع الشكوى */}
          <div className="space-y-2">
            <Label>نوع الشكوى *</Label>
            <Select value={complaintType} onValueChange={setComplaintType}>
              <SelectTrigger>
                <SelectValue placeholder="اختر نوع الشكوى" />
              </SelectTrigger>
              <SelectContent>
                {COMPLAINT_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* الوصف */}
          <div className="space-y-2">
            <Label>الوصف التفصيلي * (20 حرف على الأقل)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اشرح بالتفصيل ما حدث ولماذا تقدم هذه الشكوى..."
              className="min-h-[120px] resize-none"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground text-left">
              {description.length}/1000 حرف
            </p>
          </div>

          {/* رفع الأدلة */}
          <div className="space-y-2">
            <Label>الأدلة (اختياري)</Label>
            <p className="text-xs text-muted-foreground">
              يمكنك رفع صور أو لقطات شاشة كدليل (حجم أقصى 5MB لكل ملف)
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('evidence-upload')?.click()}
                disabled={uploading}
                className="flex-1"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 ml-2" />
                )}
                رفع ملفات ({evidenceUrls.length})
              </Button>
              <input
                id="evidence-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            
            {/* عرض الملفات المرفوعة */}
            {evidenceUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {evidenceUrls.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img 
                      src={url} 
                      alt={`دليل ${idx + 1}`} 
                      className="w-full h-20 object-cover rounded border"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full"
                      onClick={() => setEvidenceUrls(evidenceUrls.filter((_, i) => i !== idx))}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !complaintType || !description.trim()}
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : null}
            تقديم الشكوى
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
