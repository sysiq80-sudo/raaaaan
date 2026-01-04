/**
 * ران - مكون أزرار التحكم بالرحلة (مقتطع من ActiveRideCard)
 */

import { CheckCircle, Flag, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RideActionButtonsProps {
    status: string;
    loading: boolean;
    onArrived: () => void;
    onStartRide: () => void;
    onCompleteRide: () => void;
    onCancelRide: () => void;
}

const RideActionButtons = ({
    status,
    loading,
    onArrived,
    onStartRide,
    onCompleteRide,
    onCancelRide
}: RideActionButtonsProps) => {
    return (
        <div className="space-y-3 pt-4 border-t border-border">
            {/* زر وصلت - في حالة accepted */}
            {status === 'accepted' && (
                <Button
                    onClick={onArrived}
                    disabled={loading}
                    className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin ml-2" />
                    ) : (
                        <CheckCircle className="w-5 h-5 ml-2" />
                    )}
                    وصلت لموقع العميل
                </Button>
            )}

            {/* زر بدء الرحلة - في حالة arrived */}
            {status === 'arrived' && (
                <Button
                    onClick={onStartRide}
                    disabled={loading}
                    className="w-full h-14 text-lg bg-amber-600 hover:bg-amber-700"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin ml-2" />
                    ) : (
                        <CheckCircle className="w-5 h-5 ml-2" />
                    )}
                    العميل ركب - ابدأ الرحلة
                </Button>
            )}

            {/* زر إنهاء الرحلة - في حالة in_progress */}
            {status === 'in_progress' && (
                <Button
                    onClick={onCompleteRide}
                    disabled={loading}
                    className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin ml-2" />
                    ) : (
                        <Flag className="w-5 h-5 ml-2" />
                    )}
                    تم الوصول - إنهاء الرحلة
                </Button>
            )}

            {/* زر الإلغاء - في كل الحالات */}
            <Button
                variant="outline"
                onClick={onCancelRide}
                disabled={loading}
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            >
                <X className="w-4 h-4 ml-2" />
                إلغاء الرحلة
            </Button>
        </div>
    );
};

export default RideActionButtons;
