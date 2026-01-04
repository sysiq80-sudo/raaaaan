/**
 * ران - شريط حالة الاتصال
 * يعرض حالة الاتصال بالإنترنت للمستخدم
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Button } from '@/components/ui/button';

interface ConnectionStatusBarProps {
    /**
     * موضع الشريط
     */
    position?: 'top' | 'bottom';
    /**
     * إظهار الشريط دائماً أم فقط عند المشاكل
     */
    showAlways?: boolean;
}

export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
    position = 'top',
    showAlways = false,
}) => {
    const { isOnline, isConnectedToServer, connectionType, checkConnection, latency } = useNetworkStatus();

    // تحديد ما إذا كان يجب إظهار الشريط
    const shouldShow = showAlways || !isOnline || !isConnectedToServer || connectionType === 'slow';

    // تحديد نوع الشريط
    const getStatusConfig = () => {
        if (!isOnline) {
            return {
                type: 'offline',
                icon: <WifiOff className="w-4 h-4" />,
                message: 'لا يوجد اتصال بالإنترنت',
                bgColor: 'bg-destructive',
                textColor: 'text-destructive-foreground',
            };
        }

        if (!isConnectedToServer) {
            return {
                type: 'server-down',
                icon: <AlertTriangle className="w-4 h-4" />,
                message: 'تعذر الاتصال بالخادم',
                bgColor: 'bg-warning',
                textColor: 'text-warning-foreground',
            };
        }

        if (connectionType === 'slow') {
            return {
                type: 'slow',
                icon: <Wifi className="w-4 h-4" />,
                message: `اتصال بطيء (${latency}ms)`,
                bgColor: 'bg-warning',
                textColor: 'text-warning-foreground',
            };
        }

        return {
            type: 'online',
            icon: <Wifi className="w-4 h-4" />,
            message: 'متصل',
            bgColor: 'bg-success',
            textColor: 'text-success-foreground',
        };
    };

    const config = getStatusConfig();

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    initial={{ opacity: 0, y: position === 'top' ? -50 : 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: position === 'top' ? -50 : 50 }}
                    transition={{ duration: 0.3 }}
                    className={`
            fixed ${position === 'top' ? 'top-0' : 'bottom-0'} left-0 right-0 z-[100]
            ${config.bgColor} ${config.textColor}
            px-4 py-2 shadow-lg
          `}
                >
                    <div className="container flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            {config.icon}
                            <span className="text-sm font-medium">{config.message}</span>
                        </div>

                        {(config.type === 'offline' || config.type === 'server-down') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => checkConnection()}
                                className="h-7 px-2 text-current hover:bg-white/20"
                            >
                                <RefreshCw className="w-3 h-3 ml-1" />
                                إعادة المحاولة
                            </Button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

/**
 * مؤشر حالة الاتصال الصغير
 */
export const ConnectionIndicator: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { isOnline, connectionType } = useNetworkStatus({ serverCheckEnabled: false });

    const getColor = () => {
        if (!isOnline) return 'bg-destructive';
        if (connectionType === 'slow') return 'bg-warning';
        return 'bg-success';
    };

    return (
        <div className={`relative ${className}`}>
            <span className={`flex h-3 w-3`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${getColor()} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${getColor()}`} />
            </span>
        </div>
    );
};

/**
 * Badge حالة الاتصال
 */
export const ConnectionBadge: React.FC = () => {
    const { isOnline, connectionType } = useNetworkStatus({ serverCheckEnabled: false });

    if (isOnline && connectionType === 'fast') return null;

    return (
        <div className={`
      inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
      ${!isOnline ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}
    `}>
            {!isOnline ? (
                <>
                    <WifiOff className="w-3 h-3" />
                    غير متصل
                </>
            ) : (
                <>
                    <AlertTriangle className="w-3 h-3" />
                    اتصال بطيء
                </>
            )}
        </div>
    );
};

export default ConnectionStatusBar;
