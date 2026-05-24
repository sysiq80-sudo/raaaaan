import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import ku from '@/locales/ku.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
      ku: { translation: ku },
    },
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en', 'ku'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'raan-language',
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

// تحديث اتجاه الصفحة عند تغيير اللغة
i18n.on('languageChanged', (lng) => {
  const isRtl = lng === 'ar' || lng === 'ku';
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
