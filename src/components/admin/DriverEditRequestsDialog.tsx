import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface EditRequest {
  id: string;
  driver_id: string;
  field_name: string;
  current_value: string | null;
  requested_value: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  driver?: {
    full_name: string;
    phone: string;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "الاسم الكامل",
  phone: "رقم الهاتف",
  email: "البريد الإلكتروني",
  vehicle_model: "موديل السيارة",
  vehicle_color: "لون السيارة",
  vehicle_plate: "رقم اللوحة",
};

export const DriverEditRequestsDialog = ({ open, onOpenChange }: Props) => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open]);

  const fetchRequests = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("driver_edit_requests")
      .select(`
        *,
        driver:drivers(full_name, phone)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching edit requests:", error);
      toast({
        title: "خطأ",
        description: "فشل في جلب طلبات التعديل",
        variant: "destructive",
      });
    } else {
      setRequests(data || []);
    }
    
    setLoading(false);
  };

  const handleApprove = async (request: EditRequest) => {
    setProcessingId(request.id);

    // Update the driver's field
    const updateData: Record<string, string> = {
      [request.field_name]: request.requested_value,
    };

    const { error: updateError } = await supabase
      .from("drivers")
      .update(updateData)
      .eq("id", request.driver_id);

    if (updateError) {
      console.error("Error updating driver:", updateError);
      toast({
        title: "خطأ",
        description: "فشل في تحديث بيانات السائق",
        variant: "destructive",
      });
      setProcessingId(null);
      return;
    }

    // Update request status
    const { error: requestError } = await supabase
      .from("driver_edit_requests")
      .update({
        status: "approved",
        admin_notes: adminNotes[request.id] || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestError) {
      console.error("Error updating request:", requestError);
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الطلب",
        variant: "destructive",
      });
    } else {
      toast({
        title: "تمت الموافقة",
        description: "تم تحديث بيانات السائق بنجاح",
      });
      fetchRequests();
    }

    setProcessingId(null);
  };

  const handleReject = async (request: EditRequest) => {
    if (!adminNotes[request.id]?.trim()) {
      toast({
        title: "ملاحظة مطلوبة",
        description: "يرجى إدخال سبب الرفض",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(request.id);

    const { error } = await supabase
      .from("driver_edit_requests")
      .update({
        status: "rejected",
        admin_notes: adminNotes[request.id],
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (error) {
      console.error("Error rejecting request:", error);
      toast({
        title: "خطأ",
        description: "فشل في رفض الطلب",
        variant: "destructive",
      });
    } else {
      toast({
        title: "تم الرفض",
        description: "تم رفض طلب التعديل",
      });
      fetchRequests();
    }

    setProcessingId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">
            <Clock className="w-3 h-3 ml-1" />
            قيد المراجعة
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
            <CheckCircle className="w-3 h-3 ml-1" />
            تمت الموافقة
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-600 border-red-500/30">
            <XCircle className="w-3 h-3 ml-1" />
            مرفوض
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            طلبات تعديل بيانات السائقين
            {pendingCount > 0 && (
              <Badge className="bg-yellow-500 text-white">{pendingCount} جديد</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            مراجعة وإدارة طلبات تعديل بيانات السائقين
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            لا توجد طلبات تعديل
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>السائق</TableHead>
                <TableHead>الحقل</TableHead>
                <TableHead>القيمة الحالية</TableHead>
                <TableHead>القيمة المطلوبة</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.driver?.full_name}</p>
                      <p className="text-xs text-muted-foreground">{request.driver?.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>{FIELD_LABELS[request.field_name] || request.field_name}</TableCell>
                  <TableCell className="max-w-[100px] truncate">
                    {request.current_value || "-"}
                  </TableCell>
                  <TableCell className="max-w-[100px] truncate font-medium text-primary">
                    {request.requested_value}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">
                    {request.reason || "-"}
                  </TableCell>
                  <TableCell>{getStatusBadge(request.status)}</TableCell>
                  <TableCell>
                    {request.status === "pending" ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="ملاحظات (مطلوبة للرفض)"
                          value={adminNotes[request.id] || ""}
                          onChange={(e) => setAdminNotes(prev => ({
                            ...prev,
                            [request.id]: e.target.value
                          }))}
                          rows={2}
                          className="text-xs"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3 ml-1" />
                            )}
                            موافقة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request)}
                            disabled={processingId === request.id}
                          >
                            {processingId === request.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <XCircle className="w-3 h-3 ml-1" />
                            )}
                            رفض
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {request.admin_notes && (
                          <p>الملاحظات: {request.admin_notes}</p>
                        )}
                        <p>{new Date(request.created_at).toLocaleDateString('ar-IQ')}</p>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
