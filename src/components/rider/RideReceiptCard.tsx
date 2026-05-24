/**
 * ران — بطاقة إيصال الرحلة
 * تعرض تفاصيل مالية كاملة بعد إكمال الرحلة
 * تُستخدم من جهة الراكب والسائق
 */

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  MapPin,
  Navigation,
  Clock,
  Car,
  Banknote,
  Wallet,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Timer,
  Route,
  Percent,
} from "lucide-react";

export interface RideReceiptData {
  // Basic ride info
  ride_id?: string;
  pickup_address?: string;
  dropoff_address?: string;
  distance_km?: number | null;
  duration_minutes?: number | null;
  vehicle_type?: string;

  // Fare breakdown
  base_fare?: number;
  final_fare: number;
  waiting_fare?: number;
  fare_adjusted?: boolean;

  // Commission (driver side)
  commission_rate_percent?: number;
  commission_amount?: number;
  driver_earning?: number;
  tier_discount?: number;
  tier_name?: string;
  subscription_discount?: number;
  subscription_name?: string;

  // Payment
  payment_method?: string;
  completed_at?: string;
}

interface RideReceiptCardProps {
  receipt: RideReceiptData;
  /** 'rider' shows fare summary, 'driver' shows earnings details */
  viewMode: "rider" | "driver";
  className?: string;
}

const VEHICLE_LABELS: Record<string, string> = {
  economy: "اقتصادي",
  comfort: "مريح",
  premium: "مميز",
  women_only: "نسائي",
};

const PAYMENT_LABELS: Record<string, { label: string; icon: typeof Banknote }> = {
  cash: { label: "نقداً", icon: Banknote },
  wallet: { label: "المحفظة", icon: Wallet },
  nas_wallet: { label: "المحفظة", icon: Wallet },
  nass: { label: "البطاقة", icon: CreditCard },
  card: { label: "البطاقة", icon: CreditCard },
  zain_cash: { label: "زين كاش", icon: Wallet },
};

export const RideReceiptCard = ({
  receipt,
  viewMode,
  className = "",
}: RideReceiptCardProps) => {
  const paymentInfo = PAYMENT_LABELS[receipt.payment_method || "cash"] || PAYMENT_LABELS.cash;
  const PaymentIcon = paymentInfo.icon;

  const completedDate = receipt.completed_at
    ? new Date(receipt.completed_at).toLocaleDateString("ar-IQ", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            <h3 className="font-bold text-lg">إيصال الرحلة</h3>
          </div>
          {completedDate && (
            <span className="text-xs opacity-80">{completedDate}</span>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Route */}
        {(receipt.pickup_address || receipt.dropoff_address) && (
          <div className="space-y-2">
            {receipt.pickup_address && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{receipt.pickup_address}</span>
              </div>
            )}
            {receipt.dropoff_address && (
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{receipt.dropoff_address}</span>
              </div>
            )}
          </div>
        )}

        {/* Trip stats */}
        <div className="grid grid-cols-3 gap-3">
          {receipt.distance_km != null && (
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <Route className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-bold">{receipt.distance_km.toFixed(1)} كم</p>
              <p className="text-[10px] text-muted-foreground">المسافة</p>
            </div>
          )}
          {receipt.duration_minutes != null && (
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <Clock className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-bold">{receipt.duration_minutes} د</p>
              <p className="text-[10px] text-muted-foreground">المدة</p>
            </div>
          )}
          {receipt.vehicle_type && (
            <div className="text-center p-2 rounded-lg bg-muted/50">
              <Car className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-bold">
                {VEHICLE_LABELS[receipt.vehicle_type] || receipt.vehicle_type}
              </p>
              <p className="text-[10px] text-muted-foreground">النوع</p>
            </div>
          )}
        </div>

        <Separator />

        {/* === RIDER VIEW — Fare Summary === */}
        {viewMode === "rider" && (
          <div className="space-y-2">
            {receipt.base_fare != null && receipt.base_fare !== receipt.final_fare && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الأجرة المقدّرة</span>
                <span>{receipt.base_fare.toLocaleString()} د.ع</span>
              </div>
            )}

            {receipt.waiting_fare != null && receipt.waiting_fare > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  أجرة الانتظار
                </span>
                <span>+{receipt.waiting_fare.toLocaleString()} د.ع</span>
              </div>
            )}

            {receipt.fare_adjusted && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <TrendingUp className="w-3 h-3" />
                <span>تم تعديل الأجرة بناءً على المسار الفعلي</span>
              </div>
            )}

            <Separator className="my-2" />

            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">الإجمالي</span>
              <span className="font-bold text-2xl text-primary">
                {receipt.final_fare.toLocaleString()} د.ع
              </span>
            </div>

            {/* Payment method */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm text-muted-foreground">طريقة الدفع</span>
              <div className="flex items-center gap-2">
                <PaymentIcon className="w-4 h-4" />
                <span className="font-medium">{paymentInfo.label}</span>
              </div>
            </div>
          </div>
        )}

        {/* === DRIVER VIEW — Earnings Details === */}
        {viewMode === "driver" && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">أجرة الرحلة</span>
              <span className="font-medium">
                {receipt.final_fare.toLocaleString()} د.ع
              </span>
            </div>

            {receipt.waiting_fare != null && receipt.waiting_fare > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  أجرة انتظار مشمولة
                </span>
                <span>{receipt.waiting_fare.toLocaleString()} د.ع</span>
              </div>
            )}

            <Separator className="my-2" />

            {/* Commission breakdown */}
            {receipt.commission_rate_percent != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  عمولة المنصة ({receipt.commission_rate_percent}%)
                </span>
                <span className="text-red-500">
                  -{(receipt.commission_amount || 0).toLocaleString()} د.ع
                </span>
              </div>
            )}

            {/* Discounts applied */}
            {(receipt.tier_discount || 0) > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  خصم مستوى {receipt.tier_name || ""} (-{receipt.tier_discount}%)
                </span>
                <span>مُطبّق ✓</span>
              </div>
            )}

            {(receipt.subscription_discount || 0) > 0 && (
              <div className="flex justify-between text-xs text-green-600">
                <span className="flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  خصم اشتراك {receipt.subscription_name || ""} (-{receipt.subscription_discount}%)
                </span>
                <span>مُطبّق ✓</span>
              </div>
            )}

            <Separator className="my-2" />

            {/* Net earning */}
            <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="font-bold text-green-700 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                صافي ربحك
              </span>
              <span className="font-bold text-2xl text-green-600">
                {(receipt.driver_earning || 0).toLocaleString()} د.ع
              </span>
            </div>

            {/* Payment method */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <span className="text-xs text-muted-foreground">طريقة الدفع</span>
              <Badge variant="secondary" className="text-xs">
                <PaymentIcon className="w-3 h-3 ml-1" />
                {paymentInfo.label}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
