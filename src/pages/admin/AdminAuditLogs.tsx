import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Eye,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Input } from "@/components/ui/input";

interface AuditLog {
  id: string;
  admin_id: string;
  action_type: string;
  entity_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  admin_profile?: {
    full_name: string;
    email: string;
  };
}

const AdminAuditLogs = () => {
  const { loading: authLoading, isAdmin } = useAdminAuth();
  const queryClient = useQueryClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const PAGE_SIZE = 50;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const { isLoading: loading } = useQuery({
    queryKey: ['audit-logs', currentPage, searchQuery],
    queryFn: async () => {
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("admin_audit_logs")
        .select("*, admin_profile:profiles!admin_id(full_name, email)", { count: "exact" });

      if (searchQuery) {
        query = query.ilike("action_type", `%${searchQuery}%`);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLogs(data as unknown as AuditLog[]);
      if (count !== null) setTotalCount(count);
      return data;
    },
    enabled: isAdmin,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ar-IQ", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const viewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <AdminLayout
      title="سجل تدقيق النظام"
      subtitle="مراقبة حركات مدراء النظام لضمان الشفافية والأمان."
      actions={
        <div className="flex gap-2 w-full max-w-sm">
          <Input
            placeholder="بحث حسب الإجراء..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background"
          />
          <Button variant="outline" size="icon">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      }
    >
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">التاريخ والوقت</TableHead>
              <TableHead className="text-right">المدير</TableHead>
              <TableHead className="text-right">الإجراء</TableHead>
              <TableHead className="text-right">المعرف المستهدف</TableHead>
              <TableHead className="text-right">تفاصيل</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  جاري التحميل...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  لا توجد سجلات تدقيق
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {formatDate(log.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {log.admin_profile?.full_name || "مدير مجهول"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.admin_profile?.email || log.admin_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-primary/10">
                      {log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                      {log.entity_id || "غير متوفر"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => viewDetails(log)}
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      عرض
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
          >
            <ChevronRight className="w-4 h-4 ml-1" />
            السابقة
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {currentPage + 1} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            التالية
            <ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              تفاصيل حركة النظام
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">المدير المنفذ</p>
                  <p className="font-medium text-sm">
                    {selectedLog.admin_profile?.full_name || selectedLog.admin_id}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">وقت التنفيذ</p>
                  <p className="font-medium text-sm text-left" dir="ltr">
                    {formatDate(selectedLog.created_at)}
                  </p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">نوع الإجراء</p>
                  <Badge>{selectedLog.action_type}</Badge>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-left" dir="ltr">
                  <p className="text-xs text-muted-foreground mb-1 text-right">المعرف المستهدف</p>
                  <p className="font-mono text-xs">{selectedLog.entity_id || "N/A"}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border rounded-xl flex flex-col overflow-hidden">
                  <div className="bg-muted p-2 border-b">
                    <p className="text-sm font-semibold text-destructive">البيانات السابقة</p>
                  </div>
                  <div className="p-4 bg-background max-h-64 overflow-y-auto w-full text-left" dir="ltr">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                      {selectedLog.old_data
                        ? JSON.stringify(selectedLog.old_data, null, 2)
                        : "لا يوجد"}
                    </pre>
                  </div>
                </div>
                <div className="border rounded-xl flex flex-col overflow-hidden">
                  <div className="bg-muted p-2 border-b">
                    <p className="text-sm font-semibold text-success">البيانات الجديدة</p>
                  </div>
                  <div className="p-4 bg-background max-h-64 overflow-y-auto w-full text-left" dir="ltr">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                      {selectedLog.new_data
                        ? JSON.stringify(selectedLog.new_data, null, 2)
                        : "لا يوجد"}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminAuditLogs;
