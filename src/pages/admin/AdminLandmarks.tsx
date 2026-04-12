import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  MapPin,
  Edit2,
  Trash2,
  Building2,
  GraduationCap,
  ShoppingBag,
  Hospital,
  Church,
  Landmark,
  Train,
  Plane,
  Fuel,
  Utensils,
  Hotel,
  ParkingCircle,
  Flag,
  Home,
  Filter,
  LayoutGrid,
  List,
  MapPinned,
  CheckCircle,
  XCircle,
  MoreVertical,
  Upload,
  Map,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddLandmarkDialog } from "@/components/admin/AddLandmarkDialog";
import { EditLandmarkDialog } from "@/components/admin/EditLandmarkDialog";
import { ImportLandmarksDialog } from "@/components/admin/ImportLandmarksDialog";
import { LandmarksMapView } from "@/components/admin/LandmarksMapView";

// Category configuration with icons and colors
export const landmarkCategories = {
  hospital: { label: "مستشفى / مركز صحي", icon: Hospital, color: "bg-red-500" },
  university: {
    label: "جامعة / كلية",
    icon: GraduationCap,
    color: "bg-blue-500",
  },
  school: { label: "مدرسة", icon: Building2, color: "bg-indigo-500" },
  mosque: { label: "مسجد / جامع", icon: Church, color: "bg-emerald-500" },
  market: {
    label: "سوق / مجمع تجاري",
    icon: ShoppingBag,
    color: "bg-orange-500",
  },
  government: { label: "دائرة حكومية", icon: Landmark, color: "bg-purple-500" },
  station: { label: "محطة / موقف", icon: Train, color: "bg-cyan-500" },
  airport: { label: "مطار", icon: Plane, color: "bg-sky-500" },
  gas_station: { label: "محطة وقود", icon: Fuel, color: "bg-yellow-500" },
  restaurant: { label: "مطعم / مقهى", icon: Utensils, color: "bg-pink-500" },
  hotel: { label: "فندق", icon: Hotel, color: "bg-violet-500" },
  parking: { label: "موقف سيارات", icon: ParkingCircle, color: "bg-slate-500" },
  landmark: { label: "معلم بارز", icon: Flag, color: "bg-amber-500" },
  residential: { label: "حي سكني", icon: Home, color: "bg-teal-500" },
  other: { label: "أخرى", icon: MapPin, color: "bg-gray-500" },
};

interface LandmarkData {
  id: string;
  name_ar: string;
  name_en: string | null;
  category: string | null;
  location: { lat: number; lng: number };
  region_id: string | null;
  governorate_id?: string | null;
  is_active: boolean;
  created_at: string;
  region?: { name_ar: string } | null;
  governorate?: { name_ar: string } | null;
}

interface Region {
  id: string;
  name_ar: string;
}

interface Governorate {
  id: string;
  name_ar: string;
  code: string;
}

