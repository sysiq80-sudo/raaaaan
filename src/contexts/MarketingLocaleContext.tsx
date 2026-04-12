import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type MarketingLocale = "ar" | "en";

type MarketingLocaleContextValue = {
  locale: MarketingLocale;
  direction: "rtl" | "ltr";
  isArabic: boolean;
  setLocale: (locale: MarketingLocale) => void;
  toggleLocale: () => void;
};

const STORAGE_KEY = "raan-marketing-locale";

const MarketingLocaleContext = createContext<MarketingLocaleContextValue | null>(null);

export const MarketingLocaleProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<MarketingLocale>(() => {
    if (typeof window === "undefined") return "ar";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "ar";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale);
    }
  }, [locale]);

  const value = useMemo<MarketingLocaleContextValue>(
    () => ({
      locale,
      direction: locale === "ar" ? "rtl" : "ltr",
      isArabic: locale === "ar",
      setLocale: setLocaleState,
      toggleLocale: () => setLocaleState((current) => (current === "ar" ? "en" : "ar")),
    }),
    [locale],
  );

  return <MarketingLocaleContext.Provider value={value}>{children}</MarketingLocaleContext.Provider>;
};

export const useMarketingLocale = () => {
  const context = useContext(MarketingLocaleContext);
  if (!context) {
    throw new Error("useMarketingLocale must be used inside MarketingLocaleProvider");
  }
  return context;
};
