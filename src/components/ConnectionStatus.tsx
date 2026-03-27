import { Wifi, WifiOff } from 'lucide-react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { cn } from '@/lib/utils';

export const ConnectionStatus = () => {
  const { isOnline, wasOffline } = useConnectionStatus();

  // Don't show anything if online and wasn't recently offline
  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300 animate-in slide-in-from-left-5',
        isOnline
          ? 'bg-green-500 text-white'
          : 'bg-destructive text-destructive-foreground'
      )}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">تم استعادة الاتصال</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 animate-pulse" />
          <span className="text-sm font-medium">لا يوجد اتصال بالإنترنت</span>
        </>
      )}
    </div>
  );
};
