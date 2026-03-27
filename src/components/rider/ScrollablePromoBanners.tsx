/**
 * مكون الإعلانات القابلة للتمرير
 * يعرض الإعلانات بتخطيط 2+1 مع إمكانية التمرير الأفقي
 * يدعم استهداف الإعلانات حسب المنطقة
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
  region_id?: string | null;
}
interface ScrollablePromoBannersProps {
  regionId?: string;
}

// Helper function to chunk array into groups
const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

// Gradient presets for banner cards
const gradientPresets: Record<string, string> = {
  'green': 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
  'blue': 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
  'purple': 'from-purple-500/20 to-violet-500/20 border-purple-500/30',
  'orange': 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
  'pink': 'from-pink-500/20 to-rose-500/20 border-pink-500/30',
  'default': 'from-primary/10 to-primary/5 border-primary/20'
};
const getGradientClass = (gradientFrom: string): string => {
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
interface BannerCardProps {
  banner: PromoBanner;
  fullWidth?: boolean;
}
const BannerCard = ({
  banner,
  fullWidth = false
}: BannerCardProps) => {
  if (!banner) return null;
  const gradientClass = getGradientClass(banner.gradient_from);
  return <button onClick={() => banner.link_url && window.open(banner.link_url, '_blank')} className="">
      <span className="text-sm font-semibold text-foreground line-clamp-1">
        {banner.title}
      </span>
      {banner.subtitle && <span className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {banner.subtitle}
        </span>}
      {banner.discount_value && <span className="text-xs font-bold text-primary mt-1">
          {banner.discount_value}
        </span>}
    </button>;
};
const ScrollablePromoBanners = ({
  regionId
}: ScrollablePromoBannersProps) => {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        let query = supabase.from('promo_banners').select('*').eq('is_active', true).order('display_order', {
          ascending: true
        });

        // فلترة حسب المنطقة: إظهار إعلانات المنطقة + الإعلانات العامة
        if (regionId) {
          query = query.or(`region_id.is.null,region_id.eq.${regionId}`);
        }
        const {
          data,
          error
        } = await query;
        if (error) throw error;
        setBanners(data || []);
      } catch (error) {
        console.error('Error fetching banners:', error);
        // Fallback banners
        setBanners([{
          id: '1',
          title: 'رحلات المطار',
          subtitle: 'خصم خاص',
          button_text: '',
          discount_value: '20%',
          gradient_from: 'blue-500',
          gradient_via: '',
          gradient_to: '',
          link_url: '',
          is_active: true
        }, {
          id: '2',
          title: 'عروض نهاية الأسبوع',
          subtitle: 'خصم إضافي',
          button_text: '',
          discount_value: '15%',
          gradient_from: 'purple-500',
          gradient_via: '',
          gradient_to: '',
          link_url: '',
          is_active: true
        }, {
          id: '3',
          title: 'ادعُ صديقاً واحصل على رصيد مجاني',
          subtitle: '',
          button_text: '',
          discount_value: '',
          gradient_from: 'green-500',
          gradient_via: '',
          gradient_to: '',
          link_url: '',
          is_active: true
        }]);
      } finally {
        setLoading(false);
      }
    };
    fetchBanners();
  }, [regionId]);

  // Handle scroll to track current page
  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const itemWidth = scrollRef.current.offsetWidth;
      const newPage = Math.round(scrollLeft / itemWidth);
      setCurrentPage(newPage);
    }
  };
  if (loading || banners.length === 0) {
    return null;
  }

  // Group banners into sets of 3
  const bannerGroups = chunkArray(banners, 3);
  return <div className="w-full">
      {/* Scrollable container */}
      <div ref={scrollRef} onScroll={handleScroll} className="overflow-x-auto scrollbar-hide snap-x snap-mandatory" style={{
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
        <div className="flex gap-3">
          {bannerGroups.map((group, groupIdx) => <div key={groupIdx} className="min-w-full snap-center space-y-2 px-1">
              {/* First row: 2 cards side by side */}
              <div className="grid grid-cols-2 gap-2">
                {group[0] && <BannerCard banner={group[0]} />}
                {group[1] && <BannerCard banner={group[1]} />}
              </div>
              {/* Second row: full width card */}
              {group[2] && <BannerCard banner={group[2]} fullWidth />}
            </div>)}
        </div>
      </div>

      {/* Pagination dots - only show if more than one page */}
      {bannerGroups.length > 1 && <div className="flex justify-center gap-1.5 mt-3">
          {bannerGroups.map((_, idx) => <button key={idx} onClick={() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            left: idx * scrollRef.current.offsetWidth,
            behavior: 'smooth'
          });
        }
      }} className={cn("w-2 h-2 rounded-full transition-all duration-300", currentPage === idx ? "bg-primary w-4" : "bg-muted-foreground/30")} />)}
        </div>}
    </div>;
};
export default ScrollablePromoBanners;