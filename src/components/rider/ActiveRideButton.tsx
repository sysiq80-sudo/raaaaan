import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Car, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActiveRide } from "@/hooks/useActiveRide";

interface ActiveRideButtonProps {
  activeRide: ActiveRide;
  onClick: () => void;
}

const ActiveRideButton = ({ activeRide, onClick }: ActiveRideButtonProps) => {
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y,
    });
  };

  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    let newX = clientX - dragStart.x;
    let newY = clientY - dragStart.y;

    // Keep within screen bounds
    newX = Math.max(10, Math.min(window.innerWidth - 90, newX));
    newY = Math.max(10, Math.min(window.innerHeight - 90, newY));

    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Snap to nearest edge
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const centerX = screenWidth / 2;
    
    let newX = position.x;
    let newY = position.y;

    // Snap to left or right edge
    if (position.x < centerX) {
      newX = 20;
    } else {
      newX = screenWidth - 100;
    }

    // Keep Y position but ensure it's within bounds
    newY = Math.max(80, Math.min(screenHeight - 150, position.y));

    setPosition({ x: newX, y: newY });
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('touchend', handleDragEnd);

      return () => {
        window.removeEventListener('mousemove', handleDrag);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleDrag);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, position, dragStart]);

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: 'بحث عن سائق...',
      accepted: 'السائق في الطريق',
      arrived: 'السائق وصل',
      in_progress: 'رحلة نشطة',
    };
    return map[status] || 'رحلة نشطة';
  };

  return (
    <motion.div
      className="fixed z-40 cursor-grab active:cursor-grabbing"
      style={{
        left: position.x,
        top: position.y,
      }}
      animate={{
        scale: isDragging ? 1.1 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onMouseDown={handleDragStart}
      onTouchStart={handleDragStart}
    >
      <Button
        onClick={(e) => {
          if (!isDragging) {
            onClick();
          }
          e.stopPropagation();
        }}
        className="h-auto p-0 overflow-hidden rounded-2xl shadow-2xl border-2 border-primary/50 bg-gradient-to-br from-primary via-primary/90 to-primary/80 hover:shadow-primary/50 transition-all duration-300"
      >
        <div className="relative">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-transparent animate-pulse" />
          
          {/* Content */}
          <div className="relative px-4 py-3 flex items-center gap-3 min-w-[200px]">
            {/* Icon with pulse animation */}
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-30" />
              <div className="relative w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30">
                <Car className="w-6 h-6 text-white" />
              </div>
            </div>

            {/* Text */}
            <div className="flex-1 text-right">
              <div className="text-xs text-white/80 font-medium">
                {getStatusText(activeRide.status)}
              </div>
              <div className="text-sm font-bold text-white flex items-center gap-1">
                عرض التفاصيل
                <ChevronUp className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Drag indicator dots */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
          </div>
        </div>
      </Button>
    </motion.div>
  );
};

export default ActiveRideButton;
