import React, { lazy, Suspense, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Loading fallbacks
const MapLoadingSkeleton = () => (
  <div className="h-full w-full bg-muted animate-pulse flex items-center justify-center">
    <div className="text-center space-y-2">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
    </div>
  </div>
);

const ScreenLoadingSkeleton = () => (
  <div className="h-screen w-full bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-muted-foreground">جاري التحميل...</p>
    </div>
  </div>
);

const PanelLoadingSkeleton = () => (
  <div className="p-4 space-y-4">
    <Skeleton className="h-12 w-full" />
    <Skeleton className="h-20 w-full" />
    <Skeleton className="h-14 w-full" />
  </div>
);

// Helper to create lazy component with fallback
function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  Fallback: React.FC = ScreenLoadingSkeleton
) {
  const LazyComponent = lazy(importFn);
  
  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={<Fallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Lazy loaded components
export const LazyLiveRideTracker = createLazyComponent(
  () => import('./LiveRideTracker'),
  ScreenLoadingSkeleton
);

export const LazyRideWaitingScreen = createLazyComponent(
  () => import('./RideWaitingScreen'),
  ScreenLoadingSkeleton
);

export const LazyMapLocationPicker = createLazyComponent(
  () => import('./MapLocationPicker'),
  MapLoadingSkeleton
);

export const LazyLocationBottomSheet = createLazyComponent(
  () => import('./LocationBottomSheet'),
  PanelLoadingSkeleton
);

export const LazyCompleteProfileScreen = createLazyComponent(
  () => import('./CompleteProfileScreen'),
  ScreenLoadingSkeleton
);

export const LazyPaymentMethodSheet = createLazyComponent(
  () => import('./PaymentMethodSheet'),
  PanelLoadingSkeleton
);

export const LazyRiderSideMenu = createLazyComponent(
  () => import('./RiderSideMenu'),
  () => <div className="w-64 h-full bg-background animate-pulse" />
);

// Export loading components for reuse
export { MapLoadingSkeleton, ScreenLoadingSkeleton, PanelLoadingSkeleton };
