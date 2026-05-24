/**
 * ران — شريط التنقل السفلي بتصميم متدرج
 * يعتمد على صفحات التطبيق الحقيقية مع تصميم gradient pill
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  IoHomeOutline,
  IoCarOutline,
  IoNavigateOutline,
  IoWalletOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { cn } from '@/lib/utils';

/* ───── تعريف العناصر ───── */
interface NavItem {
  id: string;
  title: string;
  path: string;
  icon: React.ReactElement;
  gradientFrom: string;
  gradientTo: string;
}

const LEFT_ITEMS: NavItem[] = [
  {
    id: 'home',
    title: 'الرئيسية',
    path: '/rider',
    icon: <IoHomeOutline />,
    gradientFrom: '#56CCF2',
    gradientTo: '#2F80ED',
  },
  {
    id: 'rides',
    title: 'رحلاتي',
    path: '/rider/rides',
    icon: <IoCarOutline />,
    gradientFrom: '#FF9966',
    gradientTo: '#FF5E62',
  },
];

const RIGHT_ITEMS: NavItem[] = [
  {
    id: 'payments',
    title: 'المحفظة',
    path: '/rider/payments',
    icon: <IoWalletOutline />,
    gradientFrom: '#80FF72',
    gradientTo: '#7EE8FA',
  },
  {
    id: 'settings',
    title: 'الإعدادات',
    path: '/rider/settings',
    icon: <IoSettingsOutline />,
    gradientFrom: '#ffa9c6',
    gradientTo: '#f434e2',
  },
];

const CENTER_ITEM = {
  path: '/rider/go',
  gradientFrom: '#a955ff',
  gradientTo: '#ea51ff',
};

/* ───── مكون عنصر التنقل ───── */
const GradientNavItem: React.FC<{ item: NavItem; active: boolean }> = ({ item, active }) => {
  return (
    <Link
      to={item.path}
      aria-label={item.title}
      className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 group"
    >
      {/* دائرة الخلفية المتدرجة */}
      <span
        className={cn(
          'relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300',
          active ? 'scale-110' : 'scale-100'
        )}
        style={
          active
            ? {
                background: `linear-gradient(45deg, ${item.gradientFrom}, ${item.gradientTo})`,
                boxShadow: `0 4px 15px ${item.gradientFrom}60`,
              }
            : undefined
        }
      >
        {/* هالة التوهج خلف الدائرة النشطة */}
        {active && (
          <span
            className="absolute inset-0 rounded-full blur-md -z-10 opacity-60"
            style={{
              background: `linear-gradient(45deg, ${item.gradientFrom}, ${item.gradientTo})`,
            }}
          />
        )}

        {/* الأيقونة */}
        <span
          className={cn('text-xl transition-colors duration-300')}
          style={{ color: active ? '#ffffff' : 'var(--raan-text-muted)' }}
        >
          {item.icon}
        </span>
      </span>

      {/* التسمية */}
      <span
        className="text-[10px] font-semibold leading-none transition-colors duration-300"
        style={{
          color: active
            ? item.gradientFrom
            : 'var(--raan-text-muted)',
        }}
      >
        {item.title}
      </span>
    </Link>
  );
};

/* ───── المكوّن الرئيسي ───── */
const RiderGradientBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) =>
    path === '/rider'
      ? location.pathname === '/rider'
      : location.pathname.startsWith(path);

  const isGoActive = location.pathname.startsWith('/rider/go');

  return (
    <div
      dir="rtl"
      className="shrink-0 w-full transition-colors duration-300"
      style={{ borderTop: '1px solid var(--raan-border)' }}
      role="navigation"
      aria-label="التنقل الرئيسي"
    >
      <div
        className="backdrop-blur-xl flex items-center h-[68px] px-2 transition-colors duration-300 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'var(--raan-bg)',
        }}
      >
        {/* يمين (RTL) */}
        {LEFT_ITEMS.map((item) => (
          <GradientNavItem key={item.id} item={item} active={isActive(item.path)} />
        ))}

        {/* الزر المركزي — رحلة جديدة */}
        <div className="flex items-center justify-center flex-shrink-0 px-3">
          <button
            onClick={() => navigate('/rider/go')}
            className={cn(
              'relative flex flex-col items-center justify-center gap-1',
              'w-[60px] h-[52px] rounded-2xl -mt-5',
              'text-white transition-all duration-300',
              isGoActive ? 'scale-105' : 'scale-100'
            )}
            style={{
              background: `linear-gradient(45deg, ${CENTER_ITEM.gradientFrom}, ${CENTER_ITEM.gradientTo})`,
              boxShadow: isGoActive
                ? `0 6px 20px ${CENTER_ITEM.gradientFrom}70`
                : `0 4px 12px ${CENTER_ITEM.gradientFrom}50`,
            }}
            aria-label="رحلة جديدة"
          >
            {/* هالة التوهج */}
            <span
              className="absolute inset-0 rounded-2xl blur-md -z-10 opacity-50"
              style={{
                background: `linear-gradient(45deg, ${CENTER_ITEM.gradientFrom}, ${CENTER_ITEM.gradientTo})`,
              }}
            />
            <IoNavigateOutline className="text-2xl stroke-2" />
            <span className="text-[9px] font-bold leading-none">رحلة</span>
          </button>
        </div>

        {/* يسار (RTL) */}
        {RIGHT_ITEMS.map((item) => (
          <GradientNavItem key={item.id} item={item} active={isActive(item.path)} />
        ))}
      </div>
    </div>
  );
};

export default RiderGradientBottomNav;
