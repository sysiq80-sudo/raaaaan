/**
 * ران - صفحة إدارة الإشعارات الشاملة
 * Admin Notification Management Page
 * 4 تبويبات: إرسال جديد، المجدولة، السجل، الإعدادات التلقائية
 */

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Bell,
  Send,
  Clock,
  History,
  Settings,
  Users,
  Car,
  Megaphone,
  Trophy,
  AlertCircle,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
} from "lucide-react";
import {
  useCampaigns,
  useCreateCampaign,
  useSendCampaign,
  useCancelCampaign,
  useAutoSettings,
  useUpdateAutoSetting,
  useNotificationGroups,
  useCampaignStats,
  type CreateCampaignInput,
  type NotificationCampaign,
} from "@/hooks/useNotificationCampaigns";

// ── مكون إحصائيات الإشعارات ──
function StatsBar() {
  const { data: stats } = useCampaignStats();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{stats?.total || 0}</p>
          <p className="text-xs text-blue-600">إجمالي الحملات</p>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{stats?.sent || 0}</p>
          <p className="text-xs text-green-600">تم إرسالها</p>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{stats?.scheduled || 0}</p>
          <p className="text-xs text-amber-600">مجدولة</p>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-700">
            {stats?.totalDelivered || 0}
          </p>
          <p className="text-xs text-purple-600">إجمالي المستلمين</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── مكون إنشاء حملة إشعار جديدة ──
function CreateCampaignTab() {
  const createCampaign = useCreateCampaign();
  const sendCampaign = useSendCampaign();
  const { data: groups } = useNotificationGroups();

  const [form, setForm] = useState<CreateCampaignInput>({
    title: "",
    body: "",
    target_type: "all",
    notification_type: "custom",
    priority: "normal",
  });
  const [isScheduled, setIsScheduled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSubmit = async (sendNow: boolean) => {
    if (!form.title.trim() || !form.body.trim()) return;

    const campaign = await createCampaign.mutateAsync({
      ...form,
      scheduled_at: isScheduled ? form.scheduled_at : undefined,
    });

    if (sendNow && campaign?.id) {
      await sendCampaign.mutateAsync(campaign.id);
    }

    // Reset form
    setForm({
      title: "",
      body: "",
      target_type: "all",
      notification_type: "custom",
      priority: "normal",
    });
    setIsScheduled(false);
  };

  const isBusy = createCampaign.isPending || sendCampaign.isPending;

  const targetTypeOptions = [
    { value: "all", label: "الجميع (سائقين + ركاب)", icon: Users },
    { value: "all_drivers", label: "جميع السائقين", icon: Car },
    { value: "all_riders", label: "جميع الركاب", icon: Users },
    { value: "group", label: "مجموعة محددة", icon: Users },
  ];

  const notifTypeOptions = [
    { value: "custom", label: "مخصص", icon: Bell },
    { value: "promo", label: "عرض ترويجي", icon: Sparkles },
    { value: "announcement", label: "إعلان", icon: Megaphone },
    { value: "contest", label: "مسابقة", icon: Trophy },
    { value: "system", label: "نظام", icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-blue-500" />
            إنشاء إشعار جديد
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* العنوان والمحتوى */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>عنوان الإشعار *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: عرض خاص! 🎉"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>نوع الإشعار</Label>
              <Select
                value={form.notification_type}
                onValueChange={(v) => setForm({ ...form, notification_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {notifTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>نص الإشعار *</Label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="اكتب نص الإشعار هنا..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-left">
              {form.body.length}/500
            </p>
          </div>

          {/* الاستهداف */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>الجمهور المستهدف</Label>
              <Select
                value={form.target_type}
                onValueChange={(v) => setForm({ ...form, target_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targetTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" />
                        {opt.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.target_type === "group" && (
              <div className="space-y-2">
                <Label>المجموعة</Label>
                <Select
                  value={form.target_group_id || ""}
                  onValueChange={(v) => setForm({ ...form, target_group_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مجموعة" />
                  </SelectTrigger>
                  <SelectContent>
                    {(groups || []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.member_count} عضو)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm({ ...form, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* رابط + صورة */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>رابط الإجراء (اختياري)</Label>
              <Input
                value={form.action_url || ""}
                onChange={(e) => setForm({ ...form, action_url: e.target.value })}
                placeholder="/promo/summer2026"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>رابط صورة (اختياري)</Label>
              <Input
                value={form.image_url || ""}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
          </div>

          {/* جدولة */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
            <Label className="cursor-pointer">جدولة الإرسال لوقت لاحق</Label>
            {isScheduled && (
              <Input
                type="datetime-local"
                className="w-auto mr-auto"
                dir="ltr"
                value={form.scheduled_at || ""}
                onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              />
            )}
          </div>

          {/* أزرار الإرسال */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={() => setPreviewOpen(true)}
              variant="outline"
              disabled={!form.title || !form.body}
            >
              <Eye className="h-4 w-4 ml-2" />
              معاينة
            </Button>

            {isScheduled ? (
              <Button
                onClick={() => handleSubmit(false)}
                disabled={isBusy || !form.title || !form.body || !form.scheduled_at}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Clock className="h-4 w-4 ml-2" />
                )}
                جدولة الإشعار
              </Button>
            ) : (
              <Button
                onClick={() => handleSubmit(true)}
                disabled={isBusy || !form.title || !form.body}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 ml-2" />
                )}
                إرسال الآن
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* معاينة الإشعار */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>معاينة الإشعار</DialogTitle>
          </DialogHeader>
          <div className="bg-gray-900 text-white rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <Bell className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">ران</p>
                <p className="text-xs text-gray-400">الآن</p>
              </div>
            </div>
            <p className="font-bold text-sm">{form.title || "عنوان الإشعار"}</p>
            <p className="text-sm text-gray-300">{form.body || "نص الإشعار"}</p>
            {form.image_url && (
              <img
                src={form.image_url}
                alt="preview"
                className="w-full h-32 object-cover rounded-lg"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── مكون الحملات المجدولة ──
function ScheduledTab() {
  const { data: campaigns, isLoading } = useCampaigns("scheduled");
  const cancelCampaign = useCancelCampaign();
  const sendCampaign = useSendCampaign();

  if (isLoading) return <LoadingSpinner />;

  if (!campaigns?.length) {
    return (
      <EmptyState
        icon={Clock}
        text="لا توجد إشعارات مجدولة"
        subText="أنشئ إشعاراً مجدولاً من تبويب 'إرسال جديد'"
      />
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => (
        <CampaignCard
          key={c.id}
          campaign={c}
          onCancel={() => cancelCampaign.mutate(c.id)}
          onSendNow={() => sendCampaign.mutate(c.id)}
        />
      ))}
    </div>
  );
}

// ── مكون سجل الإشعارات ──
function HistoryTab() {
  const [filter, setFilter] = useState("all");
  const { data: campaigns, isLoading } = useCampaigns(filter);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "الكل" },
          { value: "sent", label: "مرسلة" },
          { value: "failed", label: "فاشلة" },
          { value: "cancelled", label: "ملغاة" },
          { value: "draft", label: "مسودات" },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {!campaigns?.length ? (
        <EmptyState icon={History} text="لا توجد حملات" />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── مكون إعدادات الإشعارات التلقائية ──
function AutoSettingsTab() {
  const { data: settings, isLoading } = useAutoSettings();
  const updateSetting = useUpdateAutoSetting();

  if (isLoading) return <LoadingSpinner />;

  const settingLabels: Record<string, string> = {
    ride_accepted: "قبول الرحلة (إشعار الراكب)",
    ride_arrived: "وصول السائق (إشعار الراكب)",
    ride_started: "بدء الرحلة (إشعار الراكب)",
    ride_completed: "إتمام الرحلة (إشعار الراكب)",
    ride_cancelled: "إلغاء الرحلة (إشعار الراكب)",
    ride_cancelled_driver: "إلغاء الرحلة (إشعار السائق)",
    ride_completed_driver: "إتمام الرحلة (إشعار السائق)",
    new_ride_broadcast: "بث رحلة جديدة للسائقين",
    driver_approved: "الموافقة على السائق",
    driver_suspended: "إيقاف السائق",
  };

  const roleLabels: Record<string, string> = {
    rider: "الراكب",
    driver: "السائق",
    both: "الجميع",
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-gray-500" />
            إعدادات الإشعارات التلقائية
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            تحكم بنصوص وحالة الإشعارات التي تُرسل تلقائياً عند أحداث النظام
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {(settings || []).map((s) => (
            <div
              key={s.id}
              className="border rounded-lg p-4 space-y-3 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={s.is_enabled}
                    onCheckedChange={(checked) =>
                      updateSetting.mutate({ id: s.id, is_enabled: checked })
                    }
                  />
                  <div>
                    <p className="font-medium">
                      {settingLabels[s.id] || s.id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      يُستهدف: {roleLabels[s.target_role] || s.target_role}
                    </p>
                  </div>
                </div>
                <Badge variant={s.is_enabled ? "default" : "secondary"}>
                  {s.is_enabled ? "مفعّل" : "معطّل"}
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">العنوان</Label>
                  <Input
                    defaultValue={s.title_template}
                    onBlur={(e) => {
                      if (e.target.value !== s.title_template) {
                        updateSetting.mutate({
                          id: s.id,
                          title_template: e.target.value,
                        });
                      }
                    }}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">النص</Label>
                  <Input
                    defaultValue={s.body_template}
                    onBlur={(e) => {
                      if (e.target.value !== s.body_template) {
                        updateSetting.mutate({
                          id: s.id,
                          body_template: e.target.value,
                        });
                      }
                    }}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── مكونات مساعدة ──

function CampaignCard({
  campaign: c,
  onCancel,
  onSendNow,
}: {
  campaign: NotificationCampaign;
  onCancel?: () => void;
  onSendNow?: () => void;
}) {
  const statusConfig: Record<
    string,
    { label: string; color: string; icon: typeof CheckCircle }
  > = {
    draft: { label: "مسودة", color: "bg-gray-100 text-gray-700", icon: Bell },
    scheduled: {
      label: "مجدول",
      color: "bg-amber-100 text-amber-700",
      icon: Clock,
    },
    sending: {
      label: "جاري الإرسال",
      color: "bg-blue-100 text-blue-700",
      icon: Loader2,
    },
    sent: {
      label: "تم الإرسال",
      color: "bg-green-100 text-green-700",
      icon: CheckCircle,
    },
    failed: {
      label: "فشل",
      color: "bg-red-100 text-red-700",
      icon: XCircle,
    },
    cancelled: {
      label: "ملغاة",
      color: "bg-gray-100 text-gray-500",
      icon: XCircle,
    },
  };

  const typeLabels: Record<string, string> = {
    promo: "ترويجي",
    announcement: "إعلان",
    contest: "مسابقة",
    system: "نظام",
    custom: "مخصص",
  };

  const targetLabels: Record<string, string> = {
    all: "الجميع",
    all_drivers: "السائقين",
    all_riders: "الركاب",
    group: "مجموعة",
    individual: "فردي",
  };

  const s = statusConfig[c.status] || statusConfig.draft;
  const StatusIcon = s.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{c.title}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${s.color}`}>
                <StatusIcon className="h-3 w-3 inline ml-1" />
                {s.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {c.body}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span>{typeLabels[c.notification_type] || c.notification_type}</span>
              <span>•</span>
              <span>{targetLabels[c.target_type] || c.target_type}</span>
              {c.sent_count > 0 && (
                <>
                  <span>•</span>
                  <span className="text-green-600">
                    {c.sent_count} مستلم
                  </span>
                </>
              )}
              {c.failed_count > 0 && (
                <>
                  <span>•</span>
                  <span className="text-red-600">
                    {c.failed_count} فاشل
                  </span>
                </>
              )}
              <span>•</span>
              <span>
                {new Date(c.created_at).toLocaleDateString("ar-IQ", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mr-2">
            {c.status === "scheduled" && onSendNow && (
              <Button size="sm" variant="outline" onClick={onSendNow}>
                <Send className="h-3 w-3 ml-1" />
                أرسل الآن
              </Button>
            )}
            {(c.status === "scheduled" || c.status === "draft") && onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                <XCircle className="h-3 w-3 ml-1" />
                إلغاء
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  subText,
}: {
  icon: typeof Bell;
  text: string;
  subText?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <p className="text-muted-foreground">{text}</p>
      {subText && (
        <p className="text-sm text-muted-foreground/70 mt-1">{subText}</p>
      )}
    </div>
  );
}

// ── الصفحة الرئيسية ──
const AdminNotifications = () => {
  return (
    <AdminLayout title="إدارة الإشعارات">
      <div className="p-4 md:p-6 max-w-5xl mx-auto" dir="rtl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-blue-500" />
            إدارة الإشعارات
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            أرسل إشعارات مخصصة ومجدولة وتحكم بالإشعارات التلقائية
          </p>
        </div>

        <StatsBar />

        <Tabs defaultValue="send" dir="rtl">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="send" className="gap-1">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">إرسال جديد</span>
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">المجدولة</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">السجل</span>
            </TabsTrigger>
            <TabsTrigger value="auto" className="gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">تلقائية</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send">
            <CreateCampaignTab />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledTab />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>

          <TabsContent value="auto">
            <AutoSettingsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminNotifications;
