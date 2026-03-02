/**
 * صفحة إدارة الشكاوى - Admin Complaints
 * لوحة شاملة لمراجعة وحل الشكاوى
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  MessageSquare,
  MapPin,
  DollarSign,
  Loader2,
  Eye,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface Complaint {
  id: string;
  ride_id: string;
  complainant_type: 'rider' | 'driver';
  complaint_type: string;
  title: string;
  description: string;
  evidence_urls: string[] | null;
  priority: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  resolution_notes: string | null;
  financial_decision: string | null;
  rides: {
    id: string;
    final_fare: number;
    rider_id: string;
    driver_id: string;
    pickup_address: string;
    dropoff_address: string;
    profiles: {
      full_name: string;
      phone: string;
    };
  };
}

const AdminComplaints = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [financialDecision, setFinancialDecision] = useState<string>("");
  const [resolving, setResolving] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  useAdminAuth();

  useEffect(() => {
    fetchComplaints();
  }, [activeTab]);

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      // @ts-expect-error - Table will be created by migration
      const { data, error } = await supabase
        .from('ride_complaints')
        .select(`
          *,
          rides!inner (
            id,
            final_fare,
            rider_id,
            driver_id,
            pickup_address,
            dropoff_address,
            profiles!rides_rider_id_fkey (
              full_name,
              phone
            )
          )
        `)
        .eq('status', activeTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // @ts-expect-error - Type will match after migration
      setComplaints(data || []);
    } catch (error: any) {
      console.error('Error fetching complaints:', error);
      toast({
        title: "خطأ في التحميل",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return colors[priority as keyof typeof colors] || "bg-gray-500";
  };

  const getComplaintTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ride_not_ended: "لم تنته الرحلة",
      wrong_fare: "مبلغ خاطئ",
      inappropriate_behavior: "سلوك غير لائق",
      wrong_route: "مسار خاطئ",
      excessive_delay: "تأخير كبير",
      unjustified_cancellation: "إلغاء تعسفي",
      fraud: "احتيال",
      other: "أخرى",
    };
    return labels[type] || type;
  };

  const handleResolve = async () => {
    if (!selectedComplaint || !financialDecision || !resolutionNotes.trim()) {
      toast({
        title: "معلومات ناقصة",
        description: "يرجى اختيار القرار المالي وكتابة ملاحظات",
        variant: "destructive",
      });
      return;
    }

    if (resolutionNotes.length < 20) {
      toast({
        title: "ملاحظات قصيرة",
        description: "يرجى كتابة تبرير مفصل (20 حرف على الأقل)",
        variant: "destructive",
      });
      return;
    }

    setResolving(true);

    try {
      // تنفيذ القرار المالي
      // @ts-expect-error - Function will be created by migration
      const { data: result, error: execError } = await supabase
        .rpc('execute_financial_decision', {
          p_complaint_id: selectedComplaint.id,
          p_decision_type: financialDecision,
          p_reason: resolutionNotes
        });

      if (execError) throw execError;

      const resultObj = result as { success: boolean; error?: string };
      if (!resultObj.success) {
        throw new Error(resultObj.error || 'فشل تنفيذ القرار');
      }

      toast({
        title: "✅ تم حل الشكوى",
        description: "تم تنفيذ القرار المالي وإشعار الأطراف",
      });

      setShowResolveDialog(false);
      setSelectedComplaint(null);
      setResolutionNotes("");
      setFinancialDecision("");
      fetchComplaints();

    } catch (error: any) {
      console.error('Error resolving complaint:', error);
      toast({
        title: "خطأ في التنفيذ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResolving(false);
    }
  };

  const handleReject = async (complaintId: string) => {
    try {
      // @ts-expect-error - Table will be created by migration
      const { error } = await supabase
        .from('ride_complaints')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          resolution_notes: 'تم رفض الشكوى بعد المراجعة'
        })
        .eq('id', complaintId);

      if (error) throw error;

      toast({
        title: "تم رفض الشكوى",
      });

      fetchComplaints();
    } catch (error: any) {
      toast({
        title: "خطأ",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const ComplaintCard = ({ complaint }: { complaint: Complaint }) => {
    const isOldPending = 
      complaint.status === 'pending' && 
      Date.now() - new Date(complaint.created_at).getTime() > 24 * 60 * 60 * 1000;

    return (
      <Card className={`${isOldPending ? 'border-red-500 border-2' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={getPriorityColor(complaint.priority)}>
                  {complaint.priority}
                </Badge>
                <Badge variant="outline">
                  {complaint.complainant_type === 'rider' ? 'راكب' : 'سائق'}
                </Badge>
                {isOldPending && (
                  <Badge variant="destructive" className="animate-pulse">
                    +24 ساعة
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg">{complaint.title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                رقم الرحلة: {complaint.ride_id.substring(0, 8)}
              </p>
            </div>
            <div className="text-left text-sm text-muted-foreground">
              <Clock className="w-4 h-4 inline ml-1" />
              {formatDistanceToNow(new Date(complaint.created_at), {
                addSuffix: true,
                locale: ar,
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">النوع:</p>
            <p className="text-sm text-muted-foreground">
              {getComplaintTypeLabel(complaint.complaint_type)}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">الوصف:</p>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {complaint.description}
            </p>
          </div>

          {complaint.evidence_urls && complaint.evidence_urls.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-1 flex items-center gap-1">
                <ImageIcon className="w-4 h-4" />
                أدلة ({complaint.evidence_urls.length})
              </p>
            </div>
          )}

          <div className="pt-2 flex gap-2">
            <Button
              onClick={() => {
                setSelectedComplaint(complaint);
                setShowResolveDialog(true);
              }}
              size="sm"
              className="flex-1"
            >
              <Eye className="w-4 h-4 ml-1" />
              مراجعة وحل
            </Button>
            {complaint.status === 'pending' && (
              <Button
                onClick={() => handleReject(complaint.id)}
                variant="destructive"
                size="sm"
              >
                رفض
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout title="إدارة الشكاوى" subtitle="مراجعة وحل شكاوى الرحلات">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">إدارة الشكاوى</h1>
          <p className="text-muted-foreground">
            مراجعة وحل شكاوى الرحلات مع القرارات المالية
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending" className="relative">
              معلقة
              {complaints.filter(c => c.status === 'pending').length > 0 && (
                <Badge className="mr-2 bg-red-500 text-white">
                  {complaints.filter(c => c.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="under_review">قيد المراجعة</TabsTrigger>
            <TabsTrigger value="resolved">محلولة</TabsTrigger>
            <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : complaints.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    لا توجد شكاوى {activeTab === 'pending' ? 'معلقة' : activeTab === 'under_review' ? 'قيد المراجعة' : activeTab === 'resolved' ? 'محلولة' : 'مرفوضة'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {complaints.map((complaint) => (
                  <ComplaintCard key={complaint.id} complaint={complaint} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog الحل */}
      <Dialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <DialogTitle>حل الشكوى</DialogTitle>
                <DialogDescription>
                  مراجعة الشكوى واتخاذ القرار المناسب
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* تفاصيل الشكوى */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">تفاصيل الشكوى</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="font-medium">النوع:</span>
                        <p className="text-muted-foreground">
                          {getComplaintTypeLabel(selectedComplaint.complaint_type)}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">المُشتكي:</span>
                        <p className="text-muted-foreground">
                          {selectedComplaint.complainant_type === 'rider' ? 'راكب' : 'سائق'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">الأولوية:</span>
                        <Badge className={getPriorityColor(selectedComplaint.priority)}>
                          {selectedComplaint.priority}
                        </Badge>
                      </div>
                      <div>
                        <span className="font-medium">المبلغ:</span>
                        <p className="text-muted-foreground">
                          {selectedComplaint.rides.final_fare?.toLocaleString()} د.ع
                        </p>
                      </div>
                    </div>
                    
                    <div>
                      <span className="font-medium">الوصف:</span>
                      <p className="text-muted-foreground mt-1">
                        {selectedComplaint.description}
                      </p>
                    </div>

                    {/* الأدلة */}
                    {selectedComplaint.evidence_urls && selectedComplaint.evidence_urls.length > 0 && (
                      <div>
                        <span className="font-medium">الأدلة المرفقة:</span>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {selectedComplaint.evidence_urls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <img
                                src={url}
                                alt={`دليل ${idx + 1}`}
                                className="w-full h-24 object-cover rounded border hover:opacity-80"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* القرار المالي */}
                <div className="space-y-3">
                  <Label>القرار المالي *</Label>
                  <Select value={financialDecision} onValueChange={setFinancialDecision}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر القرار المالي" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="refund_to_rider">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          إعادة كاملة للراكب
                        </div>
                      </SelectItem>
                      <SelectItem value="refund_to_driver">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-blue-500" />
                          إعادة للسائق
                        </div>
                      </SelectItem>
                      <SelectItem value="split_50_50">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-yellow-500" />
                          تقسيم 50/50
                        </div>
                      </SelectItem>
                      <SelectItem value="no_refund">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          عدم إعادة أي مبلغ
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ملاحظات الحل */}
                <div className="space-y-2">
                  <Label>التبرير والملاحظات * (20-500 حرف)</Label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="اكتب تبريراً مفصلاً للقرار المتخذ..."
                    className="min-h-[100px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-left">
                    {resolutionNotes.length}/500
                  </p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResolveDialog(false)}
                  disabled={resolving}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={handleResolve}
                  disabled={resolving || !financialDecision || !resolutionNotes.trim()}
                >
                  {resolving ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 ml-2" />
                  )}
                  إصدار القرار وحل الشكوى
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminComplaints;
