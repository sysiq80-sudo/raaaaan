/**
 * ران - Lazy Loading Wrapper
 * مكون لتحميل المكونات بشكل كسول مع Skeleton
 */

import { Suspense, lazy, ComponentType, LazyExoticComponent } from 'react';
import { Skeleton, MapSkeleton, HomePageSkeleton, ProfileSkeleton } from './Skeletons';
import { Loader2 } from 'lucide-react';
import SplashScreen from './SplashScreen';

// Fallback بسيط
const SimpleFallback = () => (
    <div className="min-h-[200px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
);

// Fallback للصفحة كاملة — يستخدم SplashScreen الفاخر
const PageFallback = () => <SplashScreen />;

// أنواع Fallback المتاحة
type FallbackType = 'simple' | 'page' | 'map' | 'home' | 'profile' | 'skeleton';

// دالة للحصول على Fallback المناسب
const getFallback = (type: FallbackType) => {
    switch (type) {
        case 'simple':
            return <SimpleFallback />;
        case 'page':
            return <PageFallback />;
        case 'map':
            return <MapSkeleton />;
        case 'home':
            return <HomePageSkeleton />;
        case 'profile':
            return <ProfileSkeleton />;
        case 'skeleton':
        default:
            return <Skeleton className="w-full h-40" />;
    }
};

// Props للـ Wrapper
interface LazyLoadProps {
    children: React.ReactNode;
    fallbackType?: FallbackType;
    fallback?: React.ReactNode;
}

// Wrapper Component
export const LazyLoad = ({
    children,
    fallbackType = 'simple',
    fallback
}: LazyLoadProps) => (
    <Suspense fallback={fallback || getFallback(fallbackType)}>
        {children}
    </Suspense>
);

// دالة مساعدة لإنشاء Lazy Component مع Fallback
export function createLazyComponent<T extends ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    fallbackType: FallbackType = 'simple'
) {
    const LazyComponent = lazy(importFn);

    return function LazyWrapper(props: React.ComponentProps<T>) {
        return (
            <Suspense fallback={getFallback(fallbackType)}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}

// تصدير Lazy Components الجاهزة للاستخدام
export const LazyComponents = {
    // Rider - GoPage is the main rider page now
    GoPage: createLazyComponent(
        () => import('@/pages/rider/GoPage'),
        'home'
    ),

    // Heavy components
    LiveRideTracker: createLazyComponent(
        () => import('@/components/rider/LiveRideTracker'),
        'map'
    ),
    MapLocationPicker: createLazyComponent(
        () => import('@/components/rider/MapLocationPicker'),
        'map'
    ),
    RideWaitingScreen: createLazyComponent(
        () => import('@/components/rider/RideWaitingScreen'),
        'page'
    ),
};

export default LazyLoad;
