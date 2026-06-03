export const isMapContainerReady = (element: HTMLElement | null) => {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && element.offsetParent !== null;
};

export const onMapContainerReady = (
  element: HTMLElement,
  callback: () => void,
) => {
  let cancelled = false;
  let frameId = 0;
  let intervalId: number | null = null;
  let observer: ResizeObserver | null = null;

  const cleanup = () => {
    cancelled = true;
    if (frameId) window.cancelAnimationFrame(frameId);
    if (intervalId !== null) window.clearInterval(intervalId);
    observer?.disconnect();
  };

  const runIfReady = () => {
    if (cancelled) return;
    if (!isMapContainerReady(element)) return;

    cleanup();
    callback();
  };

  frameId = window.requestAnimationFrame(runIfReady);

  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(runIfReady);
    observer.observe(element);
  } else {
    intervalId = window.setInterval(runIfReady, 50);
  }

  return cleanup;
};
