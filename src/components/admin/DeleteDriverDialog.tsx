import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Driver = Database["public"]["Tables"]["drivers"]["Row"];

interface DeleteDriverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: Driver | null;
  onSuccess: () => void;
}

export const DeleteDriverDialog = ({
  open,
  onOpenChange,
  driver,
  onSuccess,
}: DeleteDriverDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!driver) return;

    setLoading(true);

    try {
      // Delete driver documents from storage
      const { data: files } = await supabase.storage
        .from("driver-documents")
        .list(driver.id);

      if (files && files.length > 0) {
        const filePaths = files.map((file) => `${driver.id}/${file.name}`);
        await supabase.storage.from("driver-documents").remove(filePaths);
      }

      // Delete driver record
      const { error } = await supabase
        .from("drivers")
        .delete()
        .eq("id", driver.id);

      if (error) throw error;

      toast({
        title: "تم بنجاح",
        description: "تم حذف السائق ووثائقه",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حذف السائق",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            تأكيد حذف السائق
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              هل أنت متأكد من حذف السائق <strong>{driver?.full_name}</strong>؟
            </p>
            <p className="text-destructive">
              سيتم حذف جميع بيانات السائق ووثائقه نهائياً ولا يمكن التراجع عن هذا الإجراء.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 ml-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 ml-2" />
            )}
            حذف نهائياً
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
