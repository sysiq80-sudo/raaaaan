/**
 * ران - Performance Monitoring Hook
 * يراقب الأداء والتأخيرات
 */

import { useEffect, useRef, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";

export interface PerformanceMetrics {
  pageLoadTime: number;
  timeToFirstPaint: number;
  timeToLargestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay: number;
}

export const usePerformanceMonitoring = (pageName: string) => {
  const metricsRef = useRef<PerformanceMetrics>({
    pageLoadTime: 0,
    timeToFirstPaint: 0,
    timeToLargestContentfulPaint: 0,
    cumulativeLayoutShift: 0,
    firstInputDelay: 0,
  });

  useEffect(() => {
    // قياس أداء الصفحة عند التحميل
    const measurePageLoad = () => {
      if ("performance" in window) {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;

        metricsRef.current.pageLoadTime = pageLoadTime;

        trackEvent("performance_metric", {
          metricName: `${pageName}_page_load`,
          duration: pageLoadTime,
        });

        console.log(
          `Performance: ${pageName} Page Load Time: ${pageLoadTime}ms`
        );
      }
    };

    // قياس Web Vitals
    const measureWebVitals = () => {
      // Largest Contentful Paint (LCP)
      if ("PerformanceObserver" in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as unknown as {
              renderTime?: number;
              startTime: number;
            };
            metricsRef.current.timeToLargestContentfulPaint =
              (lastEntry.renderTime ?? 0) || lastEntry.startTime;
            trackEvent("performance_metric", {
              metricName: `${pageName}_lcp`,
              duration: metricsRef.current.timeToLargestContentfulPaint,
            });
          });

          lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

          return () => lcpObserver.disconnect();
        } catch (error) {
          console.warn("LCP measurement not supported:", error);
        }
      }
    };

    // قياس التأخير عند أول إدخال
    if ("PerformanceObserver" in window) {
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const perfEntry = entry as unknown as { processingStart: number };
            if (
              perfEntry &&
              perfEntry.processingStart &&
              perfEntry.processingStart - entry.startTime > 0
            ) {
              metricsRef.current.firstInputDelay =
                perfEntry.processingStart - entry.startTime;
              trackEvent("performance_metric", {
                metricName: `${pageName}_fid`,
                duration: metricsRef.current.firstInputDelay,
              });
            }
          });
        });

        fidObserver.observe({ entryTypes: ["first-input"] });

        return () => fidObserver.disconnect();
      } catch (error) {
        console.warn("FID measurement not supported:", error);
      }
    }

    // قياس Cumulative Layout Shift
    if ("PerformanceObserver" in window) {
      try {
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            const layoutEntry = entry as unknown as {
              hadRecentInput?: boolean;
              value?: number;
            };
            if (
              layoutEntry &&
              !layoutEntry.hadRecentInput &&
              layoutEntry.value
            ) {
              metricsRef.current.cumulativeLayoutShift += layoutEntry.value;
              trackEvent("performance_metric", {
                metricName: `${pageName}_cls`,
                duration: metricsRef.current.cumulativeLayoutShift,
              });
            }
          });
        });

        clsObserver.observe({ entryTypes: ["layout-shift"] });

        return () => clsObserver.disconnect();
      } catch (error) {
        console.warn("CLS measurement not supported:", error);
      }
    }

    // قياس الوقت الإجمالي عند تحميل الصفحة
    window.addEventListener("load", measurePageLoad);
    const cleanup = measureWebVitals();

    return () => {
      window.removeEventListener("load", measurePageLoad);
      if (cleanup) cleanup();
    };
  }, [pageName]);

  // التقارير الدورية للأداء
  useEffect(() => {
    const interval = setInterval(() => {
      trackEvent("performance_report", {
        page: pageName,
        metrics_json: JSON.stringify(metricsRef.current),
      });
    }, 60000); // كل دقيقة

    return () => clearInterval(interval);
  }, [pageName]);

  return metricsRef.current;
};

/**
 * Hook لقياس سرعة الدوال
 */
export const useOperationTiming = () => {
  const measureOperation = useCallback(
    async <T>(
      operationName: string,
      operation: () => Promise<T>
    ): Promise<T> => {
      const startTime = performance.now();
      try {
        const result = await operation();
        const duration = performance.now() - startTime;
        trackEvent("operation_timing", {
          operation: operationName,
          duration,
        });
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        trackEvent("operation_error", {
          operation: operationName,
          duration,
        });
        throw error;
      }
    },
    []
  );

  const measureSync = useCallback(
    <T>(operationName: string, operation: () => T): T => {
      const startTime = performance.now();
      try {
        const result = operation();
        const duration = performance.now() - startTime;
        trackEvent("operation_timing", {
          operation: operationName,
          duration,
        });
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        trackEvent("operation_error", {
          operation: operationName,
          duration,
        });
        throw error;
      }
    },
    []
  );

  return { measureOperation, measureSync };
};

/**
 * Hook لمراقبة استخدام الذاكرة
 */
export const useMemoryMonitoring = () => {
  useEffect(() => {
    if (!("memory" in performance)) {
      console.warn("Memory API not available");
      return;
    }

    const checkMemory = () => {
      const memory = (
        performance as unknown as {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
        }
      ).memory;
      if (!memory) return;

      const usagePercent =
        (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

      if (usagePercent > 90) {
        console.warn(`⚠️ High memory usage: ${usagePercent.toFixed(2)}%`);
        trackEvent("memory_warning", {
          usage_percent: usagePercent,
          used_heap: memory.usedJSHeapSize,
          heap_limit: memory.jsHeapSizeLimit,
        });
      }
    };

    const interval = setInterval(checkMemory, 30000); // كل 30 ثانية

    return () => clearInterval(interval);
  }, []);
};
