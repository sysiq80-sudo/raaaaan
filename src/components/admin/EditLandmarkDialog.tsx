import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { landmarkCategories } from "@/pages/admin/AdminLandmarks";
import { Loader2, MapPin, Target, Edit2 } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface Region {
  id: string;
  name_ar: string;
}

interface Governorate {
  id: string;
  name_ar: string;
  code: string;
}

interface LandmarkData {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  location: { lat: number; lng: number };
  region_id: string | null;
  governorate_id?: string | null;
  is_active: boolean;
}

interface EditLandmarkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landmark: LandmarkData;
  regions: Region[];
  governorates: Governorate[];
  onSuccess: () => void;
}

export const EditLandmarkDialog = ({
  open,
  onOpenChange,
  landmark,
  regions,
  governorates,
  onSuccess,
}: EditLandmarkDialogProps) => {
  const { toast } = useToast();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);

  const [loading, setLoading] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name_ar: landmark.name_ar,
    name_en: landmark.name_en || "",
    category: landmark.category || "landmark",
    region_id: landmark.region_id || "",
    governorate_id: landmark.governorate_id || "",
    is_active: landmark.is_active,
    lat: landmark.location.lat,
    lng: landmark.location.lng,
  });

  // Update form data when landmark changes
  useEffect(() => {
    setFormData({
      name_ar: landmark.name_ar,
      name_en: landmark.name_en || "",
      category: landmark.category || "landmark",
      region_id: landmark.region_id || "",
      governorate_id: landmark.governorate_id || "",
      is_active: landmark.is_active,
      lat: landmark.location.lat,
      lng: landmark.location.lng,
    });
  }, [landmark]);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          "https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token"
        );
        const data = await response.json();
        if (data.token) setMapToken(data.token);
      } catch (error) {
        console.error("Error fetching token:", error);
      }
    };
    if (open) fetchToken();
  }, [open]);

  // Initialize map
  useEffect(() => {
    if (!open || !mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [formData.lng, formData.lat],
      zoom: 15,
    });

    // Add draggable marker
    marker.current = new mapboxgl.Marker({ draggable: true, color: "#f59e0b" })
      .setLngLat([formData.lng, formData.lat])
      .addTo(map.current);

    marker.current.on("dragend", () => {
      const lngLat = marker.current?.getLngLat();
      if (lngLat) {
        setFormData((prev) => ({ ...prev, lat: lngLat.lat, lng: lngLat.lng }));
      }
    });

    // Click on map to move marker
    map.current.on("click", (e) => {
      marker.current?.setLngLat(e.lngLat);
      setFormData((prev) => ({
        ...prev,
        lat: e.lngLat.lat,
        lng: e.lngLat.lng,
      }));
    });

    return () => {
      map.current?.remove();
    };
  }, [open, mapToken]);

  const handleSubmit = async () => {
    if (!formData.name_ar.trim()) {
      toast({
        title: "خطأ",
        description: "الاسم العربي مطلوب",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase
      .from("landmarks")
      .update({
        name_ar: formData.name_ar.trim(),
        name_en: formData.name_en.trim() || null,
        category: formData.category,
        region_id: formData.region_id || null,
        is_active: formData.is_active,
        location: { lat: formData.lat, lng: formData.lng },
      })
      .eq("id", landmark.id);

    setLoading(false);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث المعلم",
        variant: "destructive",
      });
    } else {
      toast({
        title: "تم التحديث",
        description: `تم تحديث "${formData.name_ar}" بنجاح`,
      });
      onSuccess();
      onOpenChange(false);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData((prev) => ({ ...prev, lat: latitude, lng: longitude }));
          marker.current?.setLngLat([longitude, latitude]);
          map.current?.flyTo({ center: [longitude, latitude], zoom: 16 });
        },
        (error) => {
          toast({
            title: "خطأ",
            description: "فشل في تحديد الموقع",
            variant: "destructive",
          });
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-amber-500" />
            تعديل المعلم
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name_ar">الاسم بالعربية *</Label>
              <Input
                id="name_ar"
                placeholder="مثال: جامعة الأنبار"
                value={formData.name_ar}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name_ar: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_en">الاسم بالإنجليزية</Label>
              <Input
                id="name_en"
                placeholder="e.g. University of Anbar"
                value={formData.name_en}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name_en: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(landmarkCategories).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <config.icon className="w-4 h-4" />
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المنطقة</Label>
              <Select
                value={formData.region_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, region_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المنطقة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون منطقة</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>المحافظة</Label>
            <Select
              value={formData.governorate_id}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, governorate_id: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر المحافظة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">بدون محافظة</SelectItem>
                {governorates.map((gov) => (
                  <SelectItem key={gov.id} value={gov.id}>
                    {gov.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Map */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>تحديد الموقع على الخريطة</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGetCurrentLocation}
                className="gap-2"
              >
                <Target className="w-4 h-4" />
                موقعي الحالي
              </Button>
            </div>
            <div
              ref={mapContainer}
              className="h-[250px] rounded-lg border overflow-hidden"
            />
            <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
              <span>
                خط العرض:{" "}
                <strong className="font-mono">{formData.lat.toFixed(6)}</strong>
              </span>
              <span>
                خط الطول:{" "}
                <strong className="font-mono">{formData.lng.toFixed(6)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-lg">
            <div>
              <Label htmlFor="is_active">تفعيل المعلم</Label>
              <p className="text-xs text-muted-foreground">
                المعالم الفعالة تظهر في نتائج البحث
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_active: checked }))
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {loading && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