const AdminLandmarks = () => {
  const { toast } = useToast();
  const { isAdmin, loading: authLoading } = useAdminAuth();
  const [landmarks, setLandmarks] = useState<LandmarkData[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [governorateFilter, setGovernorateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table" | "map">("grid");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [editingLandmark, setEditingLandmark] = useState<LandmarkData | null>(
    null
  );

  const fetchLandmarks = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("landmarks")
      .select(
        `
        *,
        region:regions(name_ar)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching landmarks:", error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل المعالم",
        variant: "destructive",
      });
    }

    if (!error && data) {
      // Fetch governorates separately to map names
      const govIds = [...new Set(data.filter(d => d.governorate_id).map(d => d.governorate_id))];
      let govMap: Record<string, string> = {};
      
      if (govIds.length > 0) {
        const { data: govData } = await supabase
          .from("governorates")
          .select("id, name_ar")
          .in("id", govIds as string[]);
        
        if (govData) {
          govMap = govData.reduce((acc, g) => ({ ...acc, [g.id]: g.name_ar }), {} as Record<string, string>);
        }
      }
      
      setLandmarks(
        data.map((item) => ({
          ...item,
          location: item.location as { lat: number; lng: number },
          region: item.region as { name_ar: string } | null,
          governorate: item.governorate_id && govMap[item.governorate_id] 
            ? { name_ar: govMap[item.governorate_id] } 
            : null,
        }))
      );
    }
    setLoading(false);
  }, [toast]);

  const fetchRegions = useCallback(async () => {
    const { data } = await supabase
      .from("regions")
      .select("id, name_ar")
      .eq("is_active", true)
      .order("name_ar");

    if (data) setRegions(data);
  }, []);

  const fetchGovernorates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("governorates")
        .select("id, name_ar, code")
        .order("name_ar");

      if (error) {
        console.error("Error fetching governorates:", error);
      } else if (data) {
        setGovernorates(data as Governorate[]);
      }
    } catch (err) {
      console.error("Error in fetchGovernorates:", err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchLandmarks();
    fetchRegions();
    fetchGovernorates();
  }, [isAdmin, fetchLandmarks, fetchRegions, fetchGovernorates]);

  const handleToggleActive = async (landmark: LandmarkData) => {
    const { error } = await supabase
      .from("landmarks")
      .update({ is_active: !landmark.is_active })
      .eq("id", landmark.id);

    if (!error) {
      toast({
        title: landmark.is_active ? "تم إلغاء التفعيل" : "تم التفعيل",
        description: `المعلم "${landmark.name_ar}" ${
          landmark.is_active ? "غير فعال الآن" : "فعال الآن"
        }`,
      });
      fetchLandmarks();
    }
  };

  const handleDelete = async (landmark: LandmarkData) => {
    if (!confirm(`هل أنت متأكد من حذف "${landmark.name_ar}"؟`)) return;

    const { error } = await supabase
      .from("landmarks")
      .delete()
      .eq("id", landmark.id);

    if (!error) {
      toast({
        title: "تم الحذف",
        description: `تم حذف المعلم "${landmark.name_ar}"`,
      });
      fetchLandmarks();
    } else {
      toast({
        title: "خطأ",
        description: "فشل في حذف المعلم",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllByGovernorate = async () => {
    if (governorateFilter === "all") {
      toast({
        title: "خطأ",
        description: "يجب اختيار محافظة محددة للحذف",
        variant: "destructive",
      });
      return;
    }

    const governorateName = governorates.find(
      (g) => g.id === governorateFilter
    )?.name_ar;

    const landmarksToDelete = landmarks.filter(
      (l) => l.governorate_id === governorateFilter
    );

    if (landmarksToDelete.length === 0) {
      toast({
        title: "تنبيه",
        description: "لا توجد معالم لحذفها في هذه المحافظة",
      });
      return;
    }

    const { data: rpcResult, error } = await supabase.rpc(
      "admin_delete_landmarks_by_governorate",
      { governorate_id_param: governorateFilter }
    );

    if (!error && rpcResult?.success) {
      toast({
        title: "تم الحذف بنجاح",
        description: `تم حذف ${rpcResult.deleted} معلم من محافظة ${governorateName}`,
      });
      setShowDeleteAllDialog(false);
      setGovernorateFilter("all");
      fetchLandmarks();
    } else {
      toast({
        title: "خطأ",
        description: rpcResult?.error || "فشل في حذف المعالم",
        variant: "destructive",
      });
    }
  };

  // Filter landmarks
  const filteredLandmarks = landmarks.filter((landmark) => {
    const matchesSearch =
      landmark.name_ar.toLowerCase().includes(searchQuery.toLowerCase()) ||
      landmark.name_en?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || landmark.category === categoryFilter;
    const matchesRegion =
      regionFilter === "all" || landmark.region_id === regionFilter;
    const matchesGovernorate =
      governorateFilter === "all" ||
      landmark.governorate_id === governorateFilter;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && landmark.is_active) ||
      (statusFilter === "inactive" && !landmark.is_active);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesRegion &&
      matchesGovernorate &&
      matchesStatus
    );
  });

  // Stats
  const stats = {
    total: landmarks.length,
    active: landmarks.filter((l) => l.is_active).length,
    inactive: landmarks.filter((l) => !l.is_active).length,
    categories: Object.keys(landmarkCategories)
      .map((cat) => ({
        category: cat,
        count: landmarks.filter((l) => l.category === cat).length,
      }))
      .filter((c) => c.count > 0),
  };

  const getCategoryIcon = (category: string | null) => {
    const config =
      landmarkCategories[category as keyof typeof landmarkCategories] ||
      landmarkCategories.other;
    const Icon = config.icon;
    return <Icon className="w-5 h-5" />;
  };

  const getCategoryLabel = (category: string | null) => {
    return (
      landmarkCategories[category as keyof typeof landmarkCategories]?.label ||
      "أخرى"
    );
  };

  const getCategoryColor = (category: string | null) => {
    return (
      landmarkCategories[category as keyof typeof landmarkCategories]?.color ||
      "bg-gray-500"
    );
  };

  return (
    <AdminLayout
      title="إدارة المعالم والأماكن"
      subtitle="إضافة وتعديل المعالم المعروفة لتسهيل تحديد المواقع"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            استيراد من ملف
          </Button>
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            إضافة معلم جديد
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <MapPinned className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">إجمالي المعالم</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">معالم فعالة</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.active}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">معالم معطلة</p>
              <p className="text-2xl font-bold text-amber-600">
                {stats.inactive}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Filter className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">التصنيفات</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.categories.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[250px] relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
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

            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="المنطقة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المناطق</SelectItem>
                {regions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={governorateFilter}
              onValueChange={setGovernorateFilter}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="المحافظة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المحافظات</SelectItem>
                {governorates.map((gov) => (
                  <SelectItem key={gov.id} value={gov.id}>
                    {gov.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {governorateFilter !== "all" && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteAllDialog(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                حذف جميع معالم المحافظة
              </Button>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="inactive">معطل</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                title="عرض شبكي"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
                title="عرض جدول"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "map" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("map")}
                title="عرض خريطة"
              >
                <Map className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Map View */}
      {viewMode === "map" && !loading && (
        <LandmarksMapView
          landmarks={landmarks}
          onLandmarkClick={(landmark) => setEditingLandmark(landmark)}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : viewMode === "map" ? null : filteredLandmarks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد معالم</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || categoryFilter !== "all" || regionFilter !== "all"
                ? "لم يتم العثور على معالم تطابق البحث"
                : "لم تتم إضافة أي معالم بعد"}
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 ml-2" />
              إضافة أول معلم
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLandmarks.map((landmark) => (
            <Card
              key={landmark.id}
              className={`relative overflow-hidden transition-all hover:shadow-lg ${
                !landmark.is_active ? "opacity-60" : ""
              }`}
            >
              <div
                className={`absolute top-0 right-0 left-0 h-1 ${getCategoryColor(
                  landmark.category
                )}`}
              />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg ${getCategoryColor(
                        landmark.category
                      )} text-white flex items-center justify-center`}
                    >
                      {getCategoryIcon(landmark.category)}
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {landmark.name_ar}
                      </CardTitle>
                      {landmark.name_en && (
                        <p className="text-sm text-muted-foreground">
                          {landmark.name_en}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingLandmark(landmark)}
                      >
                        <Edit2 className="w-4 h-4 ml-2" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(landmark)}
                      >
                        {landmark.is_active ? (
                          <>
                            <XCircle className="w-4 h-4 ml-2" />
                            إلغاء التفعيل
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 ml-2" />
                            تفعيل
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(landmark)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="outline" className="gap-1">
                      {getCategoryIcon(landmark.category)}
                      {getCategoryLabel(landmark.category)}
                    </Badge>
                    {landmark.is_active ? (
                      <Badge variant="default" className="bg-green-500">
                        فعال
                      </Badge>
                    ) : (
                      <Badge variant="secondary">معطل</Badge>
                    )}
                  </div>

                  {landmark.governorate && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Flag className="w-4 h-4" />
                      {landmark.governorate.name_ar}
                    </p>
                  )}

                  {landmark.region && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {landmark.region.name_ar}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground font-mono">
                    {landmark.location.lat.toFixed(6)},{" "}
                    {landmark.location.lng.toFixed(6)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المعلم</TableHead>
                <TableHead>التصنيف</TableHead>
                <TableHead>المحافظة</TableHead>
                <TableHead>المنطقة</TableHead>
                <TableHead>الإحداثيات</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="w-[100px]">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLandmarks.map((landmark) => (
                <TableRow
                  key={landmark.id}
                  className={!landmark.is_active ? "opacity-60" : ""}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg ${getCategoryColor(
                          landmark.category
                        )} text-white flex items-center justify-center`}
                      >
                        {getCategoryIcon(landmark.category)}
                      </div>
                      <div>
                        <p className="font-medium">{landmark.name_ar}</p>
                        {landmark.name_en && (
                          <p className="text-xs text-muted-foreground">
                            {landmark.name_en}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {getCategoryLabel(landmark.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      {landmark.governorate?.name_ar || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>{landmark.region?.name_ar || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {landmark.location.lat.toFixed(4)},{" "}
                    {landmark.location.lng.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    {landmark.is_active ? (
                      <Badge className="bg-green-500">فعال</Badge>
                    ) : (
                      <Badge variant="secondary">معطل</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingLandmark(landmark)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(landmark)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dialogs */}
      <AddLandmarkDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        regions={regions}
        governorates={governorates}
        onSuccess={fetchLandmarks}
      />

      {editingLandmark && (
        <EditLandmarkDialog
          open={!!editingLandmark}
          onOpenChange={(open) => !open && setEditingLandmark(null)}
          landmark={editingLandmark}
          regions={regions}
          governorates={governorates}
          onSuccess={fetchLandmarks}
        />
      )}

      {/* Import Dialog */}
      <ImportLandmarksDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        regions={regions}
        governorates={governorates}
        onSuccess={fetchLandmarks}
      />

      {/* Delete All Dialog */}
      {showDeleteAllDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                تأكيد حذف جميع المعالم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                أنت على وشك حذف{" "}
                <strong>
                  {
                    filteredLandmarks.filter(
                      (l) => l.governorate_id === governorateFilter
                    ).length
                  }
                </strong>{" "}
                معلم من محافظة{" "}
                <strong>
                  {
                    governorates.find((g) => g.id === governorateFilter)
                      ?.name_ar
                  }
                </strong>
              </p>

              <p className="text-sm">
                هل أنت متأكد من حذف جميع المعالم في هذه المحافظة؟
              </p>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteAllDialog(false)}
                >
                  إلغاء
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAllByGovernorate}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  تأكيد الحذف
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminLandmarks;
