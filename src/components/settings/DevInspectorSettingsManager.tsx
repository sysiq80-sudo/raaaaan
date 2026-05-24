import { useEffect, useState } from "react";
import { Bug, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const ENABLED_KEY = "dev-inspector-enabled";
const SHOW_KEY = "dev-inspector-show";

const readFlag = (key: string, defaultValue = false) => {
  try {
    const value = localStorage.getItem(key);
    if (value === "on") return true;
    if (value === "off") return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
};

const writeFlag = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? "on" : "off");
  } catch {
    // ignore storage failures
  }
};

export function DevInspectorSettingsManager() {
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
    <div className="space-y-4" dir="rtl">
      <Card data-dev-inspector="true">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            خريطة المكونات المرئية
          </CardTitle>
          <CardDescription>
            تم استيراد نظام Dev Inspector الأحدث من W PRO مع دعم الفحص عبر النقر الأيمن، تحديد المجموعة، التحكم بالعمق، والزر العائم القابل للسحب.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="dev-inspector-enabled" className="text-sm font-medium">تفعيل نظام الفحص</Label>
              <p className="text-xs text-muted-foreground">تشغيل أو إيقاف محرك خريطة المكونات على مستوى التطبيق</p>
            </div>
            <Switch id="dev-inspector-enabled" checked={enabled} onCheckedChange={handleEnabledChange} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <Label htmlFor="dev-inspector-show" className="text-sm font-medium">إظهار الزر العائم</Label>
              <p className="text-xs text-muted-foreground">إظهار أو إخفاء زر خريطة المكونات في جميع الصفحات</p>
            </div>
            <Switch id="dev-inspector-show" checked={showButton} disabled={!enabled} onCheckedChange={handleShowButtonChange} />
          </div>
        </CardContent>
      </Card>

      <Card data-dev-inspector="true">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bug className="h-4 w-4" />
            طريقة الاستخدام
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. فعّل النظام ثم فعّل الزر العائم.</p>
          <p>2. انتقل لأي صفحة في التطبيق.</p>
          <p>3. استخدم النقر الأيمن على العنصر لإظهار لوحة الفحص.</p>
          <p>4. استخدم Shift + Right Click لتحديد المجموعة الأب.</p>
          <p>5. استخدم Alt + عجلة الماوس للصعود في عمق الشجرة.</p>
          <p>6. استخدم Ctrl + Shift + D للتفعيل أو الإيقاف السريع.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default DevInspectorSettingsManager;
