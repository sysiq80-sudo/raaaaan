import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  MessageCircle,
  X,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import logo from "@/assets/logo.png";

interface FloatingTripBubbleProps {
  isMinimized: boolean;
  onToggleMinimize: () => void;
  notificationCount: number;
  onCallClick: () => void;
  onChatClick: () => void;
  onCancelClick: () => void;
  children: React.ReactNode; // ActiveRideCard expanded content
  passengerName: string;
  passengerRating?: number;
}

export const FloatingTripBubble = ({
  isMinimized,
  onToggleMinimize,
  notificationCount,
  onCallClick,
  onChatClick,
  onCancelClick,
  children,
  passengerName,
  passengerRating,
}: FloatingTripBubbleProps) => {
  const [position, setPosition] = useState({ x: 20, y: Math.round(window.innerHeight / 2 - 60) });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Constrain to viewport
      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 100);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 100);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <AnimatePresence>
      {isMinimized ? (
        // Minimized Floating Bubble
        <motion.div
          ref={containerRef}
          className="fixed z-50 cursor-grab active:cursor-grabbing"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onMouseDown={handleMouseDown}
        >
          <div className="relative">
            {/* Main Bubble Circle */}
            <motion.button
              onClick={onToggleMinimize}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl flex items-center justify-center hover:shadow-emerald-500/50 transition-shadow"
              data-no-drag="false"
            >
              <img
                src={logo}
                alt="RAAN"
                className="w-8 h-8 object-contain"
              />
            </motion.button>

            {/* Notification Badge */}
            {notificationCount > 0 && (
              <motion.div
                className="absolute top-0 right-0 transform translate-x-1 -translate-y-1"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Badge
                  variant="destructive"
                  className="rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold bg-red-500"
                >
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Badge>
              </motion.div>
            )}

            {/* Quick Action Buttons */}
            <motion.div
              className="absolute bottom-20 left-0 flex flex-col gap-2 pointer-events-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.1 }}
            >
              {/* Call Button */}
              <motion.button
                onClick={onCallClick}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-colors"
                data-no-drag="false"
              >
                <Phone className="w-5 h-5" />
              </motion.button>

              {/* Chat Button */}
              <motion.button
                onClick={onChatClick}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-purple-500 hover:bg-purple-600 text-white shadow-lg flex items-center justify-center transition-colors"
                data-no-drag="false"
              >
                <MessageCircle className="w-5 h-5" />
              </motion.button>

              {/* Cancel Button */}
              <motion.button
                onClick={onCancelClick}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center transition-colors"
                data-no-drag="false"
              >
                <AlertTriangle className="w-5 h-5" />
              </motion.button>
            </motion.div>

            {/* Expand Indicator */}
            <motion.div
              className="absolute -bottom-3 left-1/2 transform -translate-x-1/2"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <ChevronUp className="w-5 h-5 text-emerald-500" />
            </motion.div>
          </div>
        </motion.div>
      ) : (
        // Expanded Card
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 p-4 pointer-events-auto"
        >
          <Card className="bg-gradient-to-t from-slate-900 via-slate-800 to-slate-700 border-slate-600 shadow-2xl">
            <CardContent className="p-4">
              {/* Header with minimize button */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-600">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={logo}
                    alt="RAAN"
                    className="w-6 h-6 object-contain shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">
                      {passengerName}
                    </p>
                    {passengerRating && (
                      <p className="text-xs text-emerald-400">
                        ⭐ {passengerRating.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleMinimize}
                  className="h-8 w-8 p-0 hover:bg-slate-600"
                  data-no-drag="false"
                >
                  <ChevronUp className="w-5 h-5 text-emerald-400" />
                </Button>
              </div>

              {/* Content */}
              <div className="text-white">{children}</div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
