/**
 * ران - شاشة تأكيد لوحة السيارة
 * مثل Uber/Careem: عرض رقم اللوحة بحجم كبير للمستخدم للتأكد من السيارة الصحيحة
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Check,
  X,
  Car,
  Star,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface DriverInfo {
  name: string;
  phone?: string;
  rating?: number;
  totalRides?: number;
  vehicleColor?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
  avatarUrl?: string;
}

interface VerifyVehicleSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driver: DriverInfo;
  onConfirm: () => void;
  onChat?: () => void;
  onCall?: () => void;
}

const VerifyVehicleSheet: React.FC<VerifyVehicleSheetProps> = ({
  open,
  onOpenChange,
  driver,
  onConfirm,
  onChat,
  onCall,
}) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-center flex items-center justify-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            تأكد من السيارة
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* معلومات السائق */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/30"
          >
            {/* صورة السائق */}
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20">
              {driver.avatarUrl ? (
                <img
                  src={driver.avatarUrl}
                  alt={driver.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>

            <div className="flex-1">
              <h3 className="text-lg font-bold">{driver.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {driver.rating && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium">
                      {driver.rating.toFixed(1)}
                    </span>
                  </div>
                )}
                {driver.totalRides && (
                  <span className="text-xs text-muted-foreground">
                    • {driver.totalRides} رحلة
                  </span>
                )}
              </div>
            </div>

            {/* أزرار الاتصال */}
            <div className="flex gap-2">
              {onChat && (
                <button
                  onClick={onChat}
                  className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                >
                  <MessageCircle className="w-5 h-5 text-primary" />
                </button>
              )}
              {onCall && (
                <button
                  onClick={onCall}
                  className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center hover:bg-green-500/20 transition-colors"
                >
                  <Phone className="w-5 h-5 text-green-600" />
                </button>
              )}
            </div>
          </motion.div>

          {/* رقم اللوحة - بحجم كبير */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-center shadow-xl"
          >
            <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">
              رقم لوحة السيارة
            </p>
            <div className="bg-white rounded-xl p-4 mx-auto max-w-[280px]">
              <p
                className="text-3xl font-black text-slate-900 tracking-[0.15em] font-mono"
                dir="ltr"
              >
                {driver.vehiclePlate || "---"}
              </p>
            </div>
          </motion.div>

          {/* معلومات السيارة */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-center gap-4 p-3 bg-muted/30 rounded-xl"
          >
            <Car className="w-5 h-5 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-bold">
                {driver.vehicleModel || "غير محدد"}
              </p>
              {driver.vehicleColor && (
                <p className="text-xs text-muted-foreground">
                  اللون: {driver.vehicleColor}
                </p>
              )}
            </div>
          </motion.div>

          {/* تنبيه أمان */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
            <Shield className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              تأكد من مطابقة رقم اللوحة ولون السيارة قبل الركوب. لا تركب مع سائق
              لا يتطابق مع المعلومات المعروضة.
            </p>
          </div>

          {/* زر التأكيد */}
          <Button
            onClick={onConfirm}
            className="w-full h-12 text-base font-bold rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
          >
            <Check className="w-5 h-5 ml-2" />
            تأكدت، هذه سيارتي
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default VerifyVehicleSheet;
