import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import GoPage from "./GoPage";

/**
 * صفحة حجز منفصلة (Premium) تبقى مستقلة عن صفحة الراكب الأصلية.
 * حالياً تعرض GoPage داخل غلاف بصري مختلف لضمان الاستقرار وسهولة التطوير المرحلي.
 */
const PremiumBookingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <motion.div
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 border-b border-border/40 bg-background/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-bold">وضع الحجز المتقدم</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/rider")}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            العودة للوضع الأصلي
          </Button>
        </div>
      </motion.div>

      <GoPage />
    </div>
  );
};

export default PremiumBookingPage;
