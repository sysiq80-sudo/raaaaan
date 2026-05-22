import React from "react";
import { Check, MapPin, Navigation, CreditCard } from "lucide-react";
import { motion } from "framer-motion";

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
 * شريط خطوات بصري يعرض مراحل الحجز:
 * الانطلاق → الوجهة → الحجز
 */
const FlowStepper: React.FC<FlowStepperProps> = ({ currentStep }) => {
  const currentIdx = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-0 w-full max-w-[280px] mx-auto py-2" dir="ltr">
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const StepIcon = step.icon;

        return (
          <React.Fragment key={step.id}>
            {/* الخطوة */}
            <div className="flex flex-col items-center flex-1">
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                  backgroundColor: isCompleted
                    ? "#10b981"
                    : isCurrent
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(0, 0, 0, 0.03)",
                  borderColor: isCompleted
                    ? "#10b981"
                    : isCurrent
                    ? "#10b981"
                    : "rgba(0, 0, 0, 0.08)",
                }}
                transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                className={`w-7 h-7 rounded-full flex items-center justify-center border-[1.5px] ${
                  isCurrent ? "shadow-[0_0_8px_rgba(16,185,129,0.25)]" : ""
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                ) : (
                  <StepIcon
                    className={`w-3 h-3 ${
                      isCurrent ? "text-emerald-600" : "text-muted-foreground/40"
                    }`}
                  />
                )}
              </motion.div>
              <span
                className={`text-[9px] font-bold mt-1 transition-colors ${
                  isCurrent
                    ? "text-emerald-600"
                    : isCompleted
                    ? "text-emerald-500/60"
                    : "text-muted-foreground/30"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* خط الربط */}
            {idx < STEPS.length - 1 && (
              <div className="flex-1 max-w-[40px] mb-4 mx-0.5">
                <motion.div
                  initial={false}
                  animate={{
                    backgroundColor: isCompleted ? "#10b981" : "rgba(0, 0, 0, 0.06)",
                  }}
                  transition={{ duration: 0.4 }}
                  className="h-[2px] w-full rounded-full"
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
