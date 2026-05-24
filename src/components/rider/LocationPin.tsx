/**
 * ران - دبوس الموقع على الخريطة
 * مكون تقديمي بحت - يعرض الدبوس الأخضر (انطلاق) أو الأزرق (وجهة)
 */

import React from "react";
import { motion } from "framer-motion";
import { Navigation, MapPin } from "lucide-react";

interface LocationPinProps {
  isPickup: boolean;
  isDragging: boolean;
}

const LocationPin: React.FC<LocationPinProps> = ({ isPickup, isDragging }) => {
  return (
    <div
      className="pointer-events-none"
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -100%)",
        zIndex: 9999,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center"
      >
        <motion.div
          animate={{ y: isDragging ? -12 : 0 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative"
        >
          {/* Pin Head */}
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center border-4 border-white ${
              isPickup ? "bg-green-500" : "bg-sky-500"
            }`}
            style={{
              boxShadow: isPickup
                ? "0 0 20px rgba(34, 197, 94, 0.6), 0 4px 20px rgba(0,0,0,0.3)"
                : "0 0 20px rgba(14, 165, 233, 0.6), 0 4px 20px rgba(0,0,0,0.3)",
            }}
          >
            {isPickup ? (
              <Navigation className="w-6 h-6 text-white" />
            ) : (
              <MapPin className="w-6 h-6 text-white" />
            )}
          </div>

          {/* Pin Needle */}
          <div
            className="w-0 h-0 mx-auto -mt-1"
            style={{
              borderLeft: "10px solid transparent",
              borderRight: "10px solid transparent",
              borderTop: isPickup ? "16px solid #22c55e" : "16px solid #0ea5e9",
              filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.3))",
            }}
          />

          {/* Shadow dot */}
          <motion.div
            animate={{
              scale: isDragging ? 0.5 : 1,
              opacity: isDragging ? 0.2 : 0.4,
            }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-2 bg-black/50 rounded-full blur-sm"
          />
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LocationPin;
