/**
 * ران - Debounce Utility
 * تأخير تنفيذ الدوال لتقليل عدد الاستدعاءات المتكررة
 */

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function (...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}

/**
 * React Hook للـ debounce
 * يستخدم useCallback و useEffect
 */
import React from "react";
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  _dependencies: unknown[] | undefined = undefined
) {
  const [debounced, setDebounced] = React.useState<((...args: Parameters<T>) => void) | null>(null);

  React.useEffect(() => {
    const debouncedFunc = debounce(callback, delay);
    setDebounced(() => debouncedFunc);

    return () => {
      // cleanup
    };
  }, [callback, delay]);

  return debounced || callback;
}

/**
 * Throttle Utility
 * تنفيذ الدالة مرة واحدة فقط خلال فترة زمنية محددة
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout>;

  return function (...args: Parameters<T>) {
    const now = Date.now();

    if (now - lastCall < delay) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func(...args);
      }, delay - (now - lastCall));
    } else {
      lastCall = now;
      func(...args);
    }
  };
}
