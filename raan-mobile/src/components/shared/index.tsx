/**
 * ران - مكونات مشتركة (React Native)
 */

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';

// ===== زر أساسي =====
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
}: ButtonProps) {
  const btnStyles = [
    styles.btn,
    styles[`btn_${variant}`],
    styles[`btn_${size}`],
    (disabled || loading) && styles.btnDisabled,
    style,
  ];

  const textStyles = [
    styles.btnText,
    styles[`btnText_${variant}`],
    styles[`btnText_${size}`],
  ];

  return (
    <TouchableOpacity
      style={btnStyles}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#0f172a' : '#00d9a5'} />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

// ===== شارة الحالة =====
interface StatusBadgeProps {
  status: string;
  label?: string;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  cancelled: '#ef4444',
  pending: '#eab308',
  accepted: '#3b82f6',
  arrived: '#8b5cf6',
  in_progress: '#f97316',
  approved: '#22c55e',
  online: '#22c55e',
  offline: '#94a3b8',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label || status}</Text>
    </View>
  );
}

// ===== بطاقة =====
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function Card({ children, style, onPress }: CardProps) {
  const cardStyle = [styles.card, style];
  if (onPress) {
    return (
      <TouchableOpacity style={cardStyle} onPress={onPress} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

// ===== فاصل =====
export function Divider() {
  return <View style={styles.divider} />;
}

// ===== حالة فارغة =====
interface EmptyStateProps {
  icon?: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = '📋', title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle && <Text style={styles.emptySubtitle}>{subtitle}</Text>}
      {action && (
        <Button title={action.label} onPress={action.onPress} size="sm" style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

// ===== عنصر قائمة =====
interface MenuItemProps {
  label: string;
  value?: string;
  onPress?: () => void;
  icon?: string;
  showArrow?: boolean;
  rightElement?: React.ReactNode;
}

export function MenuItem({ label, value, onPress, icon, showArrow = true, rightElement }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.menuItemRight}>
        {icon && <Text style={styles.menuIcon}>{icon}</Text>}
        <View>
          <Text style={styles.menuLabel}>{label}</Text>
          {value && <Text style={styles.menuValue}>{value}</Text>}
        </View>
      </View>
      {rightElement || (showArrow && onPress && <Text style={styles.menuArrow}>{'<'}</Text>)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Button
  btn: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btn_primary: { backgroundColor: '#00d9a5' },
  btn_secondary: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btn_danger: { backgroundColor: '#ef4444' },
  btn_ghost: { backgroundColor: 'transparent' },
  btn_sm: { paddingHorizontal: 14, paddingVertical: 8 },
  btn_md: { paddingHorizontal: 20, paddingVertical: 14 },
  btn_lg: { paddingHorizontal: 24, paddingVertical: 18 },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontWeight: '700' },
  btnText_primary: { color: '#0f172a' } as TextStyle,
  btnText_secondary: { color: '#f1f5f9' } as TextStyle,
  btnText_danger: { color: '#fff' } as TextStyle,
  btnText_ghost: { color: '#00d9a5' } as TextStyle,
  btnText_sm: { fontSize: 13 } as TextStyle,
  btnText_md: { fontSize: 16 } as TextStyle,
  btnText_lg: { fontSize: 18 } as TextStyle,

  // Badge
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontWeight: '600' },

  // Card
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },

  // EmptyState
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: '#64748b', fontSize: 14, marginTop: 4, textAlign: 'center' },

  // MenuItem
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  menuItemRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  menuIcon: { fontSize: 20 },
  menuLabel: { color: '#f1f5f9', fontSize: 15 },
  menuValue: { color: '#64748b', fontSize: 12, marginTop: 2 },
  menuArrow: { color: '#64748b', fontSize: 16 },
});
