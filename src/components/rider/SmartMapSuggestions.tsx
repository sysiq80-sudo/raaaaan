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
  coords: {
    lat: number;
    lng: number;
  };
  confidence: number; // 0-1
  icon: React.ReactNode;
  reason: string;
}
interface SmartMapSuggestionsProps {
  userLocation: {
    lat: number;
    lng: number;
  } | null;
  currentHour: number;
  userHistory?: Array<{
    address: string;
    coords: {
      lat: number;
      lng: number;
    };
    timestamp: Date;
    type?: string;
  }>;
  onSuggestionSelect: (address: string, coords: {
    lat: number;
    lng: number;
  }) => void;
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
        coords: {
          lat: userLocation.lat + 0.01,
          lng: userLocation.lng + 0.01
        },
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
        coords: {
          lat: userLocation.lat + 0.005,
          lng: userLocation.lng - 0.005
        },
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
        coords: {
          lat: userLocation.lat - 0.01,
          lng: userLocation.lng - 0.01
        },
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
        coords: {
          lat: userLocation.lat + 0.02,
          lng: userLocation.lng + 0.02
        },
        confidence: 0.5,
        icon: <ShoppingBag className="w-4 h-4" />,
        reason: 'يوم عطلة'
      });
    }

    // History-based suggestions
    const recentTrips = userHistory.filter(trip => {
      const tripDate = new Date(trip.timestamp);
      const daysDiff = (now.getTime() - tripDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // Last 7 days
    }).slice(0, 3);
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
    const favoriteLocations = [{
      id: 'favorite_home',
      type: 'favorite' as const,
      title: 'المنزل',
      subtitle: 'عنوانك المفضل',
      address: 'شارع المنزل - بغداد',
      coords: {
        lat: userLocation.lat - 0.005,
        lng: userLocation.lng - 0.005
      },
      confidence: 1.0,
      icon: <Heart className="w-4 h-4" />,
      reason: 'مكان مفضل'
    }, {
      id: 'favorite_work',
      type: 'favorite' as const,
      title: 'مكان العمل',
      subtitle: 'مكتبك الرئيسي',
      address: 'شارع العمل - بغداد',
      coords: {
        lat: userLocation.lat + 0.008,
        lng: userLocation.lng + 0.008
      },
      confidence: 0.95,
      icon: <Briefcase className="w-4 h-4" />,
      reason: 'مكان مفضل'
    }];
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
  return <AnimatePresence>
      
    </AnimatePresence>;
};
export default SmartMapSuggestions;
