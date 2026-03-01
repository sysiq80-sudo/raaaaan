/**
 * ران - توحيد عرض أخطاء الواجهة
 * استخدم هذه الدوال لعرض أخطاء الحجز/التتبع/الخريطة بنمط واحد
 */

type ToastFn = (opts: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => void;

/**
 * عرض رسالة خطأ موحدة (حجز، مسار، خريطة، تتبع)
 */
export function showErrorToast(
  toast: ToastFn,
  title: string,
  description?: string
): void {
  toast({
    title,
    description: description ?? "يرجى المحاولة مرة أخرى أو التحقق من الاتصال",
    variant: "destructive",
  });
}
