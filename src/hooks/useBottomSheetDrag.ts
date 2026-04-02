/**
 * useBottomSheetDrag — Hook مشترك لسلوك السحب على الـ Bottom Sheets
 * يُستخدم في: RideRequestCard, ActiveRideCard, SimplifiedBookingPanel, LiveRideTracker, BookingConfirmationScreen
 */

import { useState } from "react";

interface BottomSheetDragResult {
  isExpanded: boolean;
  setIsExpanded: (v: boolean) => void;
  toggleExpanded: () => void;
  dragProps: {
    drag: "y";
    dragConstraints: { top: number; bottom: number };
    dragElastic: number;
    onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => void;
  };
}

export function useBottomSheetDrag(initialExpanded = false): BottomSheetDragResult {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const handleDragEnd = (
    _: unknown,
    { offset, velocity }: { offset: { y: number }; velocity: { y: number } }
  ) => {
    if (offset.y < -40 || velocity.y < -400) {
      setIsExpanded(true);
    } else if (offset.y > 40 || velocity.y > 400) {
      setIsExpanded(false);
    }
  };

  return {
    isExpanded,
    setIsExpanded,
    toggleExpanded: () => setIsExpanded((v) => !v),
    dragProps: {
      drag: "y",
      dragConstraints: { top: 0, bottom: 0 },
      dragElastic: 0.2,
      onDragEnd: handleDragEnd,
    },
  };
}
