import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  AlertCircle,
  Plus,
  RefreshCcw
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface AppTask {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

const statusColors = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800"
};

const statusLabels = {
  todo: "للتنفيذ",
  in_progress: "قيد التنفيذ",
  done: "مكتمل"
};

const statusIcons = {
  todo: <Circle className="w-5 h-5 text-gray-500" />,
  in_progress: <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />,
  done: <CheckCircle2 className="w-5 h-5 text-green-500" />
};

const priorityColors = {
  low: "bg-gray-100 text-gray-700",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800"
};

const priorityLabels = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة"
};

export default function AdminDevelopmentTasks() {
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const { isLoading: loading, refetch } = useQuery({
    queryKey: ['app-tasks'],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('app_tasks' as any)
        .select('*')
        .order('status', { ascending: false })
        .order('created_at', { ascending: false });

      if (err) {
        setError("لم يتم العثور على المهام. تأكد من تشغيل أمر الترحيل (Migration) لقاعدة البيانات: npx supabase db push");
        return [] as AppTask[];
      }
      
      const statusOrder = { todo: 1, in_progress: 2, done: 3 };
      const sortedData = (data as AppTask[]).sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
      
      setTasks(sortedData);
      setError(null);
      return sortedData;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: AppTask['status'] }) => {
      const { error } = await supabase
        .from('app_tasks' as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "تم التحديث", description: "تم تحديث حالة المهمة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ['app-tasks'] });
    },
    onError: () => {
      toast({ title: "خطأ", description: "تعذر تحديث المهمة", variant: "destructive" });
    },
  });

  const updateTaskStatus = (id: string, newStatus: AppTask['status']) => {
    updateStatusMutation.mutate({ id, newStatus });
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">التطوير والمهام (Enterprise Tasks)</h1>
          <p className="mt-2 text-gray-500">متابعة الترقيات المعمارية والمهام المتبقية للإطلاق الفعلي</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              void refetch();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" /> تحديث
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center justify-center gap-3 border border-red-200">
          <AlertCircle className="w-6 h-6" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* أعمدة كانبان */}
          {['todo', 'in_progress', 'done'].map((statusKey) => (
            <div key={statusKey} className="bg-gray-50 rounded-xl p-4 border border-gray-200 min-h-[500px]">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                {statusIcons[statusKey as keyof typeof statusIcons]}
                {statusLabels[statusKey as keyof typeof statusLabels]}
                <span className="bg-gray-200 text-gray-700 text-sm py-0.5 px-2 rounded-full mr-auto">
                  {tasks.filter(t => t.status === statusKey).length}
                </span>
              </h2>

              <div className="space-y-4">
                {tasks.filter(t => t.status === statusKey).map((task) => (
                  <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${priorityColors[task.priority]}`}>
                        {priorityLabels[task.priority]}
                      </span>
                      <div className="flex gap-1">
                        {statusKey !== 'done' && (
                          <button 
                            title="تحديد كمكتمل"
                            onClick={() => updateTaskStatus(task.id, 'done')}
                            className="text-gray-400 hover:text-green-500"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {statusKey !== 'in_progress' && statusKey !== 'done' && (
                          <button 
                            title="نقل إلى قيد التنفيذ"
                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            className="text-gray-400 hover:text-blue-500"
                          >
                            <Loader2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mb-3">{task.description}</p>
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      تمت الإضافة: {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
                    </div>
                  </div>
                ))}
                
                {tasks.filter(t => t.status === statusKey).length === 0 && (
                  <div className="text-center text-gray-400 py-8 text-sm">
                    لا يوجد مهام هنا
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
