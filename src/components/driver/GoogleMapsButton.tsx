import { Button } from "@/components/ui/button";
import { Navigation } from "lucide-react";

interface GoogleMapsButtonProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export const GoogleMapsButton = ({ 
  lat, 
  lng, 
  label = "افتح الملاحة",
  className,
  variant = "outline",
  size = "default"
}: GoogleMapsButtonProps) => {
  const handleOpenMaps = () => {
    // Try Google Maps first, fallback to default maps
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    const appleMapsUrl = `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
    
    // Check if on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Try to open Apple Maps, fallback to Google Maps
      window.open(appleMapsUrl, '_blank');
    } else {
      // Open Google Maps for Android and web
      window.open(googleMapsUrl, '_blank');
    }
  };

  return (
    <Button 
      variant={variant}
      size={size}
      onClick={handleOpenMaps}
      className={className}
    >
      <Navigation className="w-4 h-4 ml-2" />
      {label}
    </Button>
  );
};

export default GoogleMapsButton;
