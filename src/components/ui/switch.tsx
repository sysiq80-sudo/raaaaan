import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // ✅ الـ track: h-6 (24px) × w-11 (44px) مع padding داخلي border-2
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // ✅ منع overflow الـ thumb
      "overflow-hidden",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // ✅ الـ thumb: h-5 (20px) × w-5 (20px) — أصغر بـ 4px من الـ track
        // الفضاء المتاح: 44 - 4 (borders) - 20 (thumb) = 20px → translate-x-5 (20px)
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200",
        // ✅ في LTR: unchecked يسار → checked يمين
        "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-5",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
