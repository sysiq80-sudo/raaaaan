import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import RegionMapEditor from "@/components/admin/RegionMapEditor";
import { 
  MapPin, 
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Clock,
  Save,
  Map,
  CheckCircle2,
  XCircle,
  Timer,
  Calendar,
  Target,
  ArrowUp,
  Loader2
} from "lucide-react";

interface Region {
  id: string;
  name_ar: string;
  name_en: string | null;
  base_fare: number;
  per_km_fare: number;
  per_minute_fare: number;
  waiting_fare_per_min: number;
  wait_timeout_minutes: number;
  weekend_wait_timeout_minutes: number;
  is_active: boolean;
  coordinates: Array<{ lat: number; lng: number }> | null;
  priority: number;
}

const AdminRegions = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name_ar: "",
    name_en: "",
    base_fare: 2000,
    per_km_fare: 500,
    per_minute_fare: 150,
    waiting_fare_per_min: 100,
    wait_timeout_minutes: 10,
    weekend_wait_timeout_minutes: 15,
    priority: 0,
  });

  // State for point testing
  const [testPoint, setTestPoint] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingPoint, setIsTestingPoint] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchRegions();
    }
  }, [isAdmin]);

  const fetchRegions = async () => {
    const { data, error } = await supabase
      .from("regions")
      .select("*")
      .order("name_ar");

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في جلب المناطق",
        variant: "destructive",
      });
    } else {
      // Transform coordinates from Json to proper type
      const transformedData = (data || []).map(region => ({
        ...region,
        coordinates: region.coordinates as Array<{ lat: number; lng: number }> | null,
        priority: region.priority ?? 0
      }));
      setRegions(transformedData);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingRegion) {
      const { error } = await supabase
        .from("regions")
        .update(formData)
        .eq("id", editingRegion.id);

      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "تم التحديث", description: "تم تحديث المنطقة بنجاح" });
        fetchRegions();
        setDialogOpen(false);
      }
    } else {
      const { error } = await supabase
        .from("regions")
        .insert([formData]);

      if (error) {
        toast({ title: "خطأ", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "تمت الإضافة", description: "تم إضافة المنطقة بنجاح" });
        fetchRegions();
        setDialogOpen(false);
      }
    }
  };

  const handleEdit = (region: Region) => {
    setEditingRegion(region);
    setFormData({
      name_ar: region.name_ar,
      name_en: region.name_en || "",
      base_fare: region.base_fare,
      per_km_fare: region.per_km_fare,
      per_minute_fare: region.per_minute_fare || 0,
      waiting_fare_per_min: region.waiting_fare_per_min,
      wait_timeout_minutes: region.wait_timeout_minutes || 10,
      weekend_wait_timeout_minutes: region.weekend_wait_timeout_minutes || 15,
      priority: region.priority ?? 0,
    });
    setDialogOpen(true);
  };

  const handleToggleActive = async (region: Region) => {
    const { error } = await supabase
      .from("regions")
      .update({ is_active: !region.is_active })
      .eq("id", region.id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      fetchRegions();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه المنطقة؟")) return;

    const { error } = await supabase
      .from("regions")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف", description: "تم حذف المنطقة بنجاح" });
      fetchRegions();
      if (selectedRegionId === id) {
        setSelectedRegionId(null);
      }
    }
  };

  const openAddDialog = () => {
    setEditingRegion(null);
    setFormData({
      name_ar: "",
      name_en: "",
      base_fare: 2000,
      per_km_fare: 500,
      per_minute_fare: 150,
      waiting_fare_per_min: 100,
      wait_timeout_minutes: 10,
      weekend_wait_timeout_minutes: 15,
      priority: 0,
    });
    setDialogOpen(true);
  };

  // Test a point against all regions
  const handleTestPoint = async () => {
    const lat = parseFloat(testPoint.lat);
    const lng = parseFloat(testPoint.lng);
    
    if (isNaN(lat) || isNaN(lng)) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال إحداثيات صحيحة",
        variant: "destructive"
      });
      return;
    }

    setIsTestingPoint(true);
    try {
      const response = await fetch(
        `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/check-service-area?lat=${lat}&lng=${lng}`
      );
      const result = await response.json();
      setTestResult(result);
      
      if (result.in_service) {
        toast({
          title: "✅ داخل منطقة الخدمة",
          description: `المنطقة: ${result.region?.name_ar}`
        });
      } else {
        toast({
          title: "⚠️ خارج منطقة الخدمة",
          description: result.nearest_region 
            ? `أقرب منطقة: ${result.nearest_region.name_ar} (${result.nearest_region.distance_km} كم)`
            : "لا توجد مناطق خدمة قريبة",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Test point error:", error);
      toast({
        title: "خطأ",
        description: "فشل في اختبار النقطة",
        variant: "destructive"
      });
    } finally {
      setIsTestingPoint(false);
    }
  };

  const handleSaveCoordinates = async (regionId: string, coordinates: Array<{ lat: number; lng: number }>) => {
    const { error } = await supabase
      .from("regions")
      .update({ coordinates })
      .eq("id", regionId);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحفظ", description: "تم حفظ حدود المنطقة بنجاح" });
      fetchRegions();
    }
  };

  const handleDeleteCoordinates = async (regionId: string) => {
    const { error } = await supabase
      .from("regions")
      .update({ coordinates: null })
      .eq("id", regionId);

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "تم الحذف", description: "تم حذف حدود المنطقة" });
      fetchRegions();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  const actions = (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button onClick={openAddDialog} className="shadow-glow">
          <Plus className="w-4 h-4 ml-2" />
          إضافة منطقة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingRegion ? "تعديل المنطقة" : "إضافة منطقة جديدة"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المنطقة (عربي)</Label>
              <Input
                value={formData.name_ar}
                onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                placeholder="الرمادي"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>اسم المنطقة (إنجليزي)</Label>
              <Input
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                placeholder="Ramadi"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>سعر البداية (الفتحة)</Label>
            <div className="relative">
              <DollarSign className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={formData.base_fare}
                onChange={(e) => setFormData({ ...formData, base_fare: parseInt(e.target.value) })}
                className="pr-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">دينار عراقي</p>
          </div>

          <div className="space-y-2">
            <Label>سعر الكيلومتر</Label>
            <div className="relative">
              <MapPin className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={formData.per_km_fare}
                onChange={(e) => setFormData({ ...formData, per_km_fare: parseInt(e.target.value) })}
                className="pr-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">دينار عراقي / كم</p>
          </div>

          <div className="space-y-2">
            <Label>سعر الدقيقة (وقت الرحلة)</Label>
            <div className="relative">
              <Timer className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={formData.per_minute_fare}
                onChange={(e) => setFormData({ ...formData, per_minute_fare: parseInt(e.target.value) || 0 })}
                className="pr-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">دينار عراقي / دقيقة — 0 لتعطيل</p>
          </div>

          <div className="space-y-2">
            <Label>سعر الانتظار</Label>
            <div className="relative">
              <Clock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                value={formData.waiting_fare_per_min}
                onChange={(e) => setFormData({ ...formData, waiting_fare_per_min: parseInt(e.target.value) })}
                className="pr-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">دينار عراقي / دقيقة</p>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <ArrowUp className="w-4 h-4 text-primary" />
              الأولوية
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              المناطق ذات الأولوية الأعلى تُختار عند التداخل (المناطق الفرعية = أولوية أعلى)
            </p>
            <div className="relative">
              <ArrowUp className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                className="pr-10"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">0 = منطقة رئيسية، 10+ = منطقة فرعية</p>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              إعدادات وقت انتظار الراكب
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
              الوقت الأقصى الذي ينتظره الراكب قبل الإلغاء التلقائي
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">أيام العمل</Label>
                <div className="relative">
                  <Timer className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.wait_timeout_minutes}
                    onChange={(e) => setFormData({ ...formData, wait_timeout_minutes: parseInt(e.target.value) || 10 })}
                    className="pr-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">دقيقة</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  العطلات
                </Label>
                <div className="relative">
                  <Timer className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={formData.weekend_wait_timeout_minutes}
                    onChange={(e) => setFormData({ ...formData, weekend_wait_timeout_minutes: parseInt(e.target.value) || 15 })}
                    className="pr-10"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">جمعة/سبت</p>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full">
            <Save className="w-4 h-4 ml-2" />
            {editingRegion ? "حفظ التغييرات" : "إضافة المنطقة"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <AdminLayout 
      title="إدارة المناطق والأسعار" 
      subtitle="تحكم بأسعار وحدود كل منطقة على الخريطة"
      actions={actions}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        {/* Map Section */}
        <div className="order-2 lg:order-1">
          <RegionMapEditor
            regions={regions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            onSaveCoordinates={handleSaveCoordinates}
            onDeleteCoordinates={handleDeleteCoordinates}
          />
          
          {/* Point Testing Tool */}
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4" />
                اختبار نقطة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="خط العرض (lat)"
                  value={testPoint.lat}
                  onChange={(e) => setTestPoint(prev => ({ ...prev, lat: e.target.value }))}
                  dir="ltr"
                  className="text-sm"
                />
                <Input
                  placeholder="خط الطول (lng)"
                  value={testPoint.lng}
                  onChange={(e) => setTestPoint(prev => ({ ...prev, lng: e.target.value }))}
                  dir="ltr"
                  className="text-sm"
                />
              </div>
              <Button 
                onClick={handleTestPoint} 
                disabled={isTestingPoint}
                className="w-full"
                size="sm"
              >
                {isTestingPoint ? (
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                ) : (
                  <Target className="w-4 h-4 ml-2" />
                )}
                اختبار الموقع
              </Button>
              
              {testResult && (
                <div className={`p-3 rounded-lg text-sm ${
                  testResult.in_service 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {testResult.in_service ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>داخل الخدمة: {testResult.region?.name_ar}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      <span>
                        خارج الخدمة
                        {testResult.nearest_region && (
                          <> - أقرب: {testResult.nearest_region.name_ar} ({testResult.nearest_region.distance_km} كم)</>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Regions List Section */}
        <div className="order-1 lg:order-2 overflow-y-auto">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">جاري التحميل...</p>
            </div>
          ) : regions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-bold mb-2">لا توجد مناطق</h3>
                <p className="text-muted-foreground mb-4">ابدأ بإضافة أول منطقة</p>
                <Button onClick={openAddDialog}>
                  <Plus className="w-4 h-4 ml-2" />
                  إضافة منطقة
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {regions.map((region) => (
                <Card 
                  key={region.id} 
                  className={`transition-all cursor-pointer ${
                    !region.is_active && 'opacity-60'
                  } ${
                    selectedRegionId === region.id 
                      ? 'ring-2 ring-primary shadow-glow' 
                      : 'hover:shadow-lg'
                  }`}
                  onClick={() => setSelectedRegionId(region.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          region.coordinates && region.coordinates.length >= 3
                            ? 'bg-primary/20'
                            : 'bg-muted'
                        }`}>
                          <Map className={`w-5 h-5 ${
                            region.coordinates && region.coordinates.length >= 3
                              ? 'text-primary'
                              : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{region.name_ar}</CardTitle>
                          {region.name_en && (
                            <p className="text-sm text-muted-foreground">{region.name_en}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {region.coordinates && region.coordinates.length >= 3 ? (
                          <span className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            محدد
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                            <XCircle className="w-3 h-3" />
                            غير محدد
                          </span>
                        )}
                        <Switch
                          checked={region.is_active}
                          onCheckedChange={() => handleToggleActive(region)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 gap-2 mb-4">
                      <div className="text-center p-2 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">البداية</p>
                        <p className="font-bold text-sm">{region.base_fare.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">الكيلومتر</p>
                        <p className="font-bold text-sm">{region.per_km_fare.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">الدقيقة</p>
                        <p className="font-bold text-sm">{(region.per_minute_fare || 0).toLocaleString()}</p>
                      </div>
                      <div className="text-center p-2 bg-muted/50 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">الانتظار</p>
                        <p className="font-bold text-sm">{region.waiting_fare_per_min.toLocaleString()}</p>
                      </div>
                      <div className="text-center p-2 bg-primary/10 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">الإلغاء</p>
                        <p className="font-bold text-sm text-primary">{region.wait_timeout_minutes || 10}د</p>
                      </div>
                      <div className="text-center p-2 bg-secondary rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">الأولوية</p>
                        <p className="font-bold text-sm text-secondary-foreground">{region.priority}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(region);
                        }}
                      >
                        <Pencil className="w-4 h-4 ml-1" />
                        الأسعار
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(region.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminRegions;
