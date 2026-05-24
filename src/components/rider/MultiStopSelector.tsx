import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { MapPin, Plus, X, GripVertical, Navigation, Clock, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { cleanArabicAddress } from '@/utils/addressCleaner';

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
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="p-3 bg-muted/30 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">مسار الرحلة</span>
          </div>
          {intermediateStops.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {totalDistance.toFixed(1)} كم
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {totalTime} د
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Pickup Point */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
            <div className="w-0.5 h-6 bg-gradient-to-b from-emerald-500 to-border" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">نقطة الانطلاق</p>
            <p className="text-sm font-medium truncate">
              {pickup.address ? cleanArabicAddress(pickup.address) : 'موقعك الحالي'}
            </p>
          </div>
        </div>

        {/* Intermediate Stops */}
        <AnimatePresence>
          {isExpanded && intermediateStops.length > 0 && (
            <Reorder.Group
              axis="y"
              values={intermediateStops}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {intermediateStops.map((stop, index) => (
                <Reorder.Item
                  key={stop.id}
                  value={stop}
                  className="cursor-grab active:cursor-grabbing"
                >
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-0.5 h-3 bg-border" />
                      <div className="w-3 h-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white">{index + 1}</span>
                      </div>
                      <div className="w-0.5 h-3 bg-border" />
                    </div>
                    
                    <div 
                      className={cn(
                        "flex-1 min-w-0 p-2 rounded-lg border transition-all",
                        stop.address 
                          ? "bg-background border-border" 
                          : "bg-muted/50 border-dashed border-primary/50 cursor-pointer hover:bg-primary/5"
                      )}
                      onClick={() => !stop.address && onStopSelect(stop.id)}
                    >
                      {stop.address ? (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">محطة {index + 1}</p>
                            <p className="text-sm truncate">{cleanArabicAddress(stop.address)}</p>
                            {stop.estimatedTime && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                +{stop.estimatedTime} دقيقة • {stop.distanceFromPrevious?.toFixed(1)} كم
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <GripVertical className="w-4 h-4 text-muted-foreground" />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeStop(stop.id);
                              }}
                              disabled={disabled}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-primary">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">اضغط لتحديد المحطة {index + 1}</span>
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
            className="flex items-center gap-3"
          >
            <div className="flex flex-col items-center">
              <div className="w-0.5 h-3 bg-border" />
              <div className="w-3 h-3 rounded-full border-2 border-dashed border-primary/50" />
              <div className="w-0.5 h-3 bg-border" />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start text-primary hover:text-primary hover:bg-primary/5 border border-dashed border-primary/30"
              onClick={addStop}
              disabled={disabled}
            >
              <Plus className="w-4 h-4 ml-2" />
              إضافة محطة ({intermediateStops.length}/{maxStops})
            </Button>
          </motion.div>
        )}

        {/* Dropoff Point */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-border to-destructive" />
            <div className="w-3 h-3 rounded-full bg-destructive ring-4 ring-destructive/20" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">الوجهة النهائية</p>
            <p className="text-sm font-medium truncate">
              {dropoff.address ? cleanArabicAddress(dropoff.address) : 'اختر الوجهة'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiStopSelector;
