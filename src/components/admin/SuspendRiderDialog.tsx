import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Ban, CheckCircle } from "lucide-react";

interface RiderProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  status?: string;
}

interface SuspendRiderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rider: RiderProfile | null;
  action: "suspend" | "activate";
  onSuccess: () => void;
}

const SuspendRiderDialog = ({
  open,
  onOpenChange,
  rider,
  action,
  onSuccess,
}: SuspendRiderDialogProps) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAction = async () => {
    if (!rider) return;

    setIsProcessing(true);
    try {
      const newStatus = action === "suspend" ? "suspended" : "active";
      
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", rider.id);

      if (error) throw error;

      toast({
        title: action === "suspend" ? "تم التعطيل" : "تم التفعيل",
        description: action === "suspend" 
          ? `تم تعطيل حساب ${rider.full_name || "الراكب"}`
          : `تم تفعيل حساب ${rider.full_name || "الراكب"}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating rider status:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث حالة الراكب",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {action === "suspend" ? (
              <>
                <Ban className="w-5 h-5 text-destructive" />
                تعطيل حساب الراكب
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                تفعيل حساب الراكب
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === "suspend" ? (
              <>
                هل أنت متأكد من تعطيل حساب "{rider?.full_name || "بدون اسم"}"؟
                <br />
                <span className="text-amber-500">
                  لن يتمكن الراكب من طلب رحلات جديدة حتى يتم تفعيل حسابه مرة أخرى.
                </span>
              </>
            ) : (
              <>
                هل تريد تفعيل حساب "{rider?.full_name || "بدون اسم"}"؟
                <br />
                <span className="text-green-500">
                  سيتمكن الراكب من استخدام التطبيق بشكل طبيعي.
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleAction}
            disabled={isProcessing}
            className={action === "suspend" ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700"}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                جاري المعالجة...
              </>
            ) : action === "suspend" ? (
              "تعطيل الحساب"
            ) : (
              "تفعيل الحساب"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SuspendRiderDialog;
