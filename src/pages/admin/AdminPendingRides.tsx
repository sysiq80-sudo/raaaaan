import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  AlertTriangle, 
  Clock, 
  MapPin, 
  User, 
  Car,
  RefreshCw,
  XCircle,
  CheckCircle,
  Loader2,
  Timer
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PendingRide {
  id: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  created_at: string;
  updated_at: string;
  rider_id: string | null;
  driver_id: string | null;
  vehicle_type: string | null;
  rider?: { full_name: string | null; phone: string | null } | null;
  driver?: { full_name: string | null; phone: string | null } | null;
}

const AdminPendingRides = () => {
  const { loading: authLoading } = useAdminAuth();
  const [rides, setRides] = useState<PendingRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRide, setSelectedRide] = useState<PendingRide | null>(null);
  const [actionType, setActionType] = useState<'cancel' | 'complete' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const fetchPendingRides = async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('rides')
      .select(`
        id,
        status,
        pickup_address,
        dropoff_address,
        estimated_fare,
        created_at,
        updated_at,
        rider_id,
        driver_id,
        vehicle_type
      `)
      .in('status', ['pending', 'accepted', 'arrived', 'in_progress'])
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all' && ['pending', 'accepted', 'arrived', 'in_progress'].includes(statusFilter)) {
      query = supabase
        .from('rides')
        .select(`
          id,
          status,
          pickup_address,
          dropoff_address,
          estimated_fare,
          created_at,
          updated_at,
          rider_id,
          driver_id,
          vehicle_type
        `)
        .eq('status', statusFilter as 'pending' | 'accepted' | 'arrived' | 'in_progress')
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching rides:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب الرحلات",
        variant: "destructive"
      });
    } else {
      // Fetch rider and driver info separately
      const ridesWithInfo = await Promise.all((data || []).map(async (ride) => {
        let riderInfo = null;
        let driverInfo = null;

        if (ride.rider_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('user_id', ride.rider_id)
            .maybeSingle();
          riderInfo = profile;
        }

        if (ride.driver_id) {
          const { data: driver } = await supabase
            .from('drivers')
            .select('full_name, phone')
            .eq('id', ride.driver_id)
            .maybeSingle();
          driverInfo = driver;
        }

        return {
          ...ride,
          rider: riderInfo,
          driver: driverInfo
        };
      }));

      setRides(ridesWithInfo);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading) {
      fetchPendingRides();
    }
  }, [authLoading, statusFilter]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: "بانتظار سائق", variant: "secondary" },
      accepted: { label: "تم القبول", variant: "default" },
      arrived: { label: "السائق وصل", variant: "outline" },
      in_progress: { label: "جاري التنفيذ", variant: "default" }
    };
    
    const config = statusConfig[status] || { label: status, variant: "secondary" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getVehicleTypeName = (type: string | null) => {
    const types: Record<string, string> = {
      economy: "اقتصادي",
      comfort: "مريح",
      premium: "فاخر",
      women_only: "نسائي"
    };
    return types[type || ''] || type || '-';
  };

  const getTimeSince = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) return `منذ ${diffDays} يوم`;
    if (diffHours > 0) return `منذ ${diffHours} ساعة`;
    return `منذ ${diffMins} دقيقة`;
  };

  const isStale = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 1; // Consider stale if older than 1 hour
  };

  const handleCancelRide = async () => {
    if (!selectedRide) return;
    
    setIsProcessing(true);
    
    const { error } = await supabase
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_by: 'admin',
        cancellation_reason: 'تم الإلغاء من قبل الإدارة',
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedRide.id);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في إلغاء الرحلة",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم الإلغاء",
        description: "تم إلغاء الرحلة بنجاح"
      });
      fetchPendingRides();
    }
    
    setIsProcessing(false);
    setSelectedRide(null);
    setActionType(null);
  };

  const handleCompleteRide = async () => {
    if (!selectedRide) return;
    
    setIsProcessing(true);
    
    const { error } = await supabase
      .from('rides')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        final_fare: selectedRide.estimated_fare,
        updated_at: new Date().toISOString()
      })
      .eq('id', selectedRide.id);

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في إكمال الرحلة",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم الإكمال",
        description: "تم إكمال الرحلة بنجاح"
      });
      fetchPendingRides();
    }
    
    setIsProcessing(false);
    setSelectedRide(null);
    setActionType(null);
  };

  const handleCancelAllStale = async () => {
    const staleRides = rides.filter(r => isStale(r.created_at));
    
    if (staleRides.length === 0) {
      toast({
        title: "لا توجد رحلات قديمة",
        description: "جميع الرحلات حديثة"
      });
      return;
    }

    setIsProcessing(true);
    
    const { error } = await supabase
      .from('rides')
      .update({
        status: 'cancelled',
        cancelled_by: 'admin',
        cancellation_reason: 'تم الإلغاء تلقائياً - رحلة قديمة',
        updated_at: new Date().toISOString()
      })
      .in('id', staleRides.map(r => r.id));

    if (error) {
      toast({
        title: "خطأ",
        description: "فشل في إلغاء الرحلات",
        variant: "destructive"
      });
    } else {
      toast({
        title: "تم الإلغاء",
        description: `تم إلغاء ${staleRides.length} رحلة قديمة`
      });
      fetchPendingRides();
    }
    
    setIsProcessing(false);
  };

  const staleCount = rides.filter(r => isStale(r.created_at)).length;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AdminLayout 
      title="إدارة الرحلات المعلقة" 
      subtitle="مراقبة وإدارة الرحلات التي لم تكتمل"
      actions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={fetchPendingRides}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          {staleCount > 0 && (
            <Button 
              variant="destructive"
              onClick={handleCancelAllStale}
              disabled={isProcessing}
            >
              <XCircle className="w-4 h-4 ml-2" />
              إلغاء الرحلات القديمة ({staleCount})
            </Button>
          )}
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المعلقة</p>
                <p className="text-3xl font-bold text-foreground">{rides.length}</p>
              </div>
              <Clock className="w-10 h-10 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">بانتظار سائق</p>
                <p className="text-3xl font-bold text-yellow-500">
                  {rides.filter(r => r.status === 'pending').length}
                </p>
              </div>
              <User className="w-10 h-10 text-yellow-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                <p className="text-3xl font-bold text-blue-500">
                  {rides.filter(r => ['accepted', 'arrived', 'in_progress'].includes(r.status)).length}
                </p>
              </div>
              <Car className="w-10 h-10 text-blue-500/30" />
            </div>
          </CardContent>
        </Card>
        
        <Card className={staleCount > 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">رحلات قديمة (+1 ساعة)</p>
                <p className="text-3xl font-bold text-destructive">{staleCount}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-destructive/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">تصفية حسب الحالة:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">بانتظار سائق</SelectItem>
                <SelectItem value="accepted">تم القبول</SelectItem>
                <SelectItem value="arrived">السائق وصل</SelectItem>
                <SelectItem value="in_progress">جاري التنفيذ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rides Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="w-5 h-5" />
            قائمة الرحلات المعلقة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : rides.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
              <p>لا توجد رحلات معلقة حالياً</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الراكب</TableHead>
                  <TableHead>السائق</TableHead>
                  <TableHead>نوع السيارة</TableHead>
                  <TableHead>الانطلاق</TableHead>
                  <TableHead>الوجهة</TableHead>
                  <TableHead>الأجرة</TableHead>
                  <TableHead>المدة</TableHead>
                  <TableHead>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rides.map((ride) => (
                  <TableRow 
                    key={ride.id}
                    className={isStale(ride.created_at) ? 'bg-destructive/5' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(ride.status)}
                        {isStale(ride.created_at) && (
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{ride.rider?.full_name || 'غير معروف'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ride.driver ? (
                        <div className="flex items-center gap-2">
                          <Car className="w-4 h-4 text-muted-foreground" />
                          <span>{ride.driver.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getVehicleTypeName(ride.vehicle_type)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 max-w-[150px]">
                        <MapPin className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="truncate text-xs">{ride.pickup_address || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 max-w-[150px]">
                        <MapPin className="w-3 h-3 text-red-500 flex-shrink-0" />
                        <span className="truncate text-xs">{ride.dropoff_address || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {ride.estimated_fare ? `${ride.estimated_fare.toLocaleString()} د.ع` : '-'}
                    </TableCell>
                    <TableCell>
                      <span className={isStale(ride.created_at) ? 'text-destructive font-medium' : ''}>
                        {getTimeSince(ride.created_at)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            setSelectedRide(ride);
                            setActionType('cancel');
                          }}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                        {ride.status === 'in_progress' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-600 hover:bg-green-600/10"
                            onClick={() => {
                              setSelectedRide(ride);
                              setActionType('complete');
                            }}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedRide && !!actionType} onOpenChange={() => {
        setSelectedRide(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'cancel' ? 'إلغاء الرحلة' : 'إكمال الرحلة'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'cancel' 
                ? 'هل أنت متأكد من إلغاء هذه الرحلة؟ سيتم إشعار الراكب والسائق.'
                : 'هل أنت متأكد من إكمال هذه الرحلة يدوياً؟'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={actionType === 'cancel' ? handleCancelRide : handleCompleteRide}
              disabled={isProcessing}
              className={actionType === 'cancel' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isProcessing && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              {actionType === 'cancel' ? 'نعم، إلغاء' : 'نعم، إكمال'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminPendingRides;
