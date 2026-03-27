/**
 * ران - نظام التسجيل المركزي
 * يحل محل console.log المباشر لتحكم أفضل في الـ logs
 */

// التحقق من بيئة التطوير
const isDev = import.meta.env.DEV || false;

// مستويات التسجيل
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// ألوان التسجيل للتمييز في Console
const LOG_COLORS = {
  debug: '#6B7280', // gray
  info: '#3B82F6',  // blue
  warn: '#F59E0B',  // amber
  error: '#EF4444', // red
};

// بادئات للتمييز
const LOG_PREFIXES = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};

/**
 * تسجيل رسالة مع مستوى محدد
 */
const log = (level: LogLevel, context: string, message: string, data?: any) => {
  // في الإنتاج، نسجل فقط التحذيرات والأخطاء
  if (!isDev && (level === 'debug' || level === 'info')) {
    return;
  }

  const timestamp = new Date().toLocaleTimeString('ar-IQ');
  const prefix = LOG_PREFIXES[level];
  const color = LOG_COLORS[level];

  if (data !== undefined) {
    console.log(
      `%c${prefix} [${timestamp}] [${context}] ${message}`,
      `color: ${color}; font-weight: bold;`,
      data
    );
  } else {
    console.log(
      `%c${prefix} [${timestamp}] [${context}] ${message}`,
      `color: ${color}; font-weight: bold;`
    );
  }
};

/**
 * Logger API - استخدم هذا بدلاً من console.log
 */
export const logger = {
  /**
   * رسائل تصحيح الأخطاء - تظهر فقط في التطوير
   */
  debug: (context: string, message: string, data?: any) => {
    log('debug', context, message, data);
  },

  /**
   * معلومات عامة - تظهر فقط في التطوير
   */
  info: (context: string, message: string, data?: any) => {
    log('info', context, message, data);
  },

  /**
   * تحذيرات - تظهر دائماً
   */
  warn: (context: string, message: string, data?: any) => {
    log('warn', context, message, data);
  },

  /**
   * أخطاء - تظهر دائماً
   */
  error: (context: string, message: string, data?: any) => {
    log('error', context, message, data);
  },

  /**
   * مجموعة من الرسائل (للتصحيح المعقد)
   */
  group: (label: string, callback: () => void) => {
    if (!isDev) return;
    console.group(label);
    callback();
    console.groupEnd();
  },

  /**
   * قياس الأداء
   */
  time: (label: string) => {
    if (!isDev) return;
    console.time(label);
  },

  timeEnd: (label: string) => {
    if (!isDev) return;
    console.timeEnd(label);
  },
};

// تصدير افتراضي
export default logger;
