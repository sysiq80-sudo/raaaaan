/**
 * ران - مكون عرض الموقع الحالي المحسّن
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/common/Skeletons";

interface CurrentLocationDisplayProps {
    location: { lat: number; lng: number } | null;
    address: string | null;
    loading: boolean;
    error: string | null;
    onRefresh: () => void;
    onUseLocation: () => void;
}

const CurrentLocationDisplay = ({
    location,
    address,
    loading,
    error,
    onRefresh,
    onUseLocation
}: CurrentLocationDisplayProps) => {
    const [pulse, setPulse] = useState(true);

    useEffect(() => {
        if (location && address) {
            setPulse(false);
        }
    }, [location, address]);

    if (error) {
        return (
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 flex items-center gap-3"
            >
                <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">تعذر تحديد الموقع</p>
                    <p className="text-xs text-muted-foreground">{error}</p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    className="shrink-0"
                >
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </motion.div>
        );
    }

    if (loading) {
        return (
            <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-32" />
                        <div className="h-3 bg-muted rounded w-48" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20 rounded-xl p-4"
        >
            <div className="flex items-center gap-3">
                {/* Icon with pulse effect */}
                <div className="relative">
                    <div className={`w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center ${pulse ? 'animate-pulse' : ''
                        }`}>
                        <Navigation className="w-5 h-5 text-primary" />
                    </div>
                    {pulse && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping" />
                    )}
                </div>

                {/* Location info */}
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">موقعك الحالي</p>
                    <p className="font-medium text-foreground text-sm truncate">
                        {address || 'جاري التحديد...'}
                    </p>
                </div>

                {/* Use location button */}
                <Button
                    size="sm"
                    onClick={onUseLocation}
                    className="shrink-0 gap-1 bg-primary/90 hover:bg-primary"
                >
                    <MapPin className="w-4 h-4" />
                    استخدم
                </Button>
            </div>

            {/* Coordinates (optional) */}
            {location && (
                <div className="mt-2 pt-2 border-t border-primary/10">
                    <p className="text-[10px] text-muted-foreground font-mono text-center">
                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                    </p>
                </div>
            )}
        </motion.div>
    );
};

export default CurrentLocationDisplay;
