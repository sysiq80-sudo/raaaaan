/**
 * ران - مكون حالة الرحلة (مقتطع من ActiveRideCard)
 */

import { Clock, Navigation, Car, Timer, AlertTriangle } from "lucide-react";

interface RideStatusHeaderProps {
    status: string;
    elapsedTime: number;
    waitingTime: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    accepted: {
        label: 'متجه للعميل',
        color: 'bg-blue-500',
        icon: <Navigation className="w-4 h-4" />
    },
    arrived: {
        label: 'في انتظار العميل',
        color: 'bg-amber-500',
        icon: <Clock className="w-4 h-4" />
    },
    in_progress: {
        label: 'الرحلة جارية',
        color: 'bg-primary',
        icon: <Car className="w-4 h-4" />
    }
};

// الحد الأقصى للانتظار
const MAX_WAITING_SECONDS = 300;
const WAITING_WARNING_THRESHOLD = 240;
const WAITING_CRITICAL_THRESHOLD = 270;

const RideStatusHeader = ({ status, elapsedTime, waitingTime }: RideStatusHeaderProps) => {
    const config = statusConfig[status] || statusConfig.accepted;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getWaitingTimeColor = () => {
        if (waitingTime >= WAITING_CRITICAL_THRESHOLD) return 'text-red-500 bg-red-500/20';
        if (waitingTime >= WAITING_WARNING_THRESHOLD) return 'text-amber-500 bg-amber-500/20';
        return 'text-muted-foreground bg-secondary';
    };

    return (
        <div className={`${config.color} text-white px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
                {config.icon}
                <span className="font-bold">{config.label}</span>
            </div>

            {/* Timer for in_progress */}
            {status === 'in_progress' && (
                <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{formatTime(elapsedTime)}</span>
                </div>
            )}

            {/* Waiting timer for arrived */}
            {status === 'arrived' && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getWaitingTimeColor()}`}>
                    {waitingTime >= WAITING_WARNING_THRESHOLD ? (
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                    ) : (
                        <Timer className="w-4 h-4" />
                    )}
                    <span className="font-mono font-bold">{formatTime(waitingTime)}</span>
                    <span className="text-xs opacity-75">/ 5:00</span>
                </div>
            )}
        </div>
    );
};

export default RideStatusHeader;
