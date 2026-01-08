import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Home, Briefcase, ShoppingBag, GraduationCap, Heart, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SmartSuggestion {
  id: string;
  type: 'home' | 'work' | 'shopping' | 'education' | 'favorite' | 'recent' | 'predicted';
  title: string;
  subtitle: string;
  address: string;
  coords: { lat: number; lng: number };
  confidence: number; // 0-1
  icon: React.ReactNode;
  reason: string;
}

interface SmartMapSuggestionsProps {
  userLocation: { lat: number; lng: number } | null;
  currentHour: number;
  userHistory?: Array<{
    address: string;
    coords: { lat: number; lng: number };
    timestamp: Date;
    type?: string;
  }>;
  onSuggestionSelect: (address: string, coords: { lat: number; lng: number }) => void;
  isVisible?: boolean;
}

export const SmartMapSuggestions: React.FC<SmartMapSuggestionsProps> = ({
  userLocation,
  currentHour,
  userHistory = [],
  onSuggestionSelect,
  isVisible = true
}) => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Generate smart suggestions based on time, location, and history
  const generateSuggestions = useMemo(() => {
    if (!userLocation) return [];

    const newSuggestions: SmartSuggestion[] = [];
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Time-based suggestions
    if (currentHour >= 7 && currentHour <= 9) {
      // Morning commute
      newSuggestions.push({
        id: 'morning_work',
        type: 'work',
        title: 'الذهاب للعمل',
        subtitle: 'بناءً على وقت الدوام',
        address: 'منطقة الأعمال - بغداد',
        coords: { lat: userLocation.lat + 0.01, lng: userLocation.lng + 0.01 },
        confidence: 0.8,
        icon: <Briefcase className="w-4 h-4" />,
        reason: 'وقت الذهاب للعمل'
      });
    } else if (currentHour >= 12 && currentHour <= 14) {
      // Lunch time
      newSuggestions.push({
        id: 'lunch_break',
        type: 'shopping',
        title: 'تناول الغداء',
        subtitle: 'مطاعم قريبة',
        address: 'مطاعم المنطقة',
        coords: { lat: userLocation.lat + 0.005, lng: userLocation.lng - 0.005 },
        confidence: 0.6,
        icon: <ShoppingBag className="w-4 h-4" />,
        reason: 'وقت الغداء'
      });
    } else if (currentHour >= 17 && currentHour <= 19) {
      // Evening return
      newSuggestions.push({
        id: 'evening_home',
        type: 'home',
        title: 'العودة للمنزل',
        subtitle: 'بناءً على وقت العودة',
        address: 'المنزل',
        coords: { lat: userLocation.lat - 0.01, lng: userLocation.lng - 0.01 },
        confidence: 0.7,
        icon: <Home className="w-4 h-4" />,
        reason: 'وقت العودة من العمل'
      });
    }

    // Weekend suggestions
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      newSuggestions.push({
        id: 'weekend_shopping',
        type: 'shopping',
        title: 'التسوق',
        subtitle: 'مولات وأسواق',
        address: 'المول التجاري',
        coords: { lat: userLocation.lat + 0.02, lng: userLocation.lng + 0.02 },
        confidence: 0.5,
        icon: <ShoppingBag className="w-4 h-4" />,
        reason: 'يوم عطلة'
      });
    }

    // History-based suggestions
    const recentTrips = userHistory
      .filter(trip => {
        const tripDate = new Date(trip.timestamp);
        const daysDiff = (now.getTime() - tripDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7; // Last 7 days
      })
      .slice(0, 3);

    recentTrips.forEach((trip, index) => {
      newSuggestions.push({
        id: `recent_${index}`,
        type: 'recent',
        title: 'رحلة سابقة',
        subtitle: `تم زيارتها ${Math.floor((now.getTime() - new Date(trip.timestamp).getTime()) / (1000 * 60 * 60 * 24))} يوماً مضت`,
        address: trip.address,
        coords: trip.coords,
        confidence: 0.9,
        icon: <Clock className="w-4 h-4" />,
        reason: 'رحلة سابقة'
      });
    });

    // Favorite locations (simulated)
    const favoriteLocations = [
      {
        id: 'favorite_home',
        type: 'favorite' as const,
        title: 'المنزل',
        subtitle: 'عنوانك المفضل',
        address: 'شارع المنزل - بغداد',
        coords: { lat: userLocation.lat - 0.005, lng: userLocation.lng - 0.005 },
        confidence: 1.0,
        icon: <Heart className="w-4 h-4" />,
        reason: 'مكان مفضل'
      },
      {
        id: 'favorite_work',
        type: 'favorite' as const,
        title: 'مكان العمل',
        subtitle: 'مكتبك الرئيسي',
        address: 'شارع العمل - بغداد',
        coords: { lat: userLocation.lat + 0.008, lng: userLocation.lng + 0.008 },
        confidence: 0.95,
        icon: <Briefcase className="w-4 h-4" />,
        reason: 'مكان مفضل'
      }
    ];

    newSuggestions.push(...favoriteLocations);

    // Sort by confidence
    return newSuggestions.sort((a, b) => b.confidence - a.confidence);
  }, [userLocation, currentHour, userHistory]);

  useEffect(() => {
    setIsLoading(true);
    // Simulate API call delay
    const timer = setTimeout(() => {
      setSuggestions(generateSuggestions);
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [generateSuggestions]);

  if (!isVisible || !userLocation) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="absolute top-20 left-4 right-4 z-20 max-w-sm"
      >
        <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-bold text-gray-800">اقتراحات ذكية</h3>
            </div>
            <p className="text-xs text-gray-500 mt-1">بناءً على وقتك وعاداتك</p>
          </div>

          {/* Suggestions List */}
          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2">
                {suggestions.slice(0, 5).map((suggestion, index) => (
                  <motion.div
                    key={suggestion.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="mb-1"
                  >
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-3 hover:bg-gray-50 rounded-xl"
                      onClick={() => onSuggestionSelect(suggestion.address, suggestion.coords)}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          suggestion.type === 'home' && "bg-blue-100 text-blue-600",
                          suggestion.type === 'work' && "bg-purple-100 text-purple-600",
                          suggestion.type === 'shopping' && "bg-green-100 text-green-600",
                          suggestion.type === 'education' && "bg-orange-100 text-orange-600",
                          suggestion.type === 'favorite' && "bg-red-100 text-red-600",
                          suggestion.type === 'recent' && "bg-gray-100 text-gray-600",
                          suggestion.type === 'predicted' && "bg-yellow-100 text-yellow-600"
                        )}>
                          {suggestion.icon}
                        </div>
                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-gray-800">{suggestion.title}</h4>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-gray-500">{Math.round(suggestion.confidence * 100)}%</span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">{suggestion.subtitle}</p>
                          <p className="text-xs text-gray-500 mt-1 truncate">{suggestion.address}</p>
                        </div>
                      </div>
                    </Button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              هذه الاقتراحات تتحسن مع استخدامك للتطبيق
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartMapSuggestions;