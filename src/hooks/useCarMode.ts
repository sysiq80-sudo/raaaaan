import { useMemo } from "react";

export function useCarMode() {
  return useMemo(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.getAttribute("data-app-mode") === "car";
  }, []);
}

export default useCarMode;