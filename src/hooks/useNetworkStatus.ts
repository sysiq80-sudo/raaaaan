/**
 * ران - Hook للتحقق من حالة الاتصال
 * يراقب حالة الاتصال بالإنترنت ويوفر معلومات مفصلة
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ConnectionState {
    isOnline: boolean;
    isConnectedToServer: boolean;
    lastChecked: Date | null;
    connectionType: 'fast' | 'slow' | 'offline';
    latency: number | null;
}

interface UseConnectionStatusOptions {
    checkInterval?: number; // بالمللي ثانية
    serverCheckEnabled?: boolean;
}

export const useNetworkStatus = (options: UseConnectionStatusOptions = {}) => {
    const { checkInterval = 30000, serverCheckEnabled = true } = options;

    const [connectionState, setConnectionState] = useState<ConnectionState>({
        isOnline: navigator.onLine,
        isConnectedToServer: true,
        lastChecked: null,
        connectionType: navigator.onLine ? 'fast' : 'offline',
        latency: null,
    });

    // فحص الاتصال بالخادم
    const checkServerConnection = useCallback(async (): Promise<{ connected: boolean; latency: number }> => {
        const startTime = performance.now();

        try {
            // فحص بسيط للخادم
            const { error } = await supabase.from('regions').select('id').limit(1).single();
            const latency = Math.round(performance.now() - startTime);

            return { connected: !error, latency };
        } catch {
            return { connected: false, latency: -1 };
        }
    }, []);

    // تحديد نوع الاتصال بناءً على الكمون
    const determineConnectionType = (latency: number, isOnline: boolean): 'fast' | 'slow' | 'offline' => {
        if (!isOnline) return 'offline';
        if (latency < 0) return 'offline';
        if (latency < 500) return 'fast';
        return 'slow';
    };

    // فحص شامل للاتصال
    const checkConnection = useCallback(async () => {
        const isOnline = navigator.onLine;

        if (!isOnline) {
            setConnectionState({
                isOnline: false,
                isConnectedToServer: false,
                lastChecked: new Date(),
                connectionType: 'offline',
                latency: null,
            });
            return;
        }

        if (serverCheckEnabled) {
            const { connected, latency } = await checkServerConnection();
            const connectionType = determineConnectionType(latency, isOnline);

            setConnectionState({
                isOnline: true,
                isConnectedToServer: connected,
                lastChecked: new Date(),
                connectionType,
                latency: connected ? latency : null,
            });
        } else {
            setConnectionState(prev => ({
                ...prev,
                isOnline: true,
                lastChecked: new Date(),
                connectionType: 'fast',
            }));
        }
    }, [serverCheckEnabled, checkServerConnection]);

    // مراقبة تغييرات الاتصال
    useEffect(() => {
        const handleOnline = () => {
            checkConnection();
        };

        const handleOffline = () => {
            setConnectionState({
                isOnline: false,
                isConnectedToServer: false,
                lastChecked: new Date(),
                connectionType: 'offline',
                latency: null,
            });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // فحص أولي
        checkConnection();

        // فحص دوري
        const interval = setInterval(checkConnection, checkInterval);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, [checkConnection, checkInterval]);

    return {
        ...connectionState,
        checkConnection,
    };
};

/**
 * Hook بسيط للتحقق من الاتصال
 */
export const useOnlineStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return isOnline;
};

export default useNetworkStatus;
