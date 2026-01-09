import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, DollarSign, Star, TrendingUp, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  type: 'driver' | 'promo' | 'fare' | 'rating' | 'traffic' | 'savings';
  title: string;
  subtitle?: string;
  value?: string | number;
  icon?: React.ReactNode;
  gradient: string;
  onClick?: () => void;
  isLoading?: boolean;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  type,
  title,
  subtitle,
  value,
  icon,
  gradient,
  onClick,
  isLoading = false
}) => {
  const getDefaultIcon = () => {
    switch (type) {
      case 'driver':
        return <Users className="w-5 h-5" />;
      case 'promo':
        return <TrendingUp className="w-5 h-5" />;
      case 'fare':
        return <DollarSign className="w-5 h-5" />;
      case 'rating':
        return <Star className="w-5 h-5" />;
      case 'traffic':
        return <Car className="w-5 h-5" />;
      case 'savings':
        return <DollarSign className="w-5 h-5" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative overflow-hidden rounded-xl p-4 text-white shadow-lg cursor-pointer",
        gradient
      )}
      onClick={onClick}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-20 h-20 bg-white rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-0 w-16 h-16 bg-white rounded-full translate-y-8 -translate-x-8" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon || getDefaultIcon()}
            <h3 className="font-bold text-sm">{title}</h3>
          </div>
          {value && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-lg font-bold"
            >
              {value}
            </motion.span>
          )}
        </div>

        {subtitle && (
          <p className="text-xs opacity-90">{subtitle}</p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 bg-black/20 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}

      {/* Shine Effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 3,
          ease: "easeInOut"
        }}
      />
    </motion.div>
  );
};

interface AnimatedCardsProps {
  nearbyDriversCount?: number;
  estimatedTime?: number;
  currentFare?: number;
  averageRating?: number;
  trafficLevel?: 'low' | 'medium' | 'high';
  monthlySavings?: number;
  onCardClick?: (type: string) => void;
  isLoading?: boolean;
}

export const AnimatedCards: React.FC<AnimatedCardsProps> = ({
  nearbyDriversCount = 0,
  estimatedTime,
  currentFare,
  averageRating = 4.5,
  trafficLevel = 'low',
  monthlySavings,
  onCardClick,
  isLoading = false
}) => {
  const cards = [
    estimatedTime && {
      type: 'fare' as const,
      title: 'وقت الوصول',
      subtitle: 'تقديري',
      value: `${Math.round(estimatedTime)} دقيقة`,
      gradient: 'bg-gradient-to-r from-blue-500 to-cyan-600',
      onClick: () => onCardClick?.('time')
    },
    currentFare && {
      type: 'fare' as const,
      title: 'الأجرة المقدرة',
      value: `${currentFare.toLocaleString()} د.ع`,
      gradient: 'bg-gradient-to-r from-purple-500 to-pink-600',
      onClick: () => onCardClick?.('fare')
    },
    trafficLevel !== 'low' && {
      type: 'traffic' as const,
      title: 'الحالة المرورية',
      subtitle: trafficLevel === 'high' ? 'ازدحام مروري' : 'مرور متوسط',
      gradient: 'bg-gradient-to-r from-red-500 to-rose-600',
      onClick: () => onCardClick?.('traffic')
    }
  ].filter(Boolean);

  return (
    <div className="space-y-3 px-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.type}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <AnimatedCard {...card} isLoading={isLoading} />
        </motion.div>
      ))}
    </div>
  );
};

export default AnimatedCards;