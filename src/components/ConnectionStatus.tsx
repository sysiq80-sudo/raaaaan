import { useConnectionStatus } from '@/hooks/useConnectionStatus';

export const ConnectionStatus = () => {
  const { isOnline } = useConnectionStatus();

  return (
    <div
      className="fixed top-[calc(env(safe-area-inset-top,0px)+8px)] left-3 z-[9999] pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label={isOnline ? 'متصل بالإنترنت' : 'لا يوجد اتصال'}
    >
      {/* Outer pulse ring */}
      <span
        className="absolute inset-0 rounded-full animate-ping"
        style={{
          animationDuration: isOnline ? '3s' : '0.8s',
          backgroundColor: isOnline ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)',
        }}
      />
      {/* Core dot */}
      <span
        className="relative block w-2.5 h-2.5 rounded-full transition-colors duration-500"
        style={{
          backgroundColor: isOnline ? '#34d399' : '#ef4444',
          boxShadow: isOnline
            ? '0 0 6px rgba(52,211,153,0.8)'
            : '0 0 6px rgba(239,68,68,0.8)',
        }}
      />
    </div>
  );
};
