import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import RiderPageHeader from "@/components/rider/RiderPageHeader";
import { Loader2, User, Phone, Mail, CheckCircle2, AlertCircle } from "lucide-react";

type ProfileData = {
  full_name: string;
  phone: string;
  email: string;
};

const RiderProfileMigratedPage: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    phone: "",
    email: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMsg("تعذر جلب بيانات المستخدم الحالي.");
      setLoading(false);
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilesTable = supabase.from("profiles") as any;

    const { data, error } = await profilesTable
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      setErrorMsg("فشل تحميل الملف الشخصي.");
      setLoading(false);
      return;
    }

    const profileRow = data as { full_name?: string | null; phone?: string | null; email?: string | null } | null;

    setProfile({
      full_name: profileRow?.full_name || "",
      phone: profileRow?.phone || "",
      email: profileRow?.email || user.email || "",
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setErrorMsg("تعذر التحقق من المستخدم.");
      setSaving(false);
      return;
    }

    const updatePayload = {
      full_name: profile.full_name.trim(),
      phone: profile.phone.trim(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profilesTable = supabase.from("profiles") as any;

    const { error } = await profilesTable
      .update(updatePayload)
      .eq("user_id", user.id);

    if (error) {
      setErrorMsg("فشل حفظ التعديلات.");
    } else {
      setSuccessMsg("تم تحديث بيانات الملف الشخصي بنجاح.");
    }

    setSaving(false);
  };

  return (
    <div className="min-h-full bg-background" dir="rtl">
      <RiderPageHeader title="الملف الشخصي (نسخة React)" />

      <div className="pt-16 p-4 md:p-6 max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <User className="h-5 w-5" />
              إدارة الحساب
            </CardTitle>
            <CardDescription>
              هذه الصفحة مهاجرة من منطق الموبايل إلى واجهة React Web.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                جاري تحميل البيانات...
              </div>
            ) : (
              <>
                {errorMsg && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>خطأ</AlertTitle>
                    <AlertDescription>{errorMsg}</AlertDescription>
                  </Alert>
                )}

                {successMsg && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>تم</AlertTitle>
                    <AlertDescription>{successMsg}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="full_name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    الاسم الكامل
                  </Label>
                  <Input
                    id="full_name"
                    value={profile.full_name}
                    onChange={(e) => setProfile((prev) => ({ ...prev, full_name: e.target.value }))}
                    placeholder="أدخل الاسم الكامل"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    رقم الهاتف
                  </Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="07xxxxxxxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    البريد الإلكتروني
                  </Label>
                  <Input id="email" value={profile.email} disabled />
                </div>

                <div className="pt-2">
                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        جاري الحفظ...
                      </span>
                    ) : (
                      "حفظ التغييرات"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RiderProfileMigratedPage;
