/**
 * ران - مكون معلومات المواقع (مقتطع من ActiveRideCard)
 */

import { NavigationButton } from "./NavigationButton";

interface Location {
    lat: number;
    lng: number;
}

interface RideLocationsProps {
    pickupLocation: Location;
    pickupAddress: string | null;
    dropoffLocation: Location;
    dropoffAddress: string | null;
    status: string;
}

const RideLocations = ({
    pickupLocation,
    pickupAddress,
    dropoffLocation,
    dropoffAddress,
    status
}: RideLocationsProps) => {
    const isGoingToPickup = status === 'accepted';
    const isInProgress = status === 'in_progress';

    return (
        <div className="space-y-3 mb-4">
            {/* نقطة الالتقاء */}
            <div className="flex items-start gap-3">
                <div className={`w-3 h-3 mt-1.5 rounded-full shrink-0 ${isGoingToPickup ? 'bg-primary animate-pulse' : 'bg-primary'
                    }`} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">نقطة الالتقاء</p>
                    <p className="font-medium text-foreground truncate">
                        {pickupAddress || 'جاري التحديد...'}
                    </p>
                </div>
                {isGoingToPickup && (
                    <NavigationButton
                        lat={pickupLocation.lat}
                        lng={pickupLocation.lng}
                        label="تنقل"
                    />
                )}
            </div>

            {/* خط فاصل */}
            <div className="flex items-center gap-3 pr-1.5">
                <div className="w-0.5 h-6 bg-border mr-[5px]" />
            </div>

            {/* الوجهة */}
            <div className="flex items-start gap-3">
                <div className={`w-3 h-3 mt-1.5 rounded-full shrink-0 ${isInProgress ? 'bg-destructive animate-pulse' : 'bg-destructive'
                    }`} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">الوجهة</p>
                    <p className="font-medium text-foreground truncate">
                        {dropoffAddress || 'جاري التحديد...'}
                    </p>
                </div>
                {isInProgress && (
                    <NavigationButton
                        lat={dropoffLocation.lat}
                        lng={dropoffLocation.lng}
                        label="تنقل"
                    />
                )}
            </div>
        </div>
    );
};

export default RideLocations;
