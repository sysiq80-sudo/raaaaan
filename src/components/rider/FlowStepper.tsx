import React from "react";
import { Check, MapPin, Navigation, CreditCard } from "lucide-react";

interface FlowStepperProps {
  /** "pickup" | "dropoff" | "booking" */
  currentStep: "pickup" | "dropoff" | "booking";
}

const STEPS = [
  { id: "pickup",  label: "الانطلاق", icon: Navigation },
  { id: "dropoff", label: "الوجهة",  icon: MapPin     },
  { id: "booking", label: "الحجز",   icon: CreditCard },
] as const;

/**
 * شريط خطوات بصري مضغوط — خط واحد أفقي
 * الانطلاق ● ─── ● الوجهة ─── ○ الحجز
 */
const FlowStepper: React.FC<FlowStepperProps> = ({ currentStep }) => {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-[260px] mx-auto py-1" dir="ltr">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const StepIcon = step.icon;

        return (
          <React.Fragment key={step.id}>
            {/* الخطوة — inline row */}
            <div className="flex items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center border-[1.5px] transition-all duration-300 ${
                  isCompleted
                    ? "bg-emerald-500 border-emerald-500"
                    : isCurrent
                    ? "bg-emerald-500/10 border-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.25)]"
                    : "bg-muted/30 border-border/40"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3 text-white stroke-[3]" />
                ) : (
                  <StepIcon
                    className={`w-2.5 h-2.5 ${
                      isCurrent ? "text-emerald-600" : "text-muted-foreground/30"
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[10px] font-bold transition-colors whitespace-nowrap ${
                  isCurrent
                    ? "text-emerald-600"
                    : isCompleted
                    ? "text-emerald-500/50"
                    : "text-muted-foreground/25"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* خط الربط */}
            {idx < STEPS.length - 1 && (
              <div className="flex-1 mx-1.5 max-w-[30px]">
                <div
                  className={`h-[1.5px] w-full rounded-full transition-colors duration-400 ${
                    isCompleted ? "bg-emerald-500" : "bg-border/30"
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default FlowStepper;
