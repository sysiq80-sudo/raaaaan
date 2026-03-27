/**
 * ران - Skeleton للسائق
 */

import { Skeleton } from "@/components/common/Skeletons";

// Skeleton لبطاقة الرحلة النشطة
export const ActiveRideSkeleton = () => (
    <div className="border-2 border-primary rounded-xl overflow-hidden animate-pulse">
        {/* Header */}
        <div className="bg-primary/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-primary/30 rounded" />
                <div className="h-4 w-24 bg-primary/30 rounded" />
            </div>
            <div className="h-6 w-16 bg-primary/30 rounded-full" />
        </div>

        <div className="p-4 space-y-4">
            {/* معلومات الراكب */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-3 w-16 bg-muted rounded" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="w-10 h-10 bg-muted rounded-full" />
                    <div className="w-10 h-10 bg-muted rounded-full" />
                </div>
            </div>

            {/* المواقع */}
            <div className="space-y-3">
                <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1">
                        <div className="h-3 w-16 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                    </div>
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
                    <div className="flex-1 space-y-1">
                        <div className="h-3 w-12 bg-muted rounded" />
                        <div className="h-4 w-full bg-muted rounded" />
                    </div>
                </div>
            </div>

            {/* الأجرة */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
                <div className="h-6 w-20 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
            </div>

            {/* الأزرار */}
            <div className="h-14 w-full bg-muted rounded-xl" />
        </div>
    </div>
);

// Skeleton لطلب الرحلة
export const RideRequestSkeleton = () => (
    <div className="border-2 border-amber-500/50 rounded-xl overflow-hidden animate-pulse">
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-4 py-3">
            <div className="flex items-center justify-between">
                <div className="h-5 w-32 bg-amber-500/30 rounded" />
                <div className="h-8 w-16 bg-amber-500/30 rounded-full" />
            </div>
        </div>

        <div className="p-4 space-y-4">
            {/* المواقع */}
            <div className="space-y-2">
                <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
                    <div className="h-4 w-2/3 bg-muted rounded" />
                </div>
                <div className="flex items-start gap-3">
                    <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
                    <div className="h-4 w-1/2 bg-muted rounded" />
                </div>
            </div>

            {/* المعلومات */}
            <div className="flex gap-4">
                <div className="h-5 w-20 bg-muted rounded" />
                <div className="h-5 w-16 bg-muted rounded" />
                <div className="h-5 w-24 bg-muted rounded" />
            </div>

            {/* الأزرار */}
            <div className="flex gap-3">
                <div className="h-12 flex-1 bg-muted rounded-xl" />
                <div className="h-12 flex-1 bg-muted rounded-xl" />
            </div>
        </div>
    </div>
);

// Skeleton للإحصائيات
export const DriverStatsSkeleton = () => (
    <div className="grid grid-cols-3 gap-3 animate-pulse">
        {[1, 2, 3].map((i) => (
            <div key={i} className="bg-card rounded-xl p-4 border border-border">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-muted" />
                <div className="h-6 w-12 mx-auto bg-muted rounded mb-1" />
                <div className="h-3 w-16 mx-auto bg-muted rounded" />
            </div>
        ))}
    </div>
);

// Skeleton للخريطة
export const DriverMapSkeleton = () => (
    <div className="relative w-full h-[300px] bg-muted animate-pulse rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-primary/40" />
            </div>
        </div>
    </div>
);

// Skeleton للصفحة الرئيسية للسائق
export const DriverHomeSkeleton = () => (
    <div className="min-h-screen bg-background animate-pulse">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-border">
            <div className="h-10 w-10 bg-muted rounded-full" />
            <div className="h-8 w-24 bg-muted rounded" />
            <div className="h-10 w-10 bg-muted rounded-full" />
        </div>

        {/* Online Toggle */}
        <div className="p-4">
            <div className="h-16 w-full bg-muted rounded-xl" />
        </div>

        {/* Stats */}
        <div className="px-4">
            <DriverStatsSkeleton />
        </div>

        {/* Map */}
        <div className="p-4">
            <DriverMapSkeleton />
        </div>
    </div>
);

export default {
    ActiveRideSkeleton,
    RideRequestSkeleton,
    DriverStatsSkeleton,
    DriverMapSkeleton,
    DriverHomeSkeleton,
};
