import { useEffect, useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bug } from "lucide-react";

const ENABLED_KEY = "dev-inspector-enabled";
const SHOW_KEY = "dev-inspector-show";

const readFlag = (key: string, defaultValue = false) => {
  try {
    const v = localStorage.getItem(key);
    if (v === "on") return true;
    if (v === "off") return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
};

const writeFlag = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? "on" : "off");
  } catch {
    // no-op
  }
};

const AdminDevInspector = () => {
  const [enabled, setEnabled] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    setEnabled(readFlag(ENABLED_KEY, false));
    setShowButton(readFlag(SHOW_KEY, false));
  }, []);

  const handleEnabledChange = (next: boolean) => {
    setEnabled(next);
    writeFlag(ENABLED_KEY, next);
    if (!next) {
      setShowButton(false);
      writeFlag(SHOW_KEY, false);
      window.dispatchEvent(new CustomEvent("devInspectorShowToggle", { detail: { show: false } }));
    }
    window.dispatchEvent(new CustomEvent("devInspectorToggle", { detail: { enabled: next } }));
  };

  const handleShowButtonChange = (next: boolean) => {
    setShowButton(next);
    writeFlag(SHOW_KEY, next);
    window.dispatchEvent(new CustomEvent("devInspectorShowToggle", { detail: { show: next } }));
  };

  return (
    <AdminLayout
      title="خريطة المكونات"
      subtitle="نظام فحص مرئي للعناصر في الواجهة مثل صفحة devInspector"
    >
      <div className="max-w-3xl space-y-4" dir="rtl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Dev Inspector
            </CardTitle>
            <CardDescription>
              فعّل النظام ليظهر زر عائم في أسفل يسار الشاشة يمكنك من فحص أي عنصر ومعرفة selector وحجمه وموقعه.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="dev-inspector-enabled" className="text-sm font-medium">تفعيل نظام الفحص</Label>
                <p className="text-xs text-muted-foreground">تشغيل/إيقاف Dev Inspector على مستوى التطبيق</p>
              </div>
              <Switch
                id="dev-inspector-enabled"
                checked={enabled}
                onCheckedChange={handleEnabledChange}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-1">
                <Label htmlFor="dev-inspector-show" className="text-sm font-medium">إظهار الزر العائم</Label>
                <p className="text-xs text-muted-foreground">إظهار/إخفاء زر "فحص الواجهة" في كل الصفحات</p>
              </div>
              <Switch
                id="dev-inspector-show"
                checked={showButton}
                disabled={!enabled}
                onCheckedChange={handleShowButtonChange}
              />
            </div>

            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              الخطوات: فعّل النظام ← فعّل الزر العائم ← انتقل لأي صفحة ← اضغط "فحص الواجهة" ← اضغط على العنصر المطلوب.
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDevInspector;
