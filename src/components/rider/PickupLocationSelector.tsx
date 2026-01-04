/**
 * ران - مكون اختيار نقطة الانطلاق
 * زر عائم قابل للسحب مع خيارات متعددة + الأماكن المحفوظة
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useDragControls, PanInfo } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
    MapPin,
    Navigation,
    Map,
    Search,
    ChevronDown,
    GripVertical,
    Locate,
    Home,
    Briefcase,
    Star,
    ChevronRight
} from "lucide-react";

interface SavedPlace {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    label: string;
}

interface PickupLocationSelectorProps {
    currentAddress: string;
    userId?: string | null;
    onUseCurrentLocation: () => void;
    onSelectFromMap: () => void;
    onSearchLocation: () => void;
    onSelectSavedPlace?: (place: { lat: number; lng: number; address: string }) => void;
}

const PickupLocationSelector = ({
    currentAddress,
    userId,
    onUseCurrentLocation,
    onSelectFromMap,
    onSearchLocation,
    onSelectSavedPlace
}: PickupLocationSelectorProps) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 16, y: 128 });
    const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
    const [showSavedPlaces, setShowSavedPlaces] = useState(false);
    const constraintsRef = useRef<HTMLDivElement>(null);
    const dragControls = useDragControls();

    // Load saved position from localStorage
    useEffect(() => {
        const savedPosition = localStorage.getItem('pickup_button_position');
        if (savedPosition) {
            try {
                const parsed = JSON.parse(savedPosition);
                setPosition(parsed);
            } catch (e) {
                console.error('Error parsing saved position:', e);
            }
        }
    }, []);

    // Load saved places
    useEffect(() => {
        const fetchSavedPlaces = async () => {
            if (!userId) return;

            const { data } = await supabase
                .from('saved_places')
                .select('*')
                .eq('user_id', userId)
                .limit(5);

            if (data) {
                setSavedPlaces(data);
            }
        };

        fetchSavedPlaces();
    }, [userId]);

    // Save position to localStorage
    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const newPosition = {
            x: position.x + info.offset.x,
            y: position.y + info.offset.y
        };

        // Keep within screen bounds
        const maxX = window.innerWidth - 280;
        const maxY = window.innerHeight - 200;

        newPosition.x = Math.max(8, Math.min(maxX, newPosition.x));
        newPosition.y = Math.max(80, Math.min(maxY, newPosition.y));

        setPosition(newPosition);
        localStorage.setItem('pickup_button_position', JSON.stringify(newPosition));
        setIsDragging(false);
    };

    const getIconForLabel = (label: string) => {
        switch (label) {
            case 'home': return <Home className="w-4 h-4 text-blue-600" />;
            case 'work': return <Briefcase className="w-4 h-4 text-amber-600" />;
            default: return <Star className="w-4 h-4 text-purple-600" />;
        }
    };

    return (
        <>
            {/* Invisible constraints container */}
            <div
                ref={constraintsRef}
                className="fixed inset-0 pointer-events-none z-30"
            />

            <motion.div
                drag
                dragControls={dragControls}
                dragMomentum={false}
                dragElastic={0.1}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    x: position.x,
                    y: position.y
                }}
                style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
                className={`touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
                <div className="relative">
                    {/* Drag Handle */}
                    <motion.div
                        className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 rounded-t-lg bg-muted/80 flex items-center justify-center cursor-grab active:cursor-grabbing"
                        whileHover={{ backgroundColor: 'hsl(var(--primary) / 0.2)' }}
                    >
                        <GripVertical className="w-3 h-3 text-muted-foreground" />
                    </motion.div>

                    {/* Main Floating Button */}
                    <motion.button
                        onClick={() => !isDragging && setIsExpanded(!isExpanded)}
                        whileHover={{ scale: isDragging ? 1 : 1.02 }}
                        whileTap={{ scale: isDragging ? 1 : 0.98 }}
                        className={`
                            flex items-center gap-3 px-4 py-3 rounded-2xl
                            bg-card/95 backdrop-blur-xl border border-border/50
                            shadow-xl hover:shadow-2xl transition-all
                            ${isExpanded ? 'rounded-b-none border-b-0' : ''}
                            ${isDragging ? 'ring-2 ring-primary/50' : ''}
                        `}
                    >
                        {/* Animated Pin */}
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                                <Navigation className="w-5 h-5 text-white" />
                            </div>
                            {!isDragging && (
                                <>
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-ping" />
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full" />
                                </>
                            )}
                        </div>

                        {/* Location Info */}
                        <div className="text-right max-w-[160px]">
                            <p className="text-[10px] text-muted-foreground font-medium">
                                {isDragging ? '🔄 اسحب للتحريك' : 'نقطة الانطلاق'}
                            </p>
                            <p className="text-sm font-bold text-foreground truncate">
                                {isDragging ? 'أفلت هنا' : (currentAddress || 'حدد موقعك')}
                            </p>
                        </div>

                        {/* Expand Icon */}
                        {!isDragging && (
                            <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </motion.div>
                        )}
                    </motion.button>

                    {/* Expanded Options */}
                    <AnimatePresence>
                        {isExpanded && !isDragging && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-card/95 backdrop-blur-xl border border-border/50 border-t-0 rounded-b-2xl shadow-xl p-2 space-y-1">
                                    {/* Use Current Location */}
                                    <motion.button
                                        whileHover={{ x: 5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            onUseCurrentLocation();
                                            setIsExpanded(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-green-500/10 transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
                                            <Locate className="w-4 h-4 text-green-600" />
                                        </div>
                                        <div className="text-right flex-1">
                                            <p className="text-sm font-medium text-foreground">موقعي الحالي</p>
                                            <p className="text-[10px] text-muted-foreground">استخدم GPS</p>
                                        </div>
                                    </motion.button>

                                    {/* Select from Map */}
                                    <motion.button
                                        whileHover={{ x: 5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            onSelectFromMap();
                                            setIsExpanded(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-500/10 transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                                            <Map className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div className="text-right flex-1">
                                            <p className="text-sm font-medium text-foreground">اختر من الخريطة</p>
                                            <p className="text-[10px] text-muted-foreground">حدد على الخريطة</p>
                                        </div>
                                    </motion.button>

                                    {/* Search by Name */}
                                    <motion.button
                                        whileHover={{ x: 5 }}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => {
                                            onSearchLocation();
                                            setIsExpanded(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-500/10 transition-colors group"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center group-hover:bg-purple-500/30 transition-colors">
                                            <Search className="w-4 h-4 text-purple-600" />
                                        </div>
                                        <div className="text-right flex-1">
                                            <p className="text-sm font-medium text-foreground">ابحث بالاسم</p>
                                            <p className="text-[10px] text-muted-foreground">حي، شارع، مكان</p>
                                        </div>
                                    </motion.button>

                                    {/* Saved Places Toggle */}
                                    {savedPlaces.length > 0 && (
                                        <>
                                            <div className="border-t border-border/50 my-2" />
                                            <motion.button
                                                whileHover={{ x: 5 }}
                                                whileTap={{ scale: 0.98 }}
                                                onClick={() => setShowSavedPlaces(!showSavedPlaces)}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-amber-500/10 transition-colors group"
                                            >
                                                <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center group-hover:bg-amber-500/30 transition-colors">
                                                    <Star className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div className="text-right flex-1">
                                                    <p className="text-sm font-medium text-foreground">أماكني المحفوظة</p>
                                                    <p className="text-[10px] text-muted-foreground">{savedPlaces.length} مكان</p>
                                                </div>
                                                <motion.div
                                                    animate={{ rotate: showSavedPlaces ? 90 : 0 }}
                                                    transition={{ duration: 0.2 }}
                                                >
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                </motion.div>
                                            </motion.button>

                                            {/* Saved Places List */}
                                            <AnimatePresence>
                                                {showSavedPlaces && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden space-y-1 pr-4"
                                                    >
                                                        {savedPlaces.map((place) => (
                                                            <motion.button
                                                                key={place.id}
                                                                whileHover={{ x: 3 }}
                                                                whileTap={{ scale: 0.98 }}
                                                                onClick={() => {
                                                                    if (onSelectSavedPlace) {
                                                                        onSelectSavedPlace({
                                                                            lat: place.lat,
                                                                            lng: place.lng,
                                                                            address: place.address || place.name
                                                                        });
                                                                    }
                                                                    setIsExpanded(false);
                                                                    setShowSavedPlaces(false);
                                                                }}
                                                                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                                                            >
                                                                <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                                                                    {getIconForLabel(place.label)}
                                                                </div>
                                                                <div className="text-right flex-1 min-w-0">
                                                                    <p className="text-xs font-medium text-foreground truncate">{place.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground truncate">{place.address}</p>
                                                                </div>
                                                            </motion.button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </>
    );
};

export default PickupLocationSelector;
