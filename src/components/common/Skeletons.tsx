/**
 * ران - Skeleton Components
 * مكونات التحميل الهيكلي لتجربة مستخدم أفضل
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
    className?: string;
}

// Skeleton أساسي
export const Skeleton = ({ className }: SkeletonProps) => (
    <div className={cn(
        "animate-pulse bg-muted rounded-md",
        className
    )} />
);

// Skeleton للخريطة
export const MapSkeleton = () => (
    <div className="relative w-full h-[400px] bg-muted animate-pulse rounded-xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10" />
        <div className="absolute top-4 left-4 right-4">
            <div className="h-12 bg-background/50 rounded-xl" />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
            <div className="h-24 bg-background/50 rounded-xl" />
        </div>
    </div>
);

// Skeleton لبطاقة السائق
export const DriverCardSkeleton = () => (
    <div className="p-4 bg-card rounded-xl border border-border animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-32" />
                <div className="h-3 bg-muted rounded w-24" />
            </div>
            <div className="space-y-2">
                <div className="h-8 w-8 bg-muted rounded-full" />
            </div>
        </div>
        <div className="mt-4 flex gap-2">
            <div className="h-6 bg-muted rounded-full w-20" />
            <div className="h-6 bg-muted rounded-full w-16" />
        </div>
    </div>
);

// Skeleton لبطاقة الرحلة
export const RideCardSkeleton = () => (
    <div className="p-4 bg-card rounded-xl border border-border animate-pulse">
        <div className="flex items-center justify-between mb-3">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-6 bg-muted rounded-full w-16" />
        </div>
        <div className="space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded flex-1" />
            </div>
            <div className="flex items-start gap-3">
                <div className="w-3 h-3 mt-1 rounded-full bg-muted" />
                <div className="h-4 bg-muted rounded flex-1" />
            </div>
        </div>
        <div className="mt-4 flex justify-between items-center">
            <div className="h-5 bg-muted rounded w-20" />
            <div className="h-4 bg-muted rounded w-16" />
        </div>
    </div>
);

// Skeleton لقائمة الرحلات
export const RidesListSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
            <RideCardSkeleton key={i} />
        ))}
    </div>
);

// Skeleton لشاشة الانتظار
export const WaitingScreenSkeleton = () => (
    <div className="min-h-screen bg-background p-4 animate-pulse">
        <div className="max-w-md mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="h-8 w-8 bg-muted rounded-full" />
                <div className="h-6 bg-muted rounded w-32" />
                <div className="h-8 w-8 bg-muted rounded-full" />
            </div>

            {/* Animation circle */}
            <div className="w-40 h-40 mx-auto rounded-full bg-muted" />

            {/* Text */}
            <div className="text-center space-y-2">
                <div className="h-6 bg-muted rounded w-48 mx-auto" />
                <div className="h-4 bg-muted rounded w-32 mx-auto" />
            </div>

            {/* Stats */}
            <div className="flex justify-center gap-8">
                <div className="text-center space-y-1">
                    <div className="h-8 w-8 bg-muted rounded-full mx-auto" />
                    <div className="h-3 bg-muted rounded w-16" />
                </div>
                <div className="text-center space-y-1">
                    <div className="h-8 w-8 bg-muted rounded-full mx-auto" />
                    <div className="h-3 bg-muted rounded w-16" />
                </div>
            </div>

            {/* Card */}
            <div className="p-4 bg-card rounded-xl border space-y-3">
                <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-muted mt-1" />
                    <div className="h-4 bg-muted rounded flex-1" />
                </div>
                <div className="flex gap-3">
                    <div className="w-3 h-3 rounded-full bg-muted mt-1" />
                    <div className="h-4 bg-muted rounded flex-1" />
                </div>
            </div>

            {/* Button */}
            <div className="h-12 bg-muted rounded-xl" />
        </div>
    </div>
);

// Skeleton للصفحة الرئيسية
export const HomePageSkeleton = () => (
    <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
            <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
            <div className="h-10 w-10 bg-muted rounded-full animate-pulse" />
        </div>

        {/* Map */}
        <MapSkeleton />

        {/* Bottom panel */}
        <div className="p-4 space-y-4">
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
            <div className="flex gap-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 flex-1 bg-muted rounded-xl animate-pulse" />
                ))}
            </div>
            <div className="h-14 bg-primary/20 rounded-xl animate-pulse" />
        </div>
    </div>
);

// Skeleton للملف الشخصي
export const ProfileSkeleton = () => (
    <div className="p-6 space-y-6 animate-pulse">
        <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted" />
            <div className="space-y-2">
                <div className="h-5 bg-muted rounded w-32" />
                <div className="h-4 bg-muted rounded w-24" />
            </div>
        </div>
        <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-14 bg-muted rounded-xl" />
            ))}
        </div>
    </div>
);

export default Skeleton;
