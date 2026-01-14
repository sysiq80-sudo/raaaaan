import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ArrowRight,
  MapPin,
  Home,
  Briefcase,
  Star,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Navigation,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PRESET_LABELS, EXTENDED_ICONS } from "@/components/rider/SavedPlaces";

interface SavedPlace {
  id: string;
  name: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  icon: string;
}

const RiderSavedPlacesPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        navigate("/auth?redirect=/rider/saved-places");
        return;
      }
      setUserId(data.user.id);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchPlaces();
    }
  }, [userId]);

  const fetchPlaces = async () => {
    if (!userId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("saved_places")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setPlaces(data);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("saved_places").delete().eq("id", id);

    if (!error) {
      setPlaces(places.filter((p) => p.id !== id));
      toast({ title: "تم حذف المكان بنجاح" });
    } else {
      toast({
        title: "خطأ",
        description: "فشل في حذف المكان",
        variant: "destructive",
      });
    }
  };

  const getIconComponent = (label: string, icon?: string) => {
    const extendedIcon = EXTENDED_ICONS.find((i) => i.icon === icon);
    if (extendedIcon) {
      const IconComponent = extendedIcon.lucideIcon;
      return <IconComponent className="w-5 h-5" />;
    }

    switch (label) {
      case "home":
        return <Home className="w-5 h-5" />;
      case "work":
        return <Briefcase className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getColorForLabel = (label: string) => {
    switch (label) {
      case "home":
        return "bg-blue-500/20 text-blue-600";
      case "work":
        return "bg-amber-500/20 text-amber-600";
      case "school":
        return "bg-purple-500/20 text-purple-600";
      case "gym":
        return "bg-red-500/20 text-red-600";
      case "restaurant":
        return "bg-orange-500/20 text-orange-600";
      case "hospital":
        return "bg-pink-500/20 text-pink-600";
      case "shopping":
        return "bg-cyan-500/20 text-cyan-600";
      default:
        return "bg-primary/20 text-primary";
    }
  };

  const handleNavigateTo = (place: SavedPlace) => {
    const params = new URLSearchParams({
      dropoff_lat: place.lat.toString(),
      dropoff_lng: place.lng.toString(),
      dropoff_address: place.address,
    });
    navigate(`/rider?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/rider")}
            className="shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">الأماكن المحفوظة</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground/50" />
            <p className="text-muted-foreground">لا توجد أماكن محفوظة</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              يمكنك حفظ الأماكن المفضلة من صفحة الحجز لسهولة الوصول إليها لاحقاً
            </p>
            <Button onClick={() => navigate("/rider")} className="gap-2">
              <Plus className="w-4 h-4" />
              أضف مكاناً جديداً
            </Button>
          </div>
        ) : (
          <>
            {/* Quick add buttons */}
            <div className="grid grid-cols-2 gap-3">
              {!places.find((p) => p.label === "home") && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-blue-500/10 hover:border-blue-500/30"
                  onClick={() => navigate("/rider")}
                >
                  <Home className="w-6 h-6 text-blue-500" />
                  <span>أضف المنزل</span>
                </Button>
              )}
              {!places.find((p) => p.label === "work") && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-amber-500/10 hover:border-amber-500/30"
                  onClick={() => navigate("/rider")}
                >
                  <Briefcase className="w-6 h-6 text-amber-500" />
                  <span>أضف العمل</span>
                </Button>
              )}
            </div>

            {/* Places list */}
            <div className="space-y-3">
              {places.map((place) => (
                <Card key={place.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getColorForLabel(
                          place.label
                        )}`}
                      >
                        {getIconComponent(place.label, place.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{place.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {place.address}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => handleNavigateTo(place)}
                      >
                        <Navigation className="w-4 h-4" />
                        اذهب إلى هنا
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(place.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RiderSavedPlacesPage;
