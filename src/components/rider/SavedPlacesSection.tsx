/**
 * ران - مكون الأماكن المحفوظة المحسّن
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
    MapPin,
    Plus,
    Home,
    Briefcase,
    Heart,
    ChevronLeft,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/common/Skeletons";

interface SavedPlace {
    id: string;
    name: string;
    address: string;
    place_type?: string;
    icon?: string;
    label?: string;
    lat: number;
    lng: number;
}

interface SavedPlacesSectionProps {
    userId: string | null;
    onPlaceSelect?: (place: SavedPlace) => void;
}

const placeIcons: Record<string, React.ReactNode> = {
    home: <Home className="w-4 h-4" />,
    work: <Briefcase className="w-4 h-4" />,
    favorite: <Heart className="w-4 h-4" />,
    other: <MapPin className="w-4 h-4" />,
};

const SavedPlacesSection = ({ userId, onPlaceSelect }: SavedPlacesSectionProps) => {
    const [places, setPlaces] = useState<SavedPlace[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (userId) {
            fetchPlaces();
        } else {
            setLoading(false);
        }
    }, [userId]);

    const fetchPlaces = async () => {
        try {
            const { data, error } = await supabase
                .from("saved_places")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(5);

            if (!error && data) {
                setPlaces(data);
            }
        } catch (e) {
            console.error("Error fetching places:", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-8 w-20 rounded-full" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="w-32 h-20 rounded-xl shrink-0" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    أماكني المحفوظة
                </h3>
                <Link to="/rider/saved-places">
                    <Button variant="ghost" size="sm" className="text-primary h-8 gap-1">
                        الكل
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </Link>
            </div>

            {/* Places */}
            {places.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-6 text-center border border-primary/20"
                >
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-8 h-8 text-primary" />
                    </div>
                    <h4 className="font-bold text-foreground mb-2">احفظ أماكنك المفضلة</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                        أضف البيت، العمل، أو أي مكان تزوره كثيراً للوصول السريع
                    </p>
                    <Link to="/rider/saved-places">
                        <Button className="gap-2">
                            <Plus className="w-4 h-4" />
                            إضافة مكان
                        </Button>
                    </Link>
                </motion.div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {/* Add new place button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { }}
                        className="w-20 h-20 shrink-0 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1 text-primary hover:bg-primary/10 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span className="text-[10px] font-medium">إضافة</span>
                    </motion.button>

                    {/* Saved places */}
                    <AnimatePresence>
                        {places.map((place, index) => (
                            <motion.button
                                key={place.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onPlaceSelect?.(place)}
                                className="min-w-[120px] p-3 shrink-0 rounded-xl bg-card border border-border hover:border-primary/50 transition-all text-right"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        {placeIcons[place.place_type] || placeIcons.other}
                                    </div>
                                </div>
                                <p className="font-medium text-sm text-foreground truncate">
                                    {place.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                    {place.address}
                                </p>
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default SavedPlacesSection;
