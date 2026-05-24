/**
 * ران - Memoized Components Wrapper
 * يحسّن الأداء بمنع الرسم المتكرر
 */

import React, { memo, useMemo, useCallback } from "react";

/**
 * Memo wrapper للـ components مع deep comparison
 */
export const withMemo = <P extends object>(
  Component: React.ComponentType<P>,
  name?: string
) => {
  const MemoizedComponent = memo(Component, (prevProps, nextProps) => {
    // العودة true = لا ترسم (same props)
    // العودة false = ارسم (different props)
    return JSON.stringify(prevProps) === JSON.stringify(nextProps);
  });

  if (name) {
    MemoizedComponent.displayName = `memo(${name})`;
  }

  return MemoizedComponent;
};

/**
 * Hook للـ memoized values مع dependencies
 */
export const useMemoizedValue = <T>(value: T, dependencies: any[]) => {
  return useMemo(() => value, dependencies);
};

/**
 * Hook للـ memoized callbacks
 */
export const useMemoizedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  dependencies: any[]
) => {
  return useCallback(callback, dependencies);
};

/**
 * Wrapper لـ Mapbox Map component
 * يحتوي على memoization للـ map events والـ layers
 */
export const MemoizedMapComponent = memo(
  ({
    mapInstance,
    layers,
    sources,
    onMapLoad,
  }: {
    mapInstance: any;
    layers: any[];
    sources: any[];
    onMapLoad?: () => void;
  }) => {
    const memoizedLayers = useMemo(() => layers, [JSON.stringify(layers)]);
    const memoizedSources = useMemo(() => sources, [JSON.stringify(sources)]);

    return React.createElement("div", { className: "w-full h-full" });
  },
  (prevProps, nextProps) => {
    // Custom comparison for Mapbox
    return (
      prevProps.mapInstance === nextProps.mapInstance &&
      JSON.stringify(prevProps.layers) === JSON.stringify(nextProps.layers) &&
      JSON.stringify(prevProps.sources) === JSON.stringify(nextProps.sources)
    );
  }
);

MemoizedMapComponent.displayName = "MemoizedMapComponent";

/**
 * Wrapper for Route Display
 */
export const MemoizedRouteDisplay = memo(
  ({ route, distance, duration }: any) => {
    const memoizedRoute = useMemo(() => route, [JSON.stringify(route)]);

    return React.createElement(
      "div",
      { className: "space-y-2" },
      memoizedRoute
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("p", null, "Distance: ", distance, " km"),
            React.createElement("p", null, "Expected time: ", duration, " min")
          )
        : null
    );
  },
  (prev, next) => JSON.stringify(prev) === JSON.stringify(next)
);

MemoizedRouteDisplay.displayName = "MemoizedRouteDisplay";
