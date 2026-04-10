// ران RAAN - Internationalization (i18n) System
// دعم كامل للعربية والإنجليزية والكردية

export type Language = 'ar' | 'en' | 'ku';

export interface TranslationKeys {
  // Navigation
  nav: {
    home: string;
    rides: string;
    profile: string;
    settings: string;
    logout: string;
  };

  // Ride Booking
  ride: {
    pickup: string;
    dropoff: string;
    addStop: string;
    removeStop: string;
    vehicleType: string;
    economy: string;
    comfort: string;
    premium: string;
    womenOnly: string;
    bookRide: string;
    searchingDrivers: string;
    waitingForDriver: string;
    driverFound: string;
    driverArrived: string;
    rideStarted: string;
    rideCompleted: string;
    cancelRide: string;
    fare: string;
    distance: string;
    duration: string;
    surgeMultiplier: string;
    total: string;
  };

  // Driver
  driver: {
    online: string;
    offline: string;
    available: string;
    busy: string;
    rating: string;
    trips: string;
    earnings: string;
    acceptRide: string;
    declineRide: string;
    arrived: string;
    startRide: string;
    completeRide: string;
  };

  // Common
  common: {
    yes: string;
    no: string;
    ok: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    retry: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    search: string;
    filter: string;
    sort: string;
    apply: string;
    reset: string;
  };

  // Auth
  auth: {
    login: string;
    register: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone: string;
    name: string;
    forgotPassword: string;
    resetPassword: string;
    verifyCode: string;
    resendCode: string;
    loginWithPhone: string;
    loginWithEmail: string;
  };

  // Errors
  errors: {
    networkError: string;
    serverError: string;
    validationError: string;
    locationError: string;
    paymentError: string;
    rideNotFound: string;
    driverNotFound: string;
    invalidCredentials: string;
    accountSuspended: string;
    tooManyRequests: string;
  };

  // Admin
  admin: {
    dashboard: string;
    users: string;
    drivers: string;
    rides: string;
    reports: string;
    settings: string;
    support: string;
    notifications: string;
    analytics: string;
    totalUsers: string;
    totalDrivers: string;
    totalRides: string;
    revenue: string;
    activeRides: string;
    pendingApprovals: string;
  };
}

