import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Home, Briefcase, Star, Loader2 } from "lucide-react";
import { SavedPlace } from "./SavedPlaces";

interface QuickPlacesBarProps {
  userId: string | null;
  onSelect: (place: SavedPlace) => void;
}

export const QuickPlacesBar = ({ userId, onSelect }: QuickPlacesBarProps) => {
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchQuickPlaces();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const fetchQuickPlaces = async () => {
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('saved_places')
        .select('*')
        .eq('user_id', userId)
        .in('label', ['home', 'work'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPlaces(data || []);
    } catch (error) {
      console.error('Error fetching quick places:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!userId || places.length === 0) {
    return null;
  }

  const homePlace = places.find(p => p.label === 'home');
  const workPlace = places.find(p => p.label === 'work');

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {homePlace && (
        <button
          onClick={() => onSelect(homePlace)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/20 transition-all shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Home className="w-4 h-4" />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">المنزل</p>
            <p className="text-xs text-blue-500/70 max-w-[120px] truncate">{homePlace.address}</p>
          </div>
        </button>
      )}
      
      {workPlace && (
        <button
          onClick={() => onSelect(workPlace)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/20 transition-all shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">العمل</p>
            <p className="text-xs text-amber-500/70 max-w-[120px] truncate">{workPlace.address}</p>
          </div>
        </button>
      )}
    </div>
  );
};

export default QuickPlacesBar;