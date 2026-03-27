import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Trash2, MapPin, Car, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Json } from "@/integrations/supabase/types";

interface FakeDriver {
  id: string;
  name: string;
  vehicle_type: string;
  location: Json;
  rating: number;
  vehicle_model: string;
  vehicle_color: string;
  is_active: boolean;
}

const AdminDriverVisibility = () => {
  const queryClient = useQueryClient();
  const [showRealDrivers, setShowRealDrivers] = useState(false);
  const [showFakeDrivers, setShowFakeDrivers] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDriver, setNewDriver] = useState({
    name: "سائق",
    vehicle_type: "economy",
    lat: 33.3152,
    lng: 44.3661,
    rating: 4.8,
    vehicle_model: "تويوتا كورولا",
    vehicle_color: "أبيض"
  });

  // Fetch settings
  const { data: settings } = useQuery({
    queryKey: ['driver-visibility-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['show_drivers_to_riders', 'show_fake_drivers']);
      
      if (error) throw error;
      
      const settingsMap: Record<string, boolean> = {};
      data?.forEach(s => {
        settingsMap[s.key] = s.value === true || s.value === 'true';
      });
      return settingsMap;
    }
  });

  // Fetch fake drivers
  const { data: fakeDrivers = [] } = useQuery({
    queryKey: ['fake-drivers'],
    queryFn: async (): Promise<FakeDriver[]> => {
      const { data, error } = await supabase
        .from('fake_drivers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (settings) {
      setShowRealDrivers(settings['show_drivers_to_riders'] || false);
      setShowFakeDrivers(settings['show_fake_drivers'] || false);
    }
  }, [settings]);

  // Update settings mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase
        .from('app_settings')
        .update({ value: value, updated_at: new Date().toISOString() })
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-visibility-settings'] });
      toast.success('تم تحديث الإعداد');
    },
    onError: () => {
      toast.error('فشل تحديث الإعداد');
    }
  });

  // Add fake driver mutation
  const addFakeDriverMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('fake_drivers')
        .insert({
          name: newDriver.name,
          vehicle_type: newDriver.vehicle_type as any,
          location: { lat: newDriver.lat, lng: newDriver.lng },
          rating: newDriver.rating,
          vehicle_model: newDriver.vehicle_model,
          vehicle_color: newDriver.vehicle_color,
          is_active: true
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fake-drivers'] });
      setIsAddDialogOpen(false);
      toast.success('تم إضافة السائق الوهمي');
      setNewDriver({
        name: "سائق",
        vehicle_type: "economy",
        lat: 33.3152,
        lng: 44.3661,
        rating: 4.8,
        vehicle_model: "تويوتا كورولا",
        vehicle_color: "أبيض"
      });
    },
    onError: () => {
      toast.error('فشل إضافة السائق');
    }
  });

  // Toggle fake driver active status
  const toggleFakeDriverMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('fake_drivers')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fake-drivers'] });
      toast.success('تم تحديث حالة السائق');
    }
  });

  // Delete fake driver mutation
  const deleteFakeDriverMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('fake_drivers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fake-drivers'] });
      toast.success('تم حذف السائق');
    }
  });

  const handleToggleRealDrivers = (checked: boolean) => {
    setShowRealDrivers(checked);
    updateSettingMutation.mutate({ key: 'show_drivers_to_riders', value: checked });
  };

  const handleToggleFakeDrivers = (checked: boolean) => {
    setShowFakeDrivers(checked);
    updateSettingMutation.mutate({ key: 'show_fake_drivers', value: checked });
  };

  return (
    <AdminLayout title="إدارة ظهور السائقين" subtitle="تحكم في ظهور السائقين على خريطة الراكب">
      <div className="space-y-6">

        {/* Settings Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                السائقين الحقيقيين
              </CardTitle>
              <CardDescription>
                إظهار السائقين الحقيقيين المتصلين على خريطة الراكب
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showRealDrivers ? (
                    <Eye className="h-5 w-5 text-green-500" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <Label>{showRealDrivers ? 'ظاهر' : 'مخفي'}</Label>
                </div>
                <Switch
                  checked={showRealDrivers}
                  onCheckedChange={handleToggleRealDrivers}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                السائقين الوهميين
              </CardTitle>
              <CardDescription>
                إظهار السائقين الوهميين على خريطة الراكب
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {showFakeDrivers ? (
                    <Eye className="h-5 w-5 text-green-500" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  )}
                  <Label>{showFakeDrivers ? 'ظاهر' : 'مخفي'}</Label>
                </div>
                <Switch
                  checked={showFakeDrivers}
                  onCheckedChange={handleToggleFakeDrivers}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fake Drivers Management */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>السائقين الوهميين</CardTitle>
              <CardDescription>إضافة وإدارة السائقين الوهميين للعرض على الخريطة</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة سائق
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إضافة سائق وهمي</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Label>الاسم</Label>
                    <Input
                      value={newDriver.name}
                      onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>نوع السيارة</Label>
                    <Select
                      value={newDriver.vehicle_type}
                      onValueChange={(value) => setNewDriver({ ...newDriver, vehicle_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="economy">اقتصادي</SelectItem>
                        <SelectItem value="comfort">مريح</SelectItem>
                        <SelectItem value="premium">فاخر</SelectItem>
                        <SelectItem value="women_only">نسائي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>خط العرض (Lat)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={newDriver.lat}
                        onChange={(e) => setNewDriver({ ...newDriver, lat: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>خط الطول (Lng)</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={newDriver.lng}
                        onChange={(e) => setNewDriver({ ...newDriver, lng: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>موديل السيارة</Label>
                    <Input
                      value={newDriver.vehicle_model}
                      onChange={(e) => setNewDriver({ ...newDriver, vehicle_model: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>لون السيارة</Label>
                    <Input
                      value={newDriver.vehicle_color}
                      onChange={(e) => setNewDriver({ ...newDriver, vehicle_color: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>التقييم</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={newDriver.rating}
                      onChange={(e) => setNewDriver({ ...newDriver, rating: parseFloat(e.target.value) })}
                    />
                  </div>
                  <Button onClick={() => addFakeDriverMutation.mutate()} className="w-full">
                    إضافة
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {fakeDrivers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                لا يوجد سائقين وهميين. اضغط على "إضافة سائق" لإنشاء واحد.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الاسم</TableHead>
                    <TableHead>نوع السيارة</TableHead>
                    <TableHead>الموقع</TableHead>
                    <TableHead>التقييم</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fakeDrivers.map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>{driver.name}</TableCell>
                      <TableCell>
                        {driver.vehicle_type === 'economy' ? 'اقتصادي' :
                         driver.vehicle_type === 'comfort' ? 'مريح' :
                         driver.vehicle_type === 'premium' ? 'فاخر' : 'نسائي'}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />
                        {(driver.location as any)?.lat?.toFixed(4)}, {(driver.location as any)?.lng?.toFixed(4)}</span>
                      </TableCell>
                      <TableCell>⭐ {driver.rating}</TableCell>
                      <TableCell>
                        <Switch
                          checked={driver.is_active}
                          onCheckedChange={(checked) => 
                            toggleFakeDriverMutation.mutate({ id: driver.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteFakeDriverMutation.mutate(driver.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDriverVisibility;
