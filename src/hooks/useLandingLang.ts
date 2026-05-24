/**
 * ران - Hook لإدارة اللغة في صفحات Landing
 * يدعم العربية والإنجليزية مع حفظ اللغة في localStorage
 */

import { useState, useEffect, useCallback } from "react";

export type LangCode = "ar" | "en";

export interface LandingLang {
  lang: LangCode;
  dir: "rtl" | "ltr";
  isAr: boolean;
  isEn: boolean;
  toggleLang: () => void;
  setLang: (lang: LangCode) => void;
  t: (ar: string, en: string) => string;
}

const STORAGE_KEY = "raan-landing-lang";

export const useLandingLang = (): LandingLang => {
  const [lang, setLangState] = useState<LangCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return (saved === "en" || saved === "ar") ? saved : "ar";
    } catch {
      return "ar";
    }
  });

  const dir = lang === "ar" ? "rtl" : "ltr";
  const isAr = lang === "ar";
  const isEn = lang === "en";

  const setLang = useCallback((newLang: LangCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
    } catch {
      // ignore
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "ar" ? "en" : "ar");
  }, [lang, setLang]);

  const t = useCallback(
    (ar: string, en: string) => (lang === "ar" ? ar : en),
    [lang]
  );

  // تحديث اتجاه الصفحة عند تغيير اللغة
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
  }, [dir, lang]);

  return { lang, dir, isAr, isEn, toggleLang, setLang, t };
};