export const translations: Record<Language, TranslationKeys> = {
  ar: {
    nav: {
      home: 'الرئيسية',
      rides: 'الرحلات',
      profile: 'الملف الشخصي',
      settings: 'الإعدادات',
      logout: 'تسجيل الخروج',
    },
    ride: {
      pickup: 'مكان الالتقاط',
      dropoff: 'مكان الوصول',
      addStop: 'إضافة محطة',
      removeStop: 'إزالة المحطة',
      vehicleType: 'نوع المركبة',
      economy: 'اقتصادي',
      comfort: 'مريح',
      premium: 'فاخر',
      womenOnly: 'نسائي',
      bookRide: 'حجز رحلة',
      searchingDrivers: 'البحث عن سائقين...',
      waitingForDriver: 'انتظار السائق',
      driverFound: 'تم العثور على سائق',
      driverArrived: 'وصل السائق',
      rideStarted: 'بدأت الرحلة',
      rideCompleted: 'انتهت الرحلة',
      cancelRide: 'إلغاء الرحلة',
      fare: 'الأجرة',
      distance: 'المسافة',
      duration: 'المدة',
      surgeMultiplier: 'معامل الذروة',
      total: 'المجموع',
    },
    driver: {
      online: 'متصل',
      offline: 'غير متصل',
      available: 'متاح',
      busy: 'مشغول',
      rating: 'التقييم',
      trips: 'الرحلات',
      earnings: 'الأرباح',
      acceptRide: 'قبول الرحلة',
      declineRide: 'رفض الرحلة',
      arrived: 'وصلت',
      startRide: 'بدء الرحلة',
      completeRide: 'إنهاء الرحلة',
    },
    common: {
      yes: 'نعم',
      no: 'لا',
      ok: 'موافق',
      cancel: 'إلغاء',
      save: 'حفظ',
      delete: 'حذف',
      edit: 'تعديل',
      loading: 'جارٍ التحميل...',
      error: 'خطأ',
      success: 'نجح',
      warning: 'تحذير',
      info: 'معلومات',
      retry: 'إعادة المحاولة',
      close: 'إغلاق',
      back: 'رجوع',
      next: 'التالي',
      previous: 'السابق',
      search: 'بحث',
      filter: 'تصفية',
      sort: 'ترتيب',
      apply: 'تطبيق',
      reset: 'إعادة تعيين',
    },
    auth: {
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      confirmPassword: 'تأكيد كلمة المرور',
      phone: 'رقم الهاتف',
      name: 'الاسم',
      forgotPassword: 'نسيت كلمة المرور؟',
      resetPassword: 'إعادة تعيين كلمة المرور',
      verifyCode: 'رمز التحقق',
      resendCode: 'إعادة إرسال الرمز',
      loginWithPhone: 'تسجيل الدخول برقم الهاتف',
      loginWithEmail: 'تسجيل الدخول بالبريد الإلكتروني',
    },
    errors: {
      networkError: 'خطأ في الشبكة',
      serverError: 'خطأ في الخادم',
      validationError: 'خطأ في التحقق من البيانات',
      locationError: 'خطأ في تحديد الموقع',
      paymentError: 'خطأ في الدفع',
      rideNotFound: 'الرحلة غير موجودة',
      driverNotFound: 'السائق غير موجود',
      invalidCredentials: 'بيانات الدخول غير صحيحة',
      accountSuspended: 'الحساب موقوف',
      tooManyRequests: 'طلبات كثيرة جداً',
    },
    admin: {
      dashboard: 'لوحة التحكم',
      users: 'المستخدمون',
      drivers: 'السائقون',
      rides: 'الرحلات',
      reports: 'التقارير',
      settings: 'الإعدادات',
      support: 'الدعم',
      notifications: 'الإشعارات',
      analytics: 'التحليلات',
      totalUsers: 'إجمالي المستخدمين',
      totalDrivers: 'إجمالي السائقين',
      totalRides: 'إجمالي الرحلات',
      revenue: 'الإيرادات',
      activeRides: 'الرحلات النشطة',
      pendingApprovals: 'طلبات الموافقة المعلقة',
    },
  },

  en: {
    nav: {
      home: 'Home',
      rides: 'Rides',
      profile: 'Profile',
      settings: 'Settings',
      logout: 'Logout',
    },
    ride: {
      pickup: 'Pickup Location',
      dropoff: 'Drop-off Location',
      addStop: 'Add Stop',
      removeStop: 'Remove Stop',
      vehicleType: 'Vehicle Type',
      economy: 'Economy',
      comfort: 'Comfort',
      premium: 'Premium',
      womenOnly: 'Women Only',
      bookRide: 'Book Ride',
      searchingDrivers: 'Searching for drivers...',
      waitingForDriver: 'Waiting for driver',
      driverFound: 'Driver found',
      driverArrived: 'Driver arrived',
      rideStarted: 'Ride started',
      rideCompleted: 'Ride completed',
      cancelRide: 'Cancel Ride',
      fare: 'Fare',
      distance: 'Distance',
      duration: 'Duration',
      surgeMultiplier: 'Surge Multiplier',
      total: 'Total',
    },
    driver: {
      online: 'Online',
      offline: 'Offline',
      available: 'Available',
      busy: 'Busy',
      rating: 'Rating',
      trips: 'Trips',
      earnings: 'Earnings',
      acceptRide: 'Accept Ride',
      declineRide: 'Decline Ride',
      arrived: 'Arrived',
      startRide: 'Start Ride',
      completeRide: 'Complete Ride',
    },
    common: {
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      warning: 'Warning',
      info: 'Info',
      retry: 'Retry',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      search: 'Search',
      filter: 'Filter',
      sort: 'Sort',
      apply: 'Apply',
      reset: 'Reset',
    },
    auth: {
      login: 'Login',
      register: 'Register',
      email: 'Email',
      password: 'Password',
      confirmPassword: 'Confirm Password',
      phone: 'Phone',
      name: 'Name',
      forgotPassword: 'Forgot Password?',
      resetPassword: 'Reset Password',
      verifyCode: 'Verification Code',
      resendCode: 'Resend Code',
      loginWithPhone: 'Login with Phone',
      loginWithEmail: 'Login with Email',
    },
    errors: {
      networkError: 'Network Error',
      serverError: 'Server Error',
      validationError: 'Validation Error',
      locationError: 'Location Error',
      paymentError: 'Payment Error',
      rideNotFound: 'Ride Not Found',
      driverNotFound: 'Driver Not Found',
      invalidCredentials: 'Invalid Credentials',
      accountSuspended: 'Account Suspended',
      tooManyRequests: 'Too Many Requests',
    },
    admin: {
      dashboard: 'Dashboard',
      users: 'Users',
      drivers: 'Drivers',
      rides: 'Rides',
      reports: 'Reports',
      settings: 'Settings',
      support: 'Support',
      notifications: 'Notifications',
      analytics: 'Analytics',
      totalUsers: 'Total Users',
      totalDrivers: 'Total Drivers',
      totalRides: 'Total Rides',
      revenue: 'Revenue',
      activeRides: 'Active Rides',
      pendingApprovals: 'Pending Approvals',
    },
  },

  ku: {
    nav: {
      home: 'سەرەکی',
      rides: 'گەشتەکان',
      profile: 'پرۆفایل',
      settings: 'ڕێکخستنەکان',
      logout: 'دەرچوون',
    },
    ride: {
      pickup: 'شوێنی وەرگرتن',
      dropoff: 'شوێنی دابەزین',
      addStop: 'زیادکردنی وەستانگە',
      removeStop: 'لابردنی وەستانگە',
      vehicleType: 'جۆری ئۆتۆمبێل',
      economy: 'ئابووری',
      comfort: 'ئاسوودە',
      premium: 'پریمیوم',
      womenOnly: 'تەنها بۆ ژنان',
      bookRide: 'بەرنامەکردنی گەشت',
      searchingDrivers: 'گەڕان بەدوای شۆفێردا...',
      waitingForDriver: 'چاوەڕوانی شۆفێر',
      driverFound: 'شۆفێر دۆزرایەوە',
      driverArrived: 'شۆفێر گەیشت',
      rideStarted: 'گەشت دەستی پێکرد',
      rideCompleted: 'گەشت تەواوبوو',
      cancelRide: 'هەڵوەشاندنەوەی گەشت',
      fare: 'کرێ',
      distance: 'مەودا',
      duration: 'کات',
      surgeMultiplier: 'زۆربوونی نرخ',
      total: 'کۆی گشتی',
    },
    driver: {
      online: 'سەرهێڵ',
      offline: 'دەرهێڵ',
      available: 'بەردەست',
      busy: 'سەرقاڵ',
      rating: 'هەڵسەنگاندن',
      trips: 'گەشتەکان',
      earnings: 'داهات',
      acceptRide: 'پەسەندکردنی گەشت',
      declineRide: 'ڕەتکردنەوەی گەشت',
      arrived: 'گەیشت',
      startRide: 'دەستپێکردنی گەشت',
      completeRide: 'تەواوبوونی گەشت',
    },
    common: {
      yes: 'بەڵێ',
      no: 'نەخێر',
      ok: 'باشە',
      cancel: 'هەڵوەشاندنەوە',
      save: 'هەڵگرتن',
      delete: 'سڕینەوە',
      edit: 'دەستکاری',
      loading: 'بارکردن...',
      error: 'هەڵە',
      success: 'سەرکەوتن',
      warning: 'ئاگاداری',
      info: 'زانیاری',
      retry: 'هەوڵدانەوە',
      close: 'داخستن',
      back: 'گەڕانەوە',
      next: 'دواتر',
      previous: 'پێشتر',
      search: 'گەڕان',
      filter: 'فلتەر',
      sort: 'ڕیزکردن',
      apply: 'جێبەجێکردن',
      reset: 'ڕێکخستنەوە',
    },
    auth: {
      login: 'چوونەژوورەوە',
      register: 'خۆتۆمارکردن',
      email: 'ئیمەیڵ',
      password: 'وشەی نهێنی',
      confirmPassword: 'دووبارەکردنەوەی وشەی نهێنی',
      phone: 'ژمارەی تەلەفۆن',
      name: 'ناو',
      forgotPassword: 'وشەی نهێنیت لەبیرکردووە؟',
      resetPassword: 'ڕێکخستنەوەی وشەی نهێنی',
      verifyCode: 'کۆدی پشتڕاستکردنەوە',
      resendCode: 'دووبارە ناردنی کۆد',
      loginWithPhone: 'چوونەژوورەوە بە ژمارەی تەلەفۆن',
      loginWithEmail: 'چوونەژوورەوە بە ئیمەیڵ',
    },
    errors: {
      networkError: 'هەڵەی تۆڕ',
      serverError: 'هەڵەی سێرڤەر',
      validationError: 'هەڵەی پشتڕاستکردنەوە',
      locationError: 'هەڵەی شوێن',
      paymentError: 'هەڵەی پارەدان',
      rideNotFound: 'گەشت نەدۆزرایەوە',
      driverNotFound: 'شۆفێر نەدۆزرایەوە',
      invalidCredentials: 'بەڵگەنامەکان نادروستن',
      accountSuspended: 'هەژمارەکە ڕاگیراوە',
      tooManyRequests: 'داواکاری زۆر',
    },
    admin: {
      dashboard: 'داشبۆرد',
      users: 'بەکارهێنەران',
      drivers: 'شۆفێران',
      rides: 'گەشتەکان',
      reports: 'ڕاپۆرتەکان',
      settings: 'ڕێکخستنەکان',
      support: 'پاڵپشتی',
      notifications: 'ئاگاداریەکان',
      analytics: 'شیکاری',
      totalUsers: 'کۆی بەکارهێنەران',
      totalDrivers: 'کۆی شۆفێران',
      totalRides: 'کۆی گەشتەکان',
      revenue: 'داهات',
      activeRides: 'گەشتە چالاکەکان',
      pendingApprovals: 'پەسەندکردنەکان چاوەڕوانکراو',
    },
  },
};

