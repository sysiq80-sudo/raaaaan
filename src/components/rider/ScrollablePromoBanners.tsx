/**
 * مكون الإعلانات القابلة للتمرير
 * Premium Promotional Banners with animations
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Gift, Percent, Star, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";

interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  button_text: string;
  discount_value: string;
  gradient_from: string;
  gradient_via: string;
  gradient_to: string;
  link_url: string;
  is_active: boolean;
  icon_type?: string;
  region_id?: string | null;
}

interface ScrollablePromoBannersProps {
  regionId?: string | null;
}

const gradientPresets: Record<string, { bg: string; icon: string; glow: string }> = {
  'green': { 
    bg: 'from-emerald-500/20 via-teal-500/10 to-transparent', 
    icon: 'text-emerald-500',
    glow: 'shadow-emerald-500/20'
  },
  'blue': { 
    bg: 'from-blue-500/20 via-cyan-500/10 to-transparent', 
    icon: 'text-blue-500',
    glow: 'shadow-blue-500/20'
  },
  'purple': { 
    bg: 'from-purple-500/20 via-violet-500/10 to-transparent', 
    icon: 'text-purple-500',
    glow: 'shadow-purple-500/20'
  },
  'orange': { 
    bg: 'from-orange-500/20 via-amber-500/10 to-transparent', 
    icon: 'text-orange-500',
    glow: 'shadow-orange-500/20'
  },
  'pink': { 
    bg: 'from-pink-500/20 via-rose-500/10 to-transparent', 
    icon: 'text-pink-500',
    glow: 'shadow-pink-500/20'
  },
  'default': { 
    bg: 'from-primary/20 via-primary/10 to-transparent', 
    icon: 'text-primary',
    glow: 'shadow-primary/20'
  }
};

const getPreset = (gradientFrom: string) => {
  if (gradientFrom?.includes('green') || gradientFrom?.includes('emerald') || gradientFrom?.includes('teal')) {
    return gradientPresets['green'];
  }
  if (gradientFrom?.includes('blue') || gradientFrom?.includes('cyan')) {
    return gradientPresets['blue'];
  }
  if (gradientFrom?.includes('purple') || gradientFrom?.includes('violet')) {
    return gradientPresets['purple'];
  }
  if (gradientFrom?.includes('orange') || gradientFrom?.includes('amber')) {
    return gradientPresets['orange'];
  }
  if (gradientFrom?.includes('pink') || gradientFrom?.includes('rose')) {
    return gradientPresets['pink'];
  }
  return gradientPresets['default'];
};

const getIcon = (iconType?: string) => {
  switch (iconType) {
    case 'gift': return Gift;
    case 'star': return Star;
    case 'sparkles': return Sparkles;
    default: return Percent;
  }
};

interface BannerCardProps {
  banner: PromoBanner;
  index: number;
}

const BannerCard = ({ banner, index }: BannerCardProps) => {
  if (!banner) return null;
  
  const preset = getPreset(banner.gradient_from);
  const Icon = getIcon(banner.icon_type);
  
  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => banner.link_url && window.open(banner.link_url, '_blank')}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 text-right transition-all duration-300",
        "bg-gradient-to-l border border-border/30",
        "hover:shadow-lg hover:border-primary/20",
        preset.bg,
        preset.glow
      )}
    >
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-20 h-20 rounded-full bg-gradient-to-br from-white/5 to-transparent -translate-x-1/2 -translate-y-1/2" />
      
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={cn(
          "w-10 h-10 rounded-xl bg-background/50 backdrop-blur-sm flex items-center justify-center",
          preset.icon
        )}>
          <Icon className="w-5 h-5" />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate text-foreground">
            {banner.title}
          </p>
          {banner.subtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {banner.subtitle}
            </p>
          )}
        </div>
        
        {/* Discount badge */}
        {banner.discount_value && (
          <div className={cn(
            "px-3 py-1.5 rounded-xl bg-background/80 backdrop-blur-sm font-bold text-sm",
            preset.icon
          )}>
            {banner.discount_value}
          </div>
        )}
      </div>
    </motion.button>
  );
};

const ScrollablePromoBanners = ({ regionId }: ScrollablePromoBannersProps) => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        let query = supabase
          .from('promo_banners')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (regionId) {
          query = query.or(`region_id.is.null,region_id.eq.${regionId}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setBanners(data || []);
      } catch (error) {
        console.error('Error fetching banners:', error);
        // Fallback banners
        setBanners([
          {
            id: '1',
            title: 'رحلات المطار',
            subtitle: 'خصم خاص على جميع الرحلات',
            button_text: '',
            discount_value: '20%',
            gradient_from: 'blue-500',
            gradient_via: '',
            gradient_to: '',
            link_url: '',
            icon_type: 'star',
            is_active: true
          },
          {
            id: '2',
            title: 'ادعُ صديقاً',
            subtitle: 'واحصل على رصيد مجاني',
            button_text: '',
            discount_value: '5000',
            gradient_from: 'green-500',
            gradient_via: '',
            gradient_to: '',
            link_url: '/rider/referrals',
            icon_type: 'gift',
            is_active: true
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, [regionId]);

  // Auto-scroll
  useEffect(() => {
    if (banners.length <= 1) return;

    autoScrollRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % banners.length);
    }, 5000);

    return () => {
      if (autoScrollRef.current) {
        clearInterval(autoScrollRef.current);
      }
    };
  }, [banners.length]);

  // Scroll to current index
  useEffect(() => {
    if (scrollRef.current && banners.length > 1) {
      scrollRef.current.scrollTo({
        left: currentIndex * scrollRef.current.offsetWidth,
        behavior: 'smooth'
      });
    }
  }, [currentIndex, banners.length]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const itemWidth = scrollRef.current.offsetWidth;
      const newIndex = Math.round(scrollLeft / itemWidth);
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }
  };

  if (loading) {
    return (
      <div className="h-16 rounded-2xl bg-secondary/50 animate-pulse" />
    );
  }

  if (banners.length === 0) {
    return null;
  }

  // Single banner - just show it
  if (banners.length === 1) {
    return <BannerCard banner={banners[0]} index={0} />;
  }

  return (
    <div className="relative">
      {/* Scrollable container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex">
          {banners.map((banner, idx) => (
            <div key={banner.id} className="min-w-full snap-center px-0.5">
              <BannerCard banner={banner} index={idx} />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex(prev => (prev - 1 + banners.length) % banners.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentIndex(prev => (prev + 1) % banners.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Pagination dots */}
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                currentIndex === idx 
                  ? "bg-primary w-6" 
                  : "bg-muted-foreground/30 w-1.5 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScrollablePromoBanners;
