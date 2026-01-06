import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Users, Star, Zap, Car, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BubbleProps {
  position: { lat: number; lng: number };
  type: 'driver' | 'promo' | 'time' | 'traffic' | 'favorite';
  data?: any;
  onClick?: () => void;
}

const Bubble: React.FC<BubbleProps> = ({ type, data, onClick }) => {
  const getBubbleConfig = () => {
    switch (type) {
      case 'driver':
        return {
          icon: <Users className="w-3 h-3" />,
          color: 'bg-green-500',
          text: `${data?.count || 0} سائق`,
          pulse: true
        };
      case 'promo':
        return {
          icon: <Zap className="w-3 h-3" />,
          color: 'bg-orange-500',
          text: `خصم ${data?.discount || '0%'}`,
          pulse: true
        };
      case 'time':
        return {
          icon: <Clock className="w-3 h-3" />,
          color: 'bg-blue-500',
          text: `${data?.minutes || 0} دقيقة`,
          pulse: false
        };
      case 'traffic':
        return {
          icon: <Car className="w-3 h-3" />,
          color: 'bg-red-500',
          text: 'ازدحام',
          pulse: true
        };
      case 'favorite':
        return {
          icon: <Star className="w-3 h-3" />,
          color: 'bg-yellow-500',
          text: 'مفضل',
          pulse: false
        };
      default:
        return {
          icon: <MapPin className="w-3 h-3" />,
          color: 'bg-gray-500',
          text: '',
          pulse: false
        };
    }
  };

  const config = getBubbleConfig();

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileHover={{ scale: 1.1 }}
      className={cn(
        "absolute z-10 flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-medium shadow-lg cursor-pointer",
        config.color,
        config.pulse && "animate-pulse"
      )}
      onClick={onClick}
    >
      {config.icon}
      <span>{config.text}</span>
    </motion.div>
  );
};

interface DynamicBubblesProps {
  driverLocations: Array<{ lat: number; lng: number }>;
  nearbyDriversCount: number;
  userLocation: { lat: number; lng: number } | null;
  pickupCoords: { lat: number; lng: number } | null;
  dropoffCoords: { lat: number; lng: number } | null;
  estimatedTime?: number;
  onBubbleClick?: (type: string, data?: any) => void;
}

export const DynamicBubbles: React.FC<DynamicBubblesProps> = ({
  driverLocations,
  nearbyDriversCount,
  userLocation,
  pickupCoords,
  dropoffCoords,
  estimatedTime,
  onBubbleClick
}) => {
  const [bubbles, setBubbles] = useState<Array<{
    id: string;
    type: BubbleProps['type'];
    position: { lat: number; lng: number };
    data?: any;
  }>>([]);

  useEffect(() => {
    const newBubbles: typeof bubbles = [];

    // Driver bubbles
    if (driverLocations.length > 0 && nearbyDriversCount > 0) {
      newBubbles.push({
        id: 'drivers',
        type: 'driver',
        position: driverLocations[0], // Position near first driver
        data: { count: nearbyDriversCount }
      });
    }

    // Time estimation bubble
    if (estimatedTime && pickupCoords) {
      newBubbles.push({
        id: 'time',
        type: 'time',
        position: {
          lat: pickupCoords.lat + 0.001, // Slightly offset
          lng: pickupCoords.lng + 0.001
        },
        data: { minutes: Math.round(estimatedTime) }
      });
    }

    // Promo bubble (simulated)
    if (Math.random() > 0.7) { // 30% chance to show promo
      newBubbles.push({
        id: 'promo',
        type: 'promo',
        position: userLocation ? {
          lat: userLocation.lat + 0.002,
          lng: userLocation.lng - 0.002
        } : { lat: 0, lng: 0 },
        data: { discount: '25%' }
      });
    }

    setBubbles(newBubbles);
  }, [driverLocations, nearbyDriversCount, userLocation, pickupCoords, dropoffCoords, estimatedTime]);

  // Convert lat/lng to screen coordinates (simplified)
  const latLngToScreen = (lat: number, lng: number) => {
    // This is a simplified conversion - in real implementation,
    // you'd use the map's projection methods
    return {
      x: `${Math.random() * 60 + 20}%`, // Random position for demo
      y: `${Math.random() * 40 + 30}%`
    };
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {bubbles.map((bubble) => {
          const screenPos = latLngToScreen(bubble.position.lat, bubble.position.lng);
          return (
            <div
              key={bubble.id}
              className="absolute pointer-events-auto"
              style={{
                left: screenPos.x,
                top: screenPos.y,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Bubble
                type={bubble.type}
                data={bubble.data}
                position={bubble.position}
                onClick={() => onBubbleClick?.(bubble.type, bubble.data)}
              />
            </div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default DynamicBubbles;