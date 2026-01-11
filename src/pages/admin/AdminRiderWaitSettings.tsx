import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRiderWaitSettings } from "@/hooks/useRiderWaitSettings";
import {
  Clock,
  MessageSquare,
  AlertTriangle,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  ArrowLeft,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchMessage {
  text: string;
  icon: string;
}

export default function AdminRiderWaitSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: settings, isLoading, refetch } = useRiderWaitSettings();

  const [maxWaitMinutes, setMaxWaitMinutes] = useState(10);
  const [searchMessages, setSearchMessages] = useState<SearchMessage[]>([]);
  const [warningMessage, setWarningMessage] = useState("");
  const [warningThreshold, setWarningThreshold] = useState(0.8);
  const [autoCancelEnabled, setAutoCancelEnabled] = useState(true);
  const [autoCancelMessage, setAutoCancelMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // Load settings when available
  useEffect(() => {
    if (settings) {
      setMaxWaitMinutes(settings.max_wait_minutes);
      setSearchMessages(settings.search_messages);
      setWarningMessage(settings.warning_message);
      setWarningThreshold(settings.warning_threshold);
      setAutoCancelEnabled(settings.auto_cancel_enabled);
      setAutoCancelMessage(settings.auto_cancel_message);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("rider_wait_settings")
        .update({
          max_wait_minutes: maxWaitMinutes,
          search_messages: searchMessages,
          warning_message: warningMessage,
          warning_threshold: warningThreshold,
          auto_cancel_enabled: autoCancelEnabled,
          auto_cancel_message: autoCancelMessage,
        })
        .eq("id", "00000000-0000-0000-0000-000000000001");

      if (error) throw error;

      toast({
        title: "✅ تم الحفظ بنجاح",
        description: "تم تحديث إعدادات انتظار الراكب",
      });

      refetch();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "خطأ",
        description: "فشل حفظ الإعدادات",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addSearchMessage = () => {
    setSearchMessages([
      ...searchMessages,
      { text: "رسالة جديدة...", icon: "🔔" },
    ]);
  };

  const updateSearchMessage = (
    index: number,
    field: "text" | "icon",
    value: string
  ) => {
    const updated = [...searchMessages];
    updated[index][field] = value;
    setSearchMessages(updated);
  };

  const deleteSearchMessage = (index: number) => {
    setSearchMessages(searchMessages.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">إعدادات انتظار الراكب</h1>
            <p className="text-muted-foreground">
              التحكم في الرسائل والمُهل الزمنية أثناء البحث عن سائق
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ التغييرات
          </Button>
        </div>

        {/* Max Wait Time */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              وقت الانتظار الأقصى
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>المدة بالدقائق</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={maxWaitMinutes}
                  onChange={(e) =>
                    setMaxWaitMinutes(parseInt(e.target.value) || 10)
                  }
                  className="max-w-xs"
                />
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  {maxWaitMinutes}:00 دقيقة
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                الوقت الأقصى قبل الإلغاء التلقائي للطلب
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Auto Cancel Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              إعدادات الإلغاء التلقائي
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>تفعيل الإلغاء التلقائي</Label>
                <p className="text-sm text-muted-foreground">
                  إلغاء الطلب تلقائياً عند انتهاء المهلة
                </p>
              </div>
              <Switch
                checked={autoCancelEnabled}
                onCheckedChange={setAutoCancelEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label>رسالة الإلغاء التلقائي</Label>
              <Textarea
                value={autoCancelMessage}
                onChange={(e) => setAutoCancelMessage(e.target.value)}
                placeholder="الرسالة التي تظهر عند الإلغاء التلقائي"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>
                عتبة التحذير ({Math.round(warningThreshold * 100)}%)
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min="0.5"
                  max="0.95"
                  step="0.05"
                  value={warningThreshold}
                  onChange={(e) =>
                    setWarningThreshold(parseFloat(e.target.value) || 0.8)
                  }
                  className="max-w-xs"
                />
                <Badge variant="outline">
                  يظهر التحذير عند{" "}
                  {Math.round(maxWaitMinutes * warningThreshold)} دقيقة
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                نسبة الوقت المنقضي لإظهار رسالة التحذير
              </p>
            </div>

            <div className="space-y-2">
              <Label>رسالة التحذير</Label>
              <Input
                value={warningMessage}
                onChange={(e) => setWarningMessage(e.target.value)}
                placeholder="⚠️ سيتم الإلغاء التلقائي قريباً"
              />
            </div>
          </CardContent>
        </Card>

        {/* Search Messages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                رسائل البحث التشجيعية
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={addSearchMessage}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                إضافة رسالة
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              الرسائل التي تظهر للراكب أثناء البحث عن سائق (تتناوب كل 5 ثواني)
            </p>

            {searchMessages.map((message, index) => (
              <Card key={index} className="border-2">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">#{index + 1}</Badge>
                        <Input
                          value={message.icon}
                          onChange={(e) =>
                            updateSearchMessage(index, "icon", e.target.value)
                          }
                          placeholder="🔍"
                          className="w-20 text-center text-2xl"
                        />
                      </div>
                      <Textarea
                        value={message.text}
                        onChange={(e) =>
                          updateSearchMessage(index, "text", e.target.value)
                        }
                        placeholder="النص التشجيعي..."
                        rows={2}
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteSearchMessage(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {searchMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد رسائل. انقر "إضافة رسالة" لإضافة رسالة جديدة.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>معاينة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-accent/50 p-6 rounded-lg space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="text-4xl animate-pulse">
                  {searchMessages[0]?.icon || "🔍"}
                </div>
                <p className="text-lg font-medium">
                  {searchMessages[0]?.text || "جاري البحث..."}
                </p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>وقت الانتظار</span>
                <span className="font-mono font-bold">
                  {Math.floor(maxWaitMinutes * warningThreshold)}:00 /{" "}
                  {maxWaitMinutes}:00
                </span>
              </div>

              {autoCancelEnabled && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
                  <p className="text-sm text-orange-600 font-medium">
                    {warningMessage}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
