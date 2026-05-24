/**
 * ران - Pull to Refresh Component
 * مكون السحب للتحديث
 */

import { useState, useRef, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { RefreshCw, ArrowDown } from 'lucide-react';

interface PullToRefreshProps {
    children: ReactNode;
    onRefresh: () => Promise<void>;
    disabled?: boolean;
    threshold?: number;
}

const PullToRefresh = ({
    children,
    onRefresh,
    disabled = false,
    threshold = 80
}: PullToRefreshProps) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const isPulling = useRef(false);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (disabled || isRefreshing) return;

        const scrollTop = containerRef.current?.scrollTop || 0;
        if (scrollTop === 0) {
            startY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling.current || disabled || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // تقليل السحب تدريجياً
            const dampedDiff = Math.min(diff * 0.5, threshold * 1.5);
            setPullDistance(dampedDiff);
        }
    };

    const handleTouchEnd = async () => {
        if (!isPulling.current || disabled) return;

        isPulling.current = false;

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold);

            try {
                await onRefresh();
            } catch (error) {
                console.error('Refresh error:', error);
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    };

    const progress = Math.min(pullDistance / threshold, 1);
    const shouldTrigger = pullDistance >= threshold;

    return (
        <div
            ref={containerRef}
            className="relative overflow-auto h-full"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Refresh Indicator */}
            <AnimatePresence>
                {(pullDistance > 0 || isRefreshing) && (
                    <motion.div
                        className="absolute top-0 left-0 right-0 flex items-center justify-center z-10 pointer-events-none"
                        initial={{ height: 0 }}
                        animate={{ height: isRefreshing ? 60 : pullDistance }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <motion.div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${shouldTrigger || isRefreshing
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                            animate={{
                                rotate: isRefreshing ? 360 : 0,
                                scale: progress,
                            }}
                            transition={{
                                rotate: { duration: 1, repeat: isRefreshing ? Infinity : 0, ease: 'linear' },
                                scale: { duration: 0.1 },
                            }}
                        >
                            {isRefreshing ? (
                                <RefreshCw className="w-5 h-5" />
                            ) : (
                                <ArrowDown
                                    className="w-5 h-5 transition-transform"
                                    style={{ transform: `rotate(${shouldTrigger ? 180 : 0}deg)` }}
                                />
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            <motion.div
                animate={{ y: isRefreshing ? 60 : pullDistance > 0 ? pullDistance : 0 }}
                transition={{ duration: 0.2 }}
            >
                {children}
            </motion.div>
        </div>
    );
};

export default PullToRefresh;
