import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingUp, Star, MapPin, ArrowRight, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface Destination {
  id: string;
  address: string;
  lat: number;
  lng: number;
  type: 'recent' | 'popular' | 'suggested';
  count?: number;
  lastUsed?: Date;
}

interface RecentDestinationsProps {
  userId?: string | null;
  onSelect: (destination: { address: string; lat: number; lng: number }) => void;
  className?: string;
}

const RecentDestinations: React.FC<RecentDestinationsProps> = ({
  userId,
  onSelect,
  className
}) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'recent' | 'popular'>('recent');

  useEffect(() => {
    loadDestinations();
  }, [userId, activeTab]);

  const loadDestinations = async () => {
    setIsLoading(true);
    
    // Load from localStorage first for quick display
    const localRecent = localStorage.getItem('recent_destinations');
    if (localRecent) {
      try {
        const parsed = JSON.parse(localRecent);
        setDestinations(parsed.slice(0, 5));
      } catch (e) {
        console.error('Failed to parse recent destinations', e);
      }
    }

    // TODO: Load from database if userId is available
    // This would fetch user's ride history and popular destinations
    
    setIsLoading(false);
  };

  const handleSelect = (dest: Destination) => {
    onSelect({
      address: dest.address,
      lat: dest.lat,
      lng: dest.lng
    });
  };

  const tabs = [
    {
      id: 'recent' as const,
      label: 'الأخيرة',
      icon: Clock,
      color: 'text-blue-500'
    },
    {
      id: 'popular' as const,
      label: 'الشائعة',
      icon: TrendingUp,
      color: 'text-amber-500'
    }
  ];

  if (destinations.length === 0 && !isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("text-center py-8", className)}
      >
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 mx-auto mb-3 flex items-center justify-center">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">لا توجد وجهات سابقة</p>
        <p className="text-xs text-muted-foreground mt-1">ابدأ أول رحلة لك الآن!</p>
      </motion.div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Tabs */}
      <div className="flex items-center gap-2 px-4">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all",
              activeTab === tab.id
                ? "bg-gradient-to-r from-primary/20 to-primary/10 border-2 border-primary/30 text-primary shadow-lg"
                : "bg-secondary/30 border border-border/30 text-muted-foreground hover:border-primary/20"
            )}
          >
            <tab.icon className={cn("w-4 h-4", activeTab === tab.id && tab.color)} />
            <span>{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Destinations List */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 space-y-2"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-secondary/30 animate-pulse"
              />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: activeTab === 'recent' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: activeTab === 'recent' ? 20 : -20 }}
            className="px-4 space-y-2"
          >
            {destinations.length === 0 ? (
              <div className="text-center py-6">
                <Sparkles className="w-12 h-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {activeTab === 'recent' ? 'لا توجد وجهات حديثة' : 'لا توجد وجهات شائعة'}
                </p>
              </div>
            ) : (
              destinations.map((dest, index) => (
                <motion.button
                  key={dest.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01, x: -5 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelect(dest)}
                  className={cn(
                    "w-full group relative overflow-hidden rounded-xl bg-card/80 backdrop-blur-sm border border-border/30 hover:border-primary/30 transition-all p-3"
                  )}
                >
                  {/* Hover Gradient */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />

                  <div className="relative flex items-center gap-3">
                    {/* Icon */}
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all",
                      activeTab === 'recent'
                        ? "bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20"
                        : "bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20"
                    )}>
                      {activeTab === 'recent' ? (
                        <Clock className="w-5 h-5 text-blue-500" />
                      ) : (
                        <Star className="w-5 h-5 text-amber-500" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-sm text-foreground truncate mb-0.5">
                        {dest.address}
                      </p>
                      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {dest.count && (
                          <span>• {dest.count} مرات</span>
                        )}
                        {dest.lastUsed && (
                          <span>• منذ {getRelativeTime(dest.lastUsed)}</span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <motion.div
                      animate={{ x: [0, -5, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3 }}
                      className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
                    >
                      <ArrowRight className="w-5 h-5 text-primary" />
                    </motion.div>
                  </div>

                  {/* Bottom accent line */}
                  <motion.div
                    className={cn(
                      "absolute bottom-0 left-0 right-0 h-0.5 origin-right",
                      activeTab === 'recent'
                        ? "bg-gradient-to-l from-blue-500 to-blue-400"
                        : "bg-gradient-to-l from-amber-500 to-amber-400"
                    )}
                    initial={{ scaleX: 0 }}
                    whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Helper function to get relative time
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} دقيقة`;
  if (diffHours < 24) return `${diffHours} ساعة`;
  if (diffDays < 30) return `${diffDays} يوم`;
  return 'شهر';
}

export default RecentDestinations;
