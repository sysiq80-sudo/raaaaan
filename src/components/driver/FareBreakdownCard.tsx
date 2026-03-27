import { Card, CardContent } from "@/components/ui/card";
import { 
  Wallet, 
  Route, 
  Clock, 
  Car,
  Receipt
} from "lucide-react";

interface FareBreakdownCardProps {
  baseFare: number;
  distanceKm: number;
  perKmRate: number;
  waitingMinutes: number;
  waitingRatePerMin: number;
  vehicleType: string;
  vehicleMultiplier: number;
  finalFare: number;
  showDetailed?: boolean;
}

const vehicleNames: Record<string, string> = {
  economy: 'اقتصادي',
  comfort: 'مريح',
  premium: 'فاخر',
  women_only: 'نسائي'
};

export const FareBreakdownCard = ({
  baseFare,
  distanceKm,
  perKmRate,
  waitingMinutes,
  waitingRatePerMin,
  vehicleType,
  vehicleMultiplier,
  finalFare,
  showDetailed = true
}: FareBreakdownCardProps) => {
  const distanceFare = distanceKm * perKmRate;
  const waitingFare = waitingMinutes * waitingRatePerMin;
  const subtotal = baseFare + distanceFare + waitingFare;
  
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">تفاصيل الأجرة</h3>
        </div>

        {showDetailed ? (
          <div className="space-y-3">
            {/* Base fare */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">سعر البداية</span>
              </div>
              <span className="text-foreground">{baseFare.toLocaleString()} د.ع</span>
            </div>

            {/* Distance fare */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  المسافة ({distanceKm.toFixed(1)} كم × {perKmRate.toLocaleString()})
                </span>
              </div>
              <span className="text-foreground">{distanceFare.toLocaleString()} د.ع</span>
            </div>

            {/* Waiting fare */}
            {waitingMinutes > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    الانتظار ({waitingMinutes} د × {waitingRatePerMin.toLocaleString()})
                  </span>
                </div>
                <span className="text-foreground">{waitingFare.toLocaleString()} د.ع</span>
              </div>
            )}

            {/* Vehicle multiplier */}
            {vehicleMultiplier > 1 && (
              <div className="flex items-center justify-between text-sm text-primary">
                <span>معامل {vehicleNames[vehicleType] || vehicleType}</span>
                <span>×{vehicleMultiplier}</span>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <span className="font-bold text-foreground">الإجمالي</span>
                </div>
                <span className="text-xl font-bold text-primary">
                  {finalFare.toLocaleString()} د.ع
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{distanceKm.toFixed(1)} كم</span>
              {waitingMinutes > 0 && <span>{waitingMinutes} د انتظار</span>}
            </div>
            <span className="text-xl font-bold text-primary">
              {finalFare.toLocaleString()} د.ع
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FareBreakdownCard;
