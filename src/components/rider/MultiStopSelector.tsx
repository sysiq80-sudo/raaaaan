import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { MapPin, Plus, X, GripVertical, Navigation, Clock, Route, CircleDot, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  address: string;
  location: { lat: number; lng: number } | null;
  estimatedTime?: number;
  distanceFromPrevious?: number;
}

interface MultiStopSelectorProps {
  pickup: { address: string; location: { lat: number; lng: number } | null };
  dropoff: { address: string; location: { lat: number; lng: number } | null };
  intermediateStops: Stop[];
  onStopsChange: (stops: Stop[]) => void;
  onStopSelect: (stopId: string) => void;
  maxStops?: number;
  disabled?: boolean;
}

const MultiStopSelector: React.FC<MultiStopSelectorProps> = ({
  pickup,
  dropoff,
  intermediateStops,
  onStopsChange,
  onStopSelect,
  maxStops = 3,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(intermediateStops.length > 0);

  const addStop = () => {
    if (intermediateStops.length >= maxStops) return;
    
    const newStop: Stop = {
      id: `stop-${Date.now()}`,
      address: '',
      location: null,
    };
    
    onStopsChange([...intermediateStops, newStop]);
    setIsExpanded(true);
  };

  const removeStop = (stopId: string) => {
    onStopsChange(intermediateStops.filter(s => s.id !== stopId));
  };

  const handleReorder = (newOrder: Stop[]) => {
    onStopsChange(newOrder);
  };

  const totalDistance = intermediateStops.reduce((sum, stop) => sum + (stop.distanceFromPrevious || 0), 0);
  const totalTime = intermediateStops.reduce((sum, stop) => sum + (stop.estimatedTime || 0), 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-card to-secondary/30 rounded-2xl border border-border/30 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="p-4 bg-gradient-to-l from-primary/5 to-transparent border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Route className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-bold text-foreground">مسار الرحلة</span>
              {intermediateStops.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {intermediateStops.length} محطة إضافية
                </p>
              )}
            </div>
          </div>
          {intermediateStops.length > 0 && (
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                <Navigation className="w-3.5 h-3.5 text-primary" />
                {totalDistance.toFixed(1)} كم
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5 text-primary" />
                {totalTime} د
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-1">
        {/* Pickup Point */}
        <motion.div 
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30" />
              <div className="absolute inset-0 w-4 h-4 rounded-full bg-emerald-500 animate-ping-slow opacity-50" />
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-emerald-500 via-emerald-500/50 to-border" />
          </div>
          <div className="flex-1 min-w-0 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-emerald-600 font-medium mb-0.5">نقطة الانطلاق</p>
            <p className="text-sm font-bold truncate text-foreground">
              {pickup.address || 'موقعك الحالي'}
            </p>
          </div>
        </motion.div>

        {/* Intermediate Stops */}
        <AnimatePresence>
          {isExpanded && intermediateStops.length > 0 && (
            <Reorder.Group
              axis="y"
              values={intermediateStops}
              onReorder={handleReorder}
              className="space-y-1"
            >
              {intermediateStops.map((stop, index) => (
                <Reorder.Item
                  key={stop.id}
                  value={stop}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.95 }}
                    className="flex items-center gap-4"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-border" />
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <span className="text-[10px] font-bold text-white">{index + 1}</span>
                      </div>
                      <div className="w-0.5 h-3 bg-border" />
                    </div>
                    
                    <div 
                      className={cn(
                        "flex-1 min-w-0 p-3 rounded-xl border-2 transition-all duration-300",
                        stop.address 
                          ? "bg-amber-500/5 border-amber-500/20" 
                          : "bg-muted/30 border-dashed border-primary/40 cursor-pointer hover:bg-primary/5 hover:border-primary/60"
                      )}
                      onClick={() => !stop.address && onStopSelect(stop.id)}
                    >
                      {stop.address ? (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-amber-600 font-medium mb-0.5">محطة {index + 1}</p>
                            <p className="text-sm font-medium truncate">{stop.address}</p>
                            {stop.estimatedTime && (
                              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                <span>+{stop.estimatedTime} دقيقة</span>
                                <span>•</span>
                                <span>{stop.distanceFromPrevious?.toFixed(1)} كم</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStop(stop.id);
                              }}
                              disabled={disabled}
                            >
                              <X className="w-3.5 h-3.5 text-destructive" />
                            </motion.button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-primary">
                          <CircleDot className="w-4 h-4" />
                          <span className="text-sm font-medium">اضغط لتحديد المحطة {index + 1}</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </AnimatePresence>

        {/* Add Stop Button */}
        {intermediateStops.length < maxStops && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-4"
          >
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-border" />
              <div className="w-4 h-4 rounded-full border-2 border-dashed border-primary/50" />
              <div className="w-0.5 h-3 bg-border" />
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl text-primary border-2 border-dashed border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all"
              onClick={addStop}
              disabled={disabled}
            >
              <Plus className="w-4 h-4" />
              <span className="font-medium">إضافة محطة</span>
              <span className="text-xs text-muted-foreground">({intermediateStops.length}/{maxStops})</span>
            </motion.button>
          </motion.div>
        )}

        {/* Dropoff Point */}
        <motion.div 
          className="flex items-center gap-4"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-8 bg-gradient-to-b from-border via-destructive/50 to-destructive" />
            <div className="relative">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-500/30" />
            </div>
          </div>
          <div className="flex-1 min-w-0 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-xs text-destructive font-medium mb-0.5 flex items-center gap-1">
              <Flag className="w-3 h-3" />
              الوجهة النهائية
            </p>
            <p className="text-sm font-bold truncate text-foreground">
              {dropoff.address || 'اختر الوجهة'}
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MultiStopSelector;
