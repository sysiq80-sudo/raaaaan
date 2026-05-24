import { motion } from "framer-motion";
import { Locate, Map, Search } from "lucide-react";

interface PickupLocationSelectorProps {
    currentAddress: string;
    onUseCurrentLocation: () => void;
    onSelectFromMap: () => void;
    onSearchLocation: () => void;
}

const PickupLocationSelector = ({
    currentAddress,
    onUseCurrentLocation,
    onSelectFromMap,
    onSearchLocation
}: PickupLocationSelectorProps) => {
    return (
        <div className="space-y-3">
            <div className="text-right">
                <p className="text-xs text-muted-foreground">نقطة الانطلاق</p>
                <p className="text-sm font-bold text-foreground truncate">
                    {currentAddress || "حدد موقعك"}
                </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onUseCurrentLocation}
                    className="items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-green-500/50 hover:bg-green-500/5 transition-all flex flex-col"
                >
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Locate className="w-5 h-5 text-green-600" />
                    </div>
                    <span className="text-[10px] font-medium text-foreground">موقعي الحالي</span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onSelectFromMap}
                    className="items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex flex-col"
                >
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Map className="w-5 h-5 text-blue-600" />
                    </div>
                    <span className="text-[10px] font-medium text-foreground">من الخريطة</span>
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onSearchLocation}
                    className="items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all flex flex-col"
                >
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Search className="w-5 h-5 text-purple-600" />
                    </div>
                    <span className="text-[10px] font-medium text-foreground">ابحث بالاسم</span>
                </motion.button>
            </div>
        </div>
    );
};

export default PickupLocationSelector;
