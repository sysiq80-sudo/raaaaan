/**
 * ران المطور — مركز إدارة الإعدادات الديناميكية
 * Raan Developer — Centralized Configuration Hub v2 (Card/Grid UI)
 *
 * يدير كل المفاتيح والتوكنات من مكان واحد عبر جدول system_configs
 * واجهة بطاقات (Card Grid) مع تبويبات لكل فئة
 *
 * v2 — 2026-02-23: إعادة تصميم كامل من Table إلى Card Grid
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Code,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Save,
  MessageCircle,
  Send,
  Brain,
  MapPin,
  Database,
  Globe,
  Instagram,
  Twitter,
  Music2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  Smartphone,
  CreditCard,
  Bot,
  Sparkles,
  Map,
} from "lucide-react";

// ════════════════════════════════════════════════════════════
// أنواع البيانات
// ════════════════════════════════════════════════════════════

interface SystemConfig {
  id: string;
  category: string;
  key_name: string;
  key_value: string;
  is_secret: boolean;
  description: string | null;
  updated_at: string;
  created_at: string;
}

interface ConfigFormData {
  category: string;
  key_name: string;
  key_value: string;
  is_secret: boolean;
  description: string;
}

// ════════════════════════════════════════════════════════════
// تعريف الفئات مع الأيقونات والألوان
// ════════════════════════════════════════════════════════════

const CATEGORY_META: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  description: string;
}> = {
  whatsapp: {
    label: "واتساب",
    icon: MessageCircle,
    color: "text-green-600",
    bgGradient: "from-green-500/10 to-green-600/5 border-green-200/60",
    description: "WhatsApp Business API — التوكن ورقم الهاتف ومفتاح التحقق",
  },
  telegram: {
    label: "تليجرام",
    icon: Send,
    color: "text-blue-600",
    bgGradient: "from-blue-500/10 to-blue-600/5 border-blue-200/60",
    description: "Telegram Bot — توكن البوت الرئيسي",
  },
  openai: {
    label: "OpenAI",
    icon: Brain,
    color: "text-purple-600",
    bgGradient: "from-purple-500/10 to-purple-600/5 border-purple-200/60",
    description: "OpenAI API — GPT-4o + Whisper",
  },
  deepseek: {
    label: "DeepSeek",
    icon: Sparkles,
    color: "text-violet-600",
    bgGradient: "from-violet-500/10 to-violet-600/5 border-violet-200/60",
    description: "DeepSeek API — المساعد الذكي الإداري",
  },
  google_maps: {
    label: "خرائط جوجل",
    icon: MapPin,
    color: "text-red-600",
    bgGradient: "from-red-500/10 to-red-600/5 border-red-200/60",
    description: "Google Maps Platform — Geocoding + Directions",
  },
  mapbox: {
    label: "Mapbox",
    icon: Map,
    color: "text-sky-600",
    bgGradient: "from-sky-500/10 to-sky-600/5 border-sky-200/60",
    description: "Mapbox GL — الخرائط التفاعلية وبحث الأماكن",
  },
  supabase_core: {
    label: "Supabase",
    icon: Database,
    color: "text-emerald-600",
    bgGradient: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60",
    description: "Supabase — URL و Service Role Key",
  },
  sms: {
    label: "SMS / OTP",
    icon: Smartphone,
    color: "text-orange-600",
    bgGradient: "from-orange-500/10 to-orange-600/5 border-orange-200/60",
    description: "OTPIQ — خدمة رسائل SMS والتحقق",
  },
  captain_bot: {
    label: "بوت الكابتن",
    icon: Bot,
    color: "text-cyan-600",
    bgGradient: "from-cyan-500/10 to-cyan-600/5 border-cyan-200/60",
    description: "Captain Support Bot — دعم السائقين عبر تيليغرام",
  },
  nass_payment: {
    label: "بوابة ناس",
    icon: CreditCard,
    color: "text-amber-600",
    bgGradient: "from-amber-500/10 to-amber-600/5 border-amber-200/60",
    description: "Nass Payment Gateway — الدفع الإلكتروني",
  },
  site: {
    label: "الموقع",
    icon: Globe,
    color: "text-gray-600",
    bgGradient: "from-gray-500/10 to-gray-600/5 border-gray-200/60",
    description: "إعدادات الموقع العامة — الرابط الرئيسي",
  },
  instagram: {
    label: "انستجرام",
    icon: Instagram,
    color: "text-pink-600",
    bgGradient: "from-pink-500/10 to-pink-600/5 border-pink-200/60",
    description: "Instagram API — للتوسع المستقبلي",
  },
  messenger: {
    label: "ماسنجر",
    icon: MessageCircle,
    color: "text-indigo-600",
    bgGradient: "from-indigo-500/10 to-indigo-600/5 border-indigo-200/60",
    description: "Facebook Messenger — للتوسع المستقبلي",
  },
  x_twitter: {
    label: "X / تويتر",
    icon: Twitter,
    color: "text-slate-600",
    bgGradient: "from-slate-500/10 to-slate-600/5 border-slate-200/60",
    description: "X (Twitter) API — للتوسع المستقبلي",
  },
  tiktok: {
    label: "تيك توك",
    icon: Music2,
    color: "text-rose-600",
    bgGradient: "from-rose-500/10 to-rose-600/5 border-rose-200/60",
    description: "TikTok API — للتوسع المستقبلي",
  },
};

const CATEGORY_ORDER = [
  "whatsapp",
  "telegram",
  "openai",
  "deepseek",
  "google_maps",
  "mapbox",
  "supabase_core",
  "sms",
  "captain_bot",
  "nass_payment",
  "site",
  "instagram",
  "messenger",
  "x_twitter",
  "tiktok",
];

const EMPTY_FORM: ConfigFormData = {
  category: "",
  key_name: "",
  key_value: "",
  is_secret: true,
  description: "",
};

// ════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════

const AdminDeveloperSettings = () => {
  const { toast } = useToast();
  const { loading: authLoading, isAdmin } = useAdminAuth();

  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [searchQuery, setSearchQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [formData, setFormData] = useState<ConfigFormData>({ ...EMPTY_FORM });

  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState<SystemConfig | null>(null);

  // ════════════════════════════════════════════════════════════
  // جلب الإعدادات
  // ════════════════════════════════════════════════════════════

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await (supabase as any)
        .from("system_configs")
        .select("*")
        .order("category", { ascending: true })
        .order("key_name", { ascending: true });

      if (res.error) throw res.error;
      setConfigs((res.data as SystemConfig[]) || []);
    } catch (err: unknown) {
      console.error("Error fetching configs:", err);
      toast({
        title: "خطأ في جلب الإعدادات",
        description: err instanceof Error ? err.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isAdmin) fetchConfigs();
  }, [isAdmin, fetchConfigs]);

  // ════════════════════════════════════════════════════════════
  // حفظ (إضافة / تعديل)
  // ════════════════════════════════════════════════════════════

  const handleSave = async () => {
    if (!formData.key_name.trim()) {
      toast({ title: "اسم المفتاح مطلوب", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      if (editingConfig) {
        const { error } = await sb
          .from("system_configs")
          .update({
            key_value: formData.key_value,
            is_secret: formData.is_secret,
            description: formData.description || null,
          })
          .eq("id", editingConfig.id);

        if (error) throw error;
        toast({ title: "تم تحديث الإعداد بنجاح ✅" });
      } else {
        const { error } = await sb
          .from("system_configs")
          .insert({
            category: formData.category || activeTab,
            key_name: formData.key_name.trim().toUpperCase(),
            key_value: formData.key_value,
            is_secret: formData.is_secret,
            description: formData.description || null,
          });

        if (error) throw error;
        toast({ title: "تم إضافة الإعداد بنجاح ✅" });
      }

      setDialogOpen(false);
      setEditingConfig(null);
      setFormData({ ...EMPTY_FORM });
      await fetchConfigs();
    } catch (err: unknown) {
      console.error("Save error:", err);
      toast({
        title: "خطأ في الحفظ",
        description: err instanceof Error ? err.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // حذف
  // ════════════════════════════════════════════════════════════

  const handleDelete = async () => {
    if (!deletingConfig) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("system_configs")
        .delete()
        .eq("id", deletingConfig.id);

      if (error) throw error;
      toast({ title: "تم حذف الإعداد ✅" });
      setDeleteDialogOpen(false);
      setDeletingConfig(null);
      await fetchConfigs();
    } catch (err: unknown) {
      console.error("Delete error:", err);
      toast({
        title: "خطأ في الحذف",
        description: err instanceof Error ? err.message : "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // مساعدات
  // ════════════════════════════════════════════════════════════

  const toggleReveal = (keyName: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyName)) { next.delete(keyName); } else { next.add(keyName); }
      return next;
    });
  };

  const maskValue = (value: string) => {
    if (!value) return "";
    if (value.length <= 8) return "••••••••";
    return value.slice(0, 4) + "••••" + value.slice(-4);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "تم النسخ للحافظة 📋" });
  };

  const openAddDialog = () => {
    setEditingConfig(null);
    setFormData({ ...EMPTY_FORM, category: activeTab });
    setDialogOpen(true);
  };

  const openEditDialog = (config: SystemConfig) => {
    setEditingConfig(config);
    setFormData({
      category: config.category,
      key_name: config.key_name,
      key_value: config.key_value,
      is_secret: config.is_secret,
      description: config.description || "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (config: SystemConfig) => {
    setDeletingConfig(config);
    setDeleteDialogOpen(true);
  };

  // ════════════════════════════════════════════════════════════
  // فلترة
  // ════════════════════════════════════════════════════════════

  const getConfigsByCategory = (category: string) => {
    return configs.filter((c) => {
      if (c.category !== category) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.key_name.toLowerCase().includes(q) ||
        (c.description || "").toLowerCase().includes(q)
      );
    });
  };

  const totalConfigs = configs.length;
  const filledConfigs = configs.filter((c) => c.key_value?.trim()).length;
  const emptyConfigs = totalConfigs - filledConfigs;
  const secretConfigs = configs.filter((c) => c.is_secret).length;

  // ════════════════════════════════════════════════════════════
  // حالات التحميل
  // ════════════════════════════════════════════════════════════

  if (authLoading) {
    return (
      <AdminLayout title="ران المطور" subtitle="جاري التحقق...">
        <div className="flex items-center justify-center min-h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title="غير مصرح" subtitle="لا تملك صلاحية الوصول">
        <div className="text-center py-20 text-muted-foreground">
          <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <p className="text-lg">هذه الصفحة متاحة فقط للمديرين</p>
        </div>
      </AdminLayout>
    );
  }

  // ════════════════════════════════════════════════════════════
  // بطاقة مفتاح واحد — ConfigKeyCard
  // ════════════════════════════════════════════════════════════

  const ConfigKeyCard = ({ config }: { config: SystemConfig }) => {
    const isEmpty = !config.key_value?.trim();
    const isRevealed = revealedKeys.has(config.key_name);
    const catMeta = CATEGORY_META[config.category];
    const CatIcon = catMeta?.icon || KeyRound;

    return (
      <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-md border ${
        isEmpty
          ? "border-yellow-300/60 bg-yellow-50/30 dark:bg-yellow-950/10"
          : "border-border hover:border-primary/30"
      }`}>
        {/* شريط علوي ملوّن */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          isEmpty ? "bg-yellow-400" : "bg-green-500"
        }`} />

        <CardContent className="p-4 pt-5">
          {/* الصف العلوي: أيقونة + اسم المفتاح + badge */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`shrink-0 p-1.5 rounded-md bg-muted/60 ${catMeta?.color || "text-gray-500"}`}>
                <CatIcon className="h-4 w-4" />
              </div>
              <code className="text-[11px] font-mono font-semibold truncate" dir="ltr" title={config.key_name}>
                {config.key_name}
              </code>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {config.is_secret && (
                <ShieldCheck className="h-3.5 w-3.5 text-yellow-500" />
              )}
              {isEmpty ? (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-yellow-600 border-yellow-300 bg-yellow-50">
                  فارغ
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 text-green-600 border-green-300 bg-green-50">
                  مُعبّأ
                </Badge>
              )}
            </div>
          </div>

          {/* الوصف */}
          <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2 min-h-[28px]">
            {config.description || "بدون وصف"}
          </p>

          {/* القيمة */}
          <div className="bg-muted/40 rounded-md px-3 py-2 mb-3 min-h-[36px] flex items-center" dir="ltr">
            {isEmpty ? (
              <span className="text-yellow-500 text-[11px] flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>فارغ — يحتاج تعبئة</span>
              </span>
            ) : config.is_secret && !isRevealed ? (
              <span className="text-[11px] text-muted-foreground font-mono tracking-wider">
                {maskValue(config.key_value)}
              </span>
            ) : (
              <span className="text-[11px] font-mono break-all leading-relaxed">
                {config.key_value}
              </span>
            )}
          </div>

          {/* أزرار الإجراءات */}
          <div className="flex items-center gap-1 justify-end border-t pt-2.5">
            {config.is_secret && !isEmpty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => toggleReveal(config.key_name)}
              >
                {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {isRevealed ? "إخفاء" : "إظهار"}
              </Button>
            )}
            {!isEmpty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => copyToClipboard(config.key_value)}
              >
                <Copy className="h-3 w-3" />
                نسخ
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => openEditDialog(config)}
            >
              <Pencil className="h-3 w-3" />
              تعديل
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
              onClick={() => openDeleteDialog(config)}
            >
              <Trash2 className="h-3 w-3" />
              حذف
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ════════════════════════════════════════════════════════════
  // العرض الرئيسي
  // ════════════════════════════════════════════════════════════

  return (
    <AdminLayout
      title="ران المطور"
      subtitle="مركز إدارة المفاتيح والتوكنات — كل الإعدادات من مكان واحد"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ml-1 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={openAddDialog} className="bg-primary">
            <Plus className="h-4 w-4 ml-1" />
            إضافة مفتاح
          </Button>
        </div>
      }
    >
      {/* ═══════ إحصائيات سريعة ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-primary/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalConfigs}</p>
              <p className="text-[11px] text-muted-foreground">إجمالي المفاتيح</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{filledConfigs}</p>
              <p className="text-[11px] text-muted-foreground">مفاتيح مُعبّأة</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-yellow-200/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{emptyConfigs}</p>
              <p className="text-[11px] text-muted-foreground">مفاتيح فارغة</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200/60">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{secretConfigs}</p>
              <p className="text-[11px] text-muted-foreground">مفاتيح سرية</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ شريط البحث ═══════ */}
      <div className="mb-5">
        <div className="relative max-w-sm">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم المفتاح أو الوصف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-9 text-sm"
          />
        </div>
      </div>

      {/* ═══════ التبويبات + بطاقات المفاتيح ═══════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1.5 mb-6 rounded-xl">
          {CATEGORY_ORDER.map((cat) => {
            const meta = CATEGORY_META[cat];
            if (!meta) return null;
            const Icon = meta.icon;
            const count = configs.filter((c) => c.category === cat).length;
            const filledCount = configs.filter(
              (c) => c.category === cat && c.key_value?.trim()
            ).length;
            // لا تعرض الفئة إذا فارغة تماماً (ما عدا الفئة النشطة)
            if (count === 0 && activeTab !== cat) return null;
            return (
              <TabsTrigger
                key={cat}
                value={cat}
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg data-[state=active]:shadow-sm"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{meta.label}</span>
                {count > 0 && (
                  <Badge
                    variant={filledCount === count ? "default" : "secondary"}
                    className="text-[9px] px-1 py-0 h-3.5 leading-none"
                  >
                    {filledCount}/{count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          if (!meta) return null;
          const catConfigs = getConfigsByCategory(cat);

          return (
            <TabsContent key={cat} value={cat} className="mt-0">
              {/* رأس الفئة */}
              <div className={`rounded-xl border bg-gradient-to-br ${meta.bgGradient} p-4 mb-5`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-white/80 dark:bg-black/20 shadow-sm ${meta.color}`}>
                      <meta.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base">{meta.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-white/60 dark:bg-black/20">
                      {catConfigs.length} مفتاح
                    </Badge>
                    <Button size="sm" variant="outline" className="h-8 text-xs bg-white/60 dark:bg-black/20" onClick={openAddDialog}>
                      <Plus className="h-3.5 w-3.5 ml-1" />
                      إضافة
                    </Button>
                  </div>
                </div>
              </div>

              {/* شبكة البطاقات */}
              {loading ? (
                <div className="text-center py-16">
                  <RefreshCw className="h-7 w-7 animate-spin mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                </div>
              ) : catConfigs.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Code className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm mb-1">
                    {searchQuery ? "لا توجد نتائج للبحث" : "لا توجد مفاتيح في هذه الفئة بعد"}
                  </p>
                  <p className="text-xs mb-4 opacity-70">اضغط "إضافة مفتاح" لإنشاء أول مفتاح</p>
                  <Button variant="outline" size="sm" onClick={openAddDialog}>
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة مفتاح جديد
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {catConfigs.map((config) => (
                    <ConfigKeyCard key={config.id} config={config} />
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* ═══════ حوار الإضافة / التعديل ═══════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingConfig ? (
                <>
                  <Pencil className="h-5 w-5 text-primary" />
                  تعديل الإعداد
                </>
              ) : (
                <>
                  <Plus className="h-5 w-5 text-primary" />
                  إضافة مفتاح جديد
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* الفئة */}
            {!editingConfig && (
              <div>
                <Label className="text-xs font-medium">الفئة</Label>
                <select
                  className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.category || activeTab}
                  onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORY_ORDER.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_META[cat]?.label || cat}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* اسم المفتاح */}
            <div>
              <Label className="text-xs font-medium">اسم المفتاح (KEY_NAME)</Label>
              <Input
                className="mt-1.5 font-mono text-sm"
                placeholder="مثال: WHATSAPP_ACCESS_TOKEN"
                value={formData.key_name}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, key_name: e.target.value.toUpperCase() }))
                }
                disabled={!!editingConfig}
                dir="ltr"
              />
            </div>

            {/* القيمة */}
            <div>
              <Label className="text-xs font-medium">القيمة</Label>
              <Textarea
                className="mt-1.5 font-mono text-xs"
                placeholder="أدخل القيمة هنا..."
                rows={3}
                value={formData.key_value}
                onChange={(e) => setFormData((f) => ({ ...f, key_value: e.target.value }))}
                dir="ltr"
              />
            </div>

            {/* الوصف */}
            <div>
              <Label className="text-xs font-medium">الوصف (اختياري)</Label>
              <Input
                className="mt-1.5"
                placeholder="وصف مختصر للمفتاح..."
                value={formData.description}
                onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* سري؟ */}
            <div className="flex items-center gap-3 bg-muted/40 rounded-lg p-3">
              <Switch
                id="is_secret"
                checked={formData.is_secret}
                onCheckedChange={(checked) =>
                  setFormData((f) => ({ ...f, is_secret: checked }))
                }
              />
              <Label htmlFor="is_secret" className="flex items-center gap-1.5 cursor-pointer text-sm">
                <ShieldCheck className="h-4 w-4 text-yellow-500" />
                مفتاح سري (يُخفى تلقائياً)
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Save className="h-4 w-4 ml-1" />
              )}
              {editingConfig ? "حفظ التعديلات" : "إضافة المفتاح"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════ حوار تأكيد الحذف ═══════ */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              تأكيد الحذف
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              هل أنت متأكد من حذف المفتاح التالي؟
            </p>
            {deletingConfig && (
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                <code className="text-sm text-destructive font-mono font-bold">
                  {deletingConfig.key_name}
                </code>
                {deletingConfig.description && (
                  <p className="text-xs text-muted-foreground mt-1">{deletingConfig.description}</p>
                )}
              </div>
            )}
            <p className="text-xs text-destructive mt-3 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              هذا الإجراء لا يمكن التراجع عنه. تأكد أن المفتاح غير مستخدم في أي Edge Function.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">إلغاء</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? (
                <RefreshCw className="h-4 w-4 animate-spin ml-1" />
              ) : (
                <Trash2 className="h-4 w-4 ml-1" />
              )}
              حذف نهائياً
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDeveloperSettings;
