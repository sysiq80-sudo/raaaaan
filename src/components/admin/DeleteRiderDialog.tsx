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
import { Loader2 } from "lucide-react";

interface RiderProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

interface DeleteRiderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rider: RiderProfile | null;
  onSuccess: () => void;
}

const DeleteRiderDialog = ({
  open,
  onOpenChange,
  rider,
  onSuccess,
}: DeleteRiderDialogProps) => {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!rider) return;

    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-rider", {
        body: { userId: rider.user_id },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "تم الحذف",
        description: `تم حذف الراكب ${rider.full_name || "بدون اسم"} بنجاح`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error deleting rider:", error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في حذف الراكب",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد حذف الراكب</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من حذف الراكب "{rider?.full_name || "بدون اسم"}"؟
            <br />
            <span className="text-destructive font-medium">
              هذا الإجراء لا يمكن التراجع عنه وسيؤدي لحذف جميع بيانات الراكب.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isDeleting}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
                جاري الحذف...
              </>
            ) : (
              "حذف نهائياً"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteRiderDialog;
