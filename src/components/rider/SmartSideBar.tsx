import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Car, Star, Zap, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: string;
  isActive?: boolean;
}

const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon,
  label,
  onClick,
  color = 'bg-primary',
  isActive = false
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="mb-3"
    >
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "w-full h-12 flex items-center gap-3 text-white rounded-xl shadow-lg transition-all duration-200",
          color,
          isActive && "ring-2 ring-white/50"
        )}
        onClick={onClick}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-sm font-medium">{label}</span>
      </Button>
    </motion.div>
  );
};

interface SmartSideBarProps {
  isVisible?: boolean;
  onQuickBook?: () => void;
  onFavoriteDrivers?: () => void;
  onPromotions?: () => void;
  onSavedPlaces?: () => void;
  onEmergency?: () => void;
  nearbyDriversCount?: number;
  hasActivePromotions?: boolean;
}

export const SmartSideBar: React.FC<SmartSideBarProps> = ({
  isVisible = true,
  onQuickBook,
  onFavoriteDrivers,
  onPromotions,
  onSavedPlaces,
  onEmergency,
  nearbyDriversCount = 0,
  hasActivePromotions = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const actions = [
    {
      icon: <Car className="w-4 h-4" />,
      label: 'حجز سريع',
      onClick: onQuickBook || (() => {}),
      color: 'bg-green-500 hover:bg-green-600',
      badge: nearbyDriversCount > 0 ? nearbyDriversCount.toString() : null
    },
    {
      icon: <Star className="w-4 h-4" />,
      label: 'سائقي المفضلة',
      onClick: onFavoriteDrivers || (() => {}),
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      icon: <Zap className="w-4 h-4" />,
      label: 'العروض',
      onClick: onPromotions || (() => {}),
      color: 'bg-orange-500 hover:bg-orange-600',
      isActive: hasActivePromotions
    },
    {
      icon: <MapPin className="w-4 h-4" />,
      label: 'الأماكن المحفوظة',
      onClick: onSavedPlaces || (() => {}),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      icon: <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />,
      label: 'طوارئ',
      onClick: onEmergency || (() => {}),
      color: 'bg-red-500 hover:bg-red-600'
    }
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ x: 300 }}
          animate={{ x: isExpanded ? 0 : 280 }}
          exit={{ x: 300 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: -20, right: 280 }}
          dragElastic={0.1}
          className="fixed right-0 top-1/2 transform -translate-y-1/2 z-50"
        >
          {/* Toggle Button */}
          <motion.div
            className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="w-8 h-16 bg-primary/90 backdrop-blur-sm text-white rounded-l-xl shadow-lg border-l border-white/20"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </Button>
          </motion.div>

          {/* Side Bar Content */}
          <div className="bg-gradient-to-l from-primary/95 to-primary/80 backdrop-blur-lg rounded-l-2xl shadow-2xl p-4 w-20 border-l border-white/20">
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div key={index} className="relative">
                  <QuickActionButton
                    icon={action.icon}
                    label={action.label}
                    onClick={action.onClick}
                    color={action.color}
                    isActive={action.isActive}
                  />
                  {action.badge && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold"
                    >
                      {action.badge}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>

            {/* Decorative Elements */}
            <div className="absolute top-4 right-4 w-2 h-2 bg-white/30 rounded-full animate-pulse" />
            <div className="absolute bottom-4 right-4 w-1 h-1 bg-white/20 rounded-full animate-pulse delay-1000" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SmartSideBar;