// Hook لاستخدام الترجمة (backward-compatible)
export const useTranslation = (lang: Language = 'ar') => {
  const t = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[lang];

    for (const k of keys) {
      value = value?.[k];
    }

    return value || key;
  };

  return { t, lang };
};

// i18next integration
import i18n from './i18nConfig';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(
    () => (i18n.language as Language) || 'ar'
  );

  useEffect(() => {
    // مزامنة مع i18next المحمل من localStorage/navigator
    const detectedLang = i18n.language as Language;
    if (detectedLang && ['ar', 'en', 'ku'].includes(detectedLang)) {
      setLanguageState(detectedLang);
    }

    // تحديث اتجاه الصفحة حسب اللغة
    const rtl = detectedLang === 'ar' || detectedLang === 'ku';
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = detectedLang;
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    // i18n.on('languageChanged') في i18nConfig يتكفل بالاتجاه
  };

  const t = (key: string): string => {
    // أولاً: جرب i18next (يدعم المفاتيح الجديدة مثل messages.*, payment.*, status.*)
    const i18nResult = i18n.t(key);
    if (i18nResult !== key) return i18nResult;

    // ثانياً: fallback للترجمات القديمة المضمنة
    const keys = key.split('.');
    let value: any = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};


export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
};

// Utility functions
export const getLanguageName = (lang: Language): string => {
  switch (lang) {
    case 'ar': return 'العربية';
    case 'en': return 'English';
    case 'ku': return 'کوردی';
    default: return 'العربية';
  }
};

export const getLanguageFlag = (lang: Language): string => {
  switch (lang) {
    case 'ar': return '🇸🇦';
    case 'en': return '🇺🇸';
    case 'ku': return '🇮🇶';
    default: return '🇸🇦';
  }
};

export const isRTL = (lang: Language): boolean => {
  return lang === 'ar' || lang === 'ku';
};
