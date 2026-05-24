/**
 * ران - لوحة إدارة طرق الدفع
 * Admin Panel لتفعيل/تعطيل وإدارة خيارات الدفع
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  CreditCard, 
  Loader2, 
  Edit, 
  Save, 
  X,
  Eye,
  EyeOff,
  TrendingUp,
  Settings
} from "lucide-react";

interface PaymentMethod {
  id: string;
  method_key: string;
  name_ar: string;
  name_en: string;
  icon_name: string | null;
  is_enabled: boolean;
  is_available_for_riders: boolean;
  is_available_for_drivers: boolean;
  display_order: number;
  processing_fee_percentage: number;
  processing_fee_fixed: number;
  min_amount: number | null;
  max_amount: number | null;
  description_ar: string | null;
  description_en: string | null;
  requires_verification: boolean;
}

export const PaymentMethodsAdmin = () => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const { toast } = useToast();

  // تحميل طرق الدفع
  const fetchMethods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .order("display_order");

      if (error) throw error;
      setMethods(data || []);
    } catch (error: any) {
      toast({
        title: "خطأ في تحميل البيانات",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  // تبديل تفعيل طريقة الدفع
  const toggleEnabled = async (methodId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_enabled: !currentState })
        .eq("id", methodId);

      if (error) throw error;

      setMethods((prev) =>
        prev.map((m) =>
          m.id === methodId ? { ...m, is_enabled: !currentState } : m
        )
      );

      toast({
        title: !currentState ? "✅ تم التفعيل" : "⏸️ تم التعطيل",
        description: !currentState
          ? "طريقة الدفع متاحة الآن للمستخدمين"
          : "طريقة الدفع غير متاحة مؤقتاً",
      });
    } catch (error: any) {
      toast({
        title: "خطأ في التحديث",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // حفظ التعديلات
  const saveChanges = async () => {
    if (!editingMethod) return;

    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({
          name_ar: editingMethod.name_ar,
          name_en: editingMethod.name_en,
          icon_name: editingMethod.icon_name,
          is_available_for_riders: editingMethod.is_available_for_riders,
          is_available_for_drivers: editingMethod.is_available_for_drivers,
          processing_fee_percentage: editingMethod.processing_fee_percentage,
          processing_fee_fixed: editingMethod.processing_fee_fixed,
          min_amount: editingMethod.min_amount,
          max_amount: editingMethod.max_amount,
          description_ar: editingMethod.description_ar,
          requires_verification: editingMethod.requires_verification,
        })
        .eq("id", editingMethod.id);

      if (error) throw error;

      setMethods((prev) =>
        prev.map((m) => (m.id === editingMethod.id ? editingMethod : m))
      );

      toast({
        title: "✅ تم الحفظ",
        description: "تم تحديث طريقة الدفع بنجاح",
      });

      setShowEditDialog(false);
      setEditingMethod(null);
    } catch (error: any) {
      toast({
        title: "خطأ في الحفظ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                إدارة طرق الدفع
              </CardTitle>
              <CardDescription>
                تفعيل وتعطيل وإدارة خيارات الدفع المتاحة للمستخدمين
              </CardDescription>
            </div>
            <Button onClick={fetchMethods} variant="outline" size="sm">
              تحديث
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الطريقة</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">للراكب</TableHead>
                <TableHead className="text-right">للسائق</TableHead>
                <TableHead className="text-right">الرسوم</TableHead>
                <TableHead className="text-right">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{method.icon_name}</span>
                      <div>
                        <p className="font-semibold">{method.name_ar}</p>
                        <p className="text-xs text-muted-foreground">
                          {method.method_key}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={method.is_enabled}
                      onCheckedChange={() =>
                        toggleEnabled(method.id, method.is_enabled)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {method.is_available_for_riders ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {method.is_available_for_drivers ? (
                      <Eye className="w-4 h-4 text-green-500" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell>
                    {method.processing_fee_percentage > 0 ||
                    method.processing_fee_fixed > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <TrendingUp className="w-3 h-3" />
                        {method.processing_fee_percentage > 0 &&
                          `${method.processing_fee_percentage}%`}
                        {method.processing_fee_fixed > 0 &&
                          ` +${method.processing_fee_fixed.toLocaleString()}د`}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">بدون رسوم</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={() => {
                        setEditingMethod(method);
                        setShowEditDialog(true);
                      }}
                      variant="ghost"
                      size="sm"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog للتعديل */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              تعديل طريقة الدفع
            </DialogTitle>
            <DialogDescription>
              تعديل إعدادات {editingMethod?.name_ar}
            </DialogDescription>
          </DialogHeader>

          {editingMethod && (
            <div className="space-y-4">
              {/* الأسماء */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الاسم بالعربي</Label>
                  <Input
                    value={editingMethod.name_ar}
                    onChange={(e) =>
                      setEditingMethod({
                        ...editingMethod,
                        name_ar: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>الاسم بالإنجليزي</Label>
                  <Input
                    value={editingMethod.name_en}
                    onChange={(e) =>
                      setEditingMethod({
                        ...editingMethod,
                        name_en: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* الأيقونة */}
              <div className="space-y-2">
                <Label>الأيقونة (Emoji)</Label>
                <Input
                  value={editingMethod.icon_name || ""}
                  onChange={(e) =>
                    setEditingMethod({
                      ...editingMethod,
                      icon_name: e.target.value,
                    })
                  }
                  placeholder="💵"
                />
              </div>

              {/* التوفر */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <Label>متاح لـ:</Label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={editingMethod.is_available_for_riders}
                      onCheckedChange={(checked) =>
                        setEditingMethod({
                          ...editingMethod,
                          is_available_for_riders: checked,
                        })
                      }
                    />
                    <span>الركاب</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch
                      checked={editingMethod.is_available_for_drivers}
                      onCheckedChange={(checked) =>
                        setEditingMethod({
                          ...editingMethod,
                          is_available_for_drivers: checked,
                        })
                      }
                    />
                    <span>السائقين</span>
                  </label>
                </div>
              </div>

              {/* الرسوم */}
              <div className="space-y-3 p-3 bg-amber-500/5 rounded-lg border border-amber-500/20">
                <Label className="text-amber-600">رسوم المعالجة</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">نسبة مئوية (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingMethod.processing_fee_percentage}
                      onChange={(e) =>
                        setEditingMethod({
                          ...editingMethod,
                          processing_fee_percentage: parseFloat(
                            e.target.value
                          ) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">رسوم ثابتة (د.ع)</Label>
                    <Input
                      type="number"
                      step="100"
                      value={editingMethod.processing_fee_fixed}
                      onChange={(e) =>
                        setEditingMethod({
                          ...editingMethod,
                          processing_fee_fixed: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* الحدود */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>الحد الأدنى (د.ع)</Label>
                  <Input
                    type="number"
                    step="1000"
                    value={editingMethod.min_amount || ""}
                    onChange={(e) =>
                      setEditingMethod({
                        ...editingMethod,
                        min_amount: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="اختياري"
                  />
                </div>
                <div className="space-y-2">
                  <Label>الحد الأقصى (د.ع)</Label>
                  <Input
                    type="number"
                    step="1000"
                    value={editingMethod.max_amount || ""}
                    onChange={(e) =>
                      setEditingMethod({
                        ...editingMethod,
                        max_amount: e.target.value
                          ? parseFloat(e.target.value)
                          : null,
                      })
                    }
                    placeholder="اختياري"
                  />
                </div>
              </div>

              {/* الوصف */}
              <div className="space-y-2">
                <Label>وصف إضافي (عربي)</Label>
                <Textarea
                  value={editingMethod.description_ar || ""}
                  onChange={(e) =>
                    setEditingMethod({
                      ...editingMethod,
                      description_ar: e.target.value,
                    })
                  }
                  rows={2}
                  placeholder="معلومات إضافية للمستخدمين..."
                />
              </div>

              {/* التحقق */}
              <div className="flex items-center gap-2">
                <Switch
                  checked={editingMethod.requires_verification}
                  onCheckedChange={(checked) =>
                    setEditingMethod({
                      ...editingMethod,
                      requires_verification: checked,
                    })
                  }
                />
                <Label>يتطلب تحقق إضافي</Label>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              onClick={() => {
                setShowEditDialog(false);
                setEditingMethod(null);
              }}
              variant="outline"
            >
              <X className="w-4 h-4 ml-2" />
              إلغاء
            </Button>
            <Button onClick={saveChanges}>
              <Save className="w-4 h-4 ml-2" />
              حفظ التغييرات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
