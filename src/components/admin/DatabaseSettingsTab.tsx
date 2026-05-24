import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Plus, 
  Check, 
  X, 
  Trash2, 
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Server
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  SupabaseProject,
  getSupabaseConfig,
  addProject,
  deleteProject,
  setActiveProject,
  testConnection,
  getDefaultProject,
} from '@/lib/supabaseConfig';

const DatabaseSettingsTab = () => {
  const [projects, setProjects] = useState<SupabaseProject[]>(getSupabaseConfig().projects);
  const [activeProjectId, setActiveProjectId] = useState(getSupabaseConfig().activeProjectId);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  // حقول النموذج
  const [newProject, setNewProject] = useState({
    name: '',
    url: '',
    anonKey: '',
  });

  const refreshProjects = () => {
    const config = getSupabaseConfig();
    setProjects(config.projects);
    setActiveProjectId(config.activeProjectId);
  };

  const handleTestConnection = async (project: SupabaseProject) => {
    setTesting(project.id);
    try {
      const result = await testConnection(project.url, project.anonKey);
      if (result.success) {
        toast.success('الاتصال ناجح!');
      } else {
        toast.error(`فشل الاتصال: ${result.error}`);
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء اختبار الاتصال');
    } finally {
      setTesting(null);
    }
  };

  const handleAddProject = async () => {
    if (!newProject.name || !newProject.url || !newProject.anonKey) {
      toast.error('جميع الحقول مطلوبة');
      return;
    }

    // تنظيف URL
    let cleanUrl = newProject.url.trim();
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    // اختبار الاتصال أولاً
    setTesting('new');
    const result = await testConnection(cleanUrl, newProject.anonKey.trim());
    setTesting(null);

    if (!result.success) {
      toast.error(`فشل الاتصال: ${result.error}`);
      return;
    }

    addProject({
      name: newProject.name.trim(),
      url: cleanUrl,
      anonKey: newProject.anonKey.trim(),
    });

    setNewProject({ name: '', url: '', anonKey: '' });
    setShowAddForm(false);
    refreshProjects();
    toast.success('تمت إضافة المشروع بنجاح');
  };

  const handleDeleteProject = (id: string) => {
    if (deleteProject(id)) {
      refreshProjects();
      toast.success('تم حذف المشروع');
    } else {
      toast.error('لا يمكن حذف هذا المشروع');
    }
  };

  const handleSwitchProject = async (projectId: string) => {
    if (projectId === activeProjectId) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    setSwitching(projectId);

    // اختبار الاتصال أولاً
    const result = await testConnection(project.url, project.anonKey);
    if (!result.success) {
      toast.error(`فشل الاتصال: ${result.error}`);
      setSwitching(null);
      return;
    }

    setActiveProject(projectId);
    toast.success(`جاري التبديل إلى: ${project.name}`, {
      description: 'سيتم تسجيل خروجك وإعادة توجيهك...',
    });

    // تسجيل الخروج وإعادة التوجيه
    setTimeout(() => {
      localStorage.removeItem('sb-wgolkcztdrwdphwjvqxt-auth-token');
      window.location.href = '/admin/login';
    }, 1500);
  };

  const defaultProject = getDefaultProject();

  return (
    <div className="space-y-6">
      {/* المشروع النشط */}
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            المشروع النشط
          </CardTitle>
          <CardDescription>المشروع المتصل حالياً بالتطبيق</CardDescription>
        </CardHeader>
        <CardContent>
          {projects.filter(p => p.id === activeProjectId).map(project => (
            <div key={project.id} className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{project.name}</span>
                  {project.isDefault && (
                    <Badge variant="secondary">افتراضي</Badge>
                  )}
                  <Badge variant="default" className="bg-green-500">نشط</Badge>
                </div>
                <p className="text-sm text-muted-foreground font-mono">{project.url}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestConnection(project)}
                disabled={testing === project.id}
              >
                {testing === project.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                اختبار
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* تحذير */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-amber-700 dark:text-amber-400">تحذير هام</p>
            <p className="text-sm text-muted-foreground">
              عند التبديل بين المشاريع سيتم تسجيل خروجك تلقائياً. 
              تأكد من أن المشروع الجديد يحتوي على نفس هيكل الجداول والـ Edge Functions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* قائمة المشاريع */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                مشاريع Supabase
              </CardTitle>
              <CardDescription>إدارة المشاريع المتاحة للتبديل</CardDescription>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
              <Plus className="w-4 h-4 ml-1" />
              إضافة مشروع
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* نموذج إضافة مشروع */}
          {showAddForm && (
            <div className="p-4 rounded-lg border bg-muted/50 space-y-4">
              <h4 className="font-medium">إضافة مشروع جديد</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="projectName">اسم المشروع</Label>
                  <Input
                    id="projectName"
                    placeholder="مثال: مشروع التطوير"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectUrl">Project URL</Label>
                  <Input
                    id="projectUrl"
                    placeholder="https://xxxxx.supabase.co"
                    value={newProject.url}
                    onChange={(e) => setNewProject({ ...newProject, url: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="anonKey">Anon Key</Label>
                <Input
                  id="anonKey"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={newProject.anonKey}
                  onChange={(e) => setNewProject({ ...newProject, anonKey: e.target.value })}
                  dir="ltr"
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  يمكنك الحصول على Anon Key من لوحة تحكم Supabase → Settings → API
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddProject} disabled={testing === 'new'}>
                  {testing === 'new' ? (
                    <>
                      <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                      جاري الاختبار...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 ml-2" />
                      اختبار وإضافة
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  <X className="w-4 h-4 ml-2" />
                  إلغاء
                </Button>
              </div>
            </div>
          )}

          {/* قائمة المشاريع */}
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  project.id === activeProjectId
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{project.name}</span>
                    {project.isDefault && (
                      <Badge variant="secondary">افتراضي</Badge>
                    )}
                    {project.id === activeProjectId && (
                      <Badge variant="default" className="bg-green-500">نشط</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono truncate max-w-md">
                    {project.url}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    أُضيف: {new Date(project.createdAt).toLocaleDateString('ar-IQ')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`${project.url.replace('.supabase.co', '')}/project`, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestConnection(project)}
                    disabled={testing === project.id}
                  >
                    {testing === project.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'اختبار'
                    )}
                  </Button>
                  {project.id !== activeProjectId && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleSwitchProject(project.id)}
                      disabled={switching === project.id}
                    >
                      {switching === project.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        'تفعيل'
                      )}
                    </Button>
                  )}
                  {!project.isDefault && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف المشروع</AlertDialogTitle>
                          <AlertDialogDescription>
                            هل أنت متأكد من حذف "{project.name}"؟ لا يمكن التراجع عن هذا الإجراء.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteProject(project.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            حذف
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSettingsTab;
