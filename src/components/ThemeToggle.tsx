import { Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/hooks/useTheme';

const ThemeToggle = () => {
  const { isDark, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-3">
      <div className={`grid grid-cols-2 gap-2 p-1.5 rounded-2xl border transition-colors duration-300 ${
        isDark
          ? 'bg-[rgba(23,31,51,0.95)] border-white/10'
          : 'bg-slate-100/95 border-slate-200'
      }`}>
        {/* زر ليلي */}
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`relative flex flex-col items-center gap-2.5 py-4 rounded-xl cursor-pointer select-none transition-all duration-300 ${
            isDark
              ? 'bg-gradient-to-br from-slate-800 to-slate-900 shadow-[0_4px_20px_rgba(91,221,166,0.2),0_0_0_1px_rgba(91,221,166,0.15)]'
              : 'bg-transparent'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            isDark ? 'bg-emerald-400/15 scale-100 opacity-100' : 'scale-[0.85] opacity-50'
          }`}>
            <Moon className={`w-6 h-6 transition-colors duration-300 ${
              isDark ? 'text-emerald-400' : 'text-[var(--raan-text-muted)]'
            }`} />
          </div>
          <span className={`text-[13px] font-bold transition-colors duration-300 ${
            isDark ? 'text-[var(--raan-text)]' : 'text-[var(--raan-text-muted)]'
          }`}>
            ليلي
          </span>
          <AnimatePresence>
            {isDark && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] px-3 py-0.5 rounded-full font-semibold bg-emerald-400/[0.18] text-emerald-400"
              >
                نشط
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* زر نهاري */}
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`relative flex flex-col items-center gap-2.5 py-4 rounded-xl cursor-pointer select-none transition-all duration-300 ${
            !isDark
              ? 'bg-gradient-to-br from-white to-slate-50 shadow-[0_4px_20px_rgba(5,150,105,0.15),0_0_0_1px_rgba(5,150,105,0.12)]'
              : 'bg-transparent'
          }`}
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            !isDark ? 'bg-emerald-600/[0.12] scale-100 opacity-100' : 'scale-[0.85] opacity-50'
          }`}>
            <Sun className={`w-6 h-6 transition-colors duration-300 ${
              !isDark ? 'text-emerald-600' : 'text-[var(--raan-text-muted)]'
            }`} />
          </div>
          <span className={`text-[13px] font-bold transition-colors duration-300 ${
            !isDark ? 'text-[var(--raan-text)]' : 'text-[var(--raan-text-muted)]'
          }`}>
            نهاري
          </span>
          <AnimatePresence>
            {!isDark && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-[10px] px-3 py-0.5 rounded-full font-semibold bg-emerald-600/15 text-emerald-600"
              >
                نشط
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <p className="text-[11px] text-center text-[var(--raan-text-muted)] transition-colors duration-300">
        {isDark
          ? '🌙 الوضع الليلي — مريح للعين في الإضاءة المنخفضة'
          : '☀️ الوضع النهاري — واضح في الإضاءة الطبيعية'}
      </p>
    </div>
  );
};

export default ThemeToggle;
