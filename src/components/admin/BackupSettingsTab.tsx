import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Clock, 
  Database,
  FileDown,
  FileUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import {
  getAutoBackupSettings,
  saveAutoBackupSettings,
  getStoredBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  exportBackupToFile,
  importBackupFromFile,
  formatFileSize,
  AutoBackupSettings,
  BackupMetadata
} from '@/lib/backupUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const BackupSettingsTab = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<AutoBackupSettings>(getAutoBackupSettings());
  const [backups, setBackups] = useState<BackupMetadata[]>(getStoredBackups());
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState<string | null>(null);

  useEffect(() => {
    setBackups(getStoredBackups());
  }, []);

  const handleSettingsChange = (newSettings: Partial<AutoBackupSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveAutoBackupSettings(updated);
  };

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const result = await createBackup();
      if (result.success) {
        toast({
          title: 'تم إنشاء النسخة الاحتياطية',
          description: 'تم حفظ النسخة الاحتياطية بنجاح',
        });
        setBackups(getStoredBackups());
        setSettings(getAutoBackupSettings());
      } else {
        toast({
          title: 'خطأ',
          description: result.error || 'فشل في إنشاء النسخة الاحتياطية',
          variant: 'destructive',
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackupId) return;
    
    setIsRestoring(true);
    setRestoreDialogOpen(false);
    
    try {
      const result = await restoreBackup(selectedBackupId);
      if (result.success) {
        toast({
          title: 'تم استعادة النسخة الاحتياطية',
          description: `تم استعادة: ${result.restored?.join(', ')}`,
        });
      } else {
        toast({
          title: 'خطأ',
          description: result.error || 'فشل في استعادة النسخة الاحتياطية',
          variant: 'destructive',
        });
      }
    } finally {
      setIsRestoring(false);
      setSelectedBackupId(null);
    }
  };

  const handleDeleteBackup = (backupId: string) => {
    if (deleteBackup(backupId)) {
      toast({
        title: 'تم الحذف',
        description: 'تم حذف النسخة الاحتياطية',
      });
      setBackups(getStoredBackups());
    }
  };

  const handleExportBackup = (backupId: string) => {
    if (exportBackupToFile(backupId)) {
      toast({
        title: 'تم التصدير',
        description: 'تم تحميل ملف النسخة الاحتياطية',
      });
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await importBackupFromFile(file);
    if (result.success) {
      toast({
        title: 'تم الاستيراد',
        description: 'تم استيراد النسخة الاحتياطية بنجاح',
      });
      setBackups(getStoredBackups());
    } else {
      toast({
        title: 'خطأ',
        description: result.error || 'فشل في استيراد الملف',
        variant: 'destructive',
      });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Auto Backup Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            النسخ الاحتياطي التلقائي
          </CardTitle>
          <CardDescription>
            تفعيل النسخ الاحتياطي التلقائي للإعدادات والبيانات المهمة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-backup">تفعيل النسخ التلقائي</Label>
            <Switch
              id="auto-backup"
              checked={settings.enabled}
              onCheckedChange={(checked) => handleSettingsChange({ enabled: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الفترة الزمنية</Label>
              <Select
                value={settings.intervalHours.toString()}
                onValueChange={(value) => handleSettingsChange({ intervalHours: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">كل 6 ساعات</SelectItem>
                  <SelectItem value="12">كل 12 ساعة</SelectItem>
                  <SelectItem value="24">كل يوم</SelectItem>
                  <SelectItem value="168">كل أسبوع</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الحد الأقصى للنسخ</Label>
              <Select
                value={settings.maxBackups.toString()}
                onValueChange={(value) => handleSettingsChange({ maxBackups: parseInt(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 نسخ</SelectItem>
                  <SelectItem value="5">5 نسخ</SelectItem>
                  <SelectItem value="10">10 نسخ</SelectItem>
                  <SelectItem value="20">20 نسخة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {settings.lastBackupAt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-green-500" />
              آخر نسخة: {formatDate(settings.lastBackupAt)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            النسخ الاحتياطي اليدوي
          </CardTitle>
          <CardDescription>
            إنشاء نسخة احتياطية يدوياً أو استيراد نسخة من ملف
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={handleCreateBackup} disabled={isCreating}>
              {isCreating ? (
                <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 ml-2" />
              )}
              إنشاء نسخة احتياطية
            </Button>
            
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 ml-2" />
              استيراد من ملف
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </div>

          <div className="text-sm text-muted-foreground">
            <p>البيانات التي يتم نسخها:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>إعدادات التطبيق</li>
              <li>المناطق وأسعارها</li>
              <li>حوافز السائقين</li>
              <li>المعالم المحفوظة</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Backups List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            النسخ الاحتياطية المحفوظة
          </CardTitle>
          <CardDescription>
            {backups.length} نسخة احتياطية محفوظة
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد نسخ احتياطية</p>
              <p className="text-sm">قم بإنشاء نسخة احتياطية للبدء</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{backup.name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatDate(backup.createdAt)}</span>
                      <span>•</span>
                      <span>{formatFileSize(backup.size)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedBackupId(backup.id);
                        setRestoreDialogOpen(true);
                      }}
                      disabled={isRestoring}
                    >
                      <FileUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportBackup(backup.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>استعادة النسخة الاحتياطية</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من استعادة هذه النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية بالبيانات المحفوظة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreBackup}>
              استعادة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BackupSettingsTab;
