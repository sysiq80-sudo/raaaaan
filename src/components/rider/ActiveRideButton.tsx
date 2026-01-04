import { Car, Navigation } from "lucide-react";
import { ActiveRide } from "@/hooks/useActiveRide";

interface ActiveRideButtonProps {
  activeRide: ActiveRide;
  onClick: () => void;
}

const ActiveRideButton = ({ activeRide, onClick }: ActiveRideButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full shadow-2xl border-2 border-green-400 animate-pulse"
      style={{
        background: 'linear-gradient(135deg, #10b981, #059669)',
        boxShadow: '0 0 20px rgba(16, 185, 129, 0.6), 0 0 40px rgba(16, 185, 129, 0.3)'
      }}
    >
      <div className="relative">
        <Car className="w-6 h-6 text-white" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping" />
      </div>
      <div className="text-white text-right">
        <p className="font-bold text-sm">تتبع الرحلة</p>
        <p className="text-xs opacity-90">
          {activeRide.status === 'pending' && 'جاري البحث عن سائق...'}
          {activeRide.status === 'accepted' && 'السائق في الطريق إليك'}
          {activeRide.status === 'arrived' && '🔔 السائق وصل!'}
          {activeRide.status === 'in_progress' && 'في طريقك للوجهة'}
        </p>
      </div>
      <Navigation className="w-5 h-5 text-white" />
    </button>
  );
};

export default ActiveRideButton;
