/**
 * ران — صفحة إدارة حسابات Messenger / Instagram
 * إضافة صفحات Facebook وربطها بالبوت
 */

import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Plus, MessageCircle, Instagram, Facebook, Copy, ExternalLink,
  CheckCircle2, XCircle, Trash2, Settings, Loader2, RefreshCw,
  Shield, Link2, Wifi, WifiOff, Eye, EyeOff, Zap, Info,
} from 'lucide-react';
import { useMessengerAccounts, type CreateMessengerAccountInput, type MessengerAccount } from '@/hooks/useMessengerAccounts';

// ════════════════════════════════════════
// Supabase URL — للعرض في Webhook URL
// ════════════════════════════════════════
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co';
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/messenger-webhook`;

// ════════════════════════════════════════
// مكون بطاقة الحساب
// ════════════════════════════════════════
function AccountCard({
  account,
  onToggle,
  onDelete,
  onTest,
}: {
  account: MessengerAccount;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
  onTest: (account: MessengerAccount) => void;
}) {
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await onTest(account);
    setTesting(false);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`تم نسخ ${label}`);
  };

  const platformIcon = account.platform === 'instagram'
    ? <Instagram className="h-5 w-5 text-pink-500" />
    : <Facebook className="h-5 w-5 text-blue-600" />;

  const platformLabel = account.platform === 'instagram'
    ? 'انستجرام'
    : account.platform === 'both'
      ? 'ماسنجر + انستجرام'
      : 'ماسنجر';

  return (
    <Card className={`relative transition-all ${account.is_active ? 'border-blue-200 bg-blue-50/30 dark:bg-blue-950/10' : 'opacity-60 border-muted'}`}>
      {/* Status indicator */}
      <div className={`absolute top-4 left-4 h-2.5 w-2.5 rounded-full ${account.is_active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {platformIcon}
            <div>
              <CardTitle className="text-base">
                {account.account_name || account.page_name}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px]">
                  {platformLabel}
                </Badge>
                {account.is_verified && (
                  <Badge className="bg-green-100 text-green-700 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 ml-1" />
                    Webhook متصل
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={account.is_active}
            onCheckedChange={(checked) => onToggle(account.id, checked)}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {/* معلومات أساسية */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-muted-foreground text-xs">اسم الصفحة</span>
            <p className="font-medium">{account.page_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Page ID</span>
            <div className="flex items-center gap-1">
              <p className="font-mono text-xs">{account.page_id}</p>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => copyToClipboard(account.page_id, 'Page ID')}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Verify Token */}
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              رمز التحقق (Verify Token)
            </span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => copyToClipboard(account.verify_token, 'Verify Token')}>
              <Copy className="h-3 w-3 ml-1" />
              نسخ
            </Button>
          </div>
          <code className="block mt-1 text-xs font-mono bg-white/60 dark:bg-black/20 rounded px-2 py-1 break-all">
            {account.verify_token}
          </code>
        </div>

        {/* Access Token */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground text-xs">Page Access Token</span>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          </div>
          <code className="block text-[10px] font-mono bg-muted/50 rounded px-2 py-1 break-all max-h-16 overflow-hidden">
            {showToken ? account.page_access_token : '••••••••••••••••••••••••••••••'}
          </code>
        </div>

        {/* App ID & Secret */}
        {(account.app_id || account.app_secret) && (
          <div className="grid grid-cols-2 gap-3">
            {account.app_id && (
              <div>
                <span className="text-muted-foreground text-xs">App ID</span>
                <p className="font-mono text-xs">{account.app_id}</p>
              </div>
            )}
            {account.app_secret && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground text-xs">App Secret</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="font-mono text-xs">{showSecret ? account.app_secret : '••••••'}</p>
              </div>
            )}
          </div>
        )}

        {/* إحصائيات */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-lg font-bold text-blue-600">{account.messages_received}</p>
            <p className="text-[10px] text-muted-foreground">مستلمة</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">{account.messages_sent}</p>
            <p className="text-[10px] text-muted-foreground">مرسلة</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mt-1">
              {account.last_message_at
                ? new Date(account.last_message_at).toLocaleDateString('ar-IQ')
                : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground">آخر رسالة</p>
          </div>
        </div>

        {/* أزرار التحكم */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            اختبار الاتصال
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="text-xs gap-1">
                <Trash2 className="h-3 w-3" />
                حذف
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>حذف حساب {account.page_name}؟</AlertDialogTitle>
                <AlertDialogDescription>
                  سيتم حذف الحساب نهائياً مع جميع الإعدادات. لن يمكن التراجع عن هذا الإجراء.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>إلغاء</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(account.id)} className="bg-red-600 hover:bg-red-700">
                  حذف نهائي
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════
// نموذج إضافة حساب جديد
// ════════════════════════════════════════
function AddAccountDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateMessengerAccountInput) => Promise<any>;
}) {
  const [form, setForm] = useState<CreateMessengerAccountInput>({
    account_name: '',
    page_name: '',
    page_id: '',
    page_access_token: '',
    app_id: '',
    app_secret: '',
    platform: 'messenger',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.page_name.trim()) {
      toast.error('اسم الصفحة مطلوب');
      return;
    }
    if (!form.page_id.trim()) {
      toast.error('Page ID مطلوب');
      return;
    }
    if (!form.page_access_token.trim()) {
      toast.error('Page Access Token مطلوب');
      return;
    }
    setSubmitting(true);
    const result = await onSubmit(form);
    setSubmitting(false);
    if (result) {
      setForm({ account_name: '', page_name: '', page_id: '', page_access_token: '', app_id: '', app_secret: '', platform: 'messenger' });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            إضافة صفحة Facebook
          </DialogTitle>
          <DialogDescription>
            أدخل بيانات صفحة Facebook من Meta Developer Console
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1 space-y-4 py-2">
          {/* اسم الحساب */}
          <div className="space-y-1.5">
            <Label htmlFor="account_name">اسم الحساب (اختياري)</Label>
            <Input
              id="account_name"
              placeholder="مثال: صفحة الشركة الرئيسية"
              value={form.account_name}
              onChange={e => setForm(prev => ({ ...prev, account_name: e.target.value }))}
            />
          </div>

          {/* اسم الصفحة */}
          <div className="space-y-1.5">
            <Label htmlFor="page_name">
              اسم الصفحة <span className="text-red-500">*</span>
            </Label>
            <Input
              id="page_name"
              placeholder="مثال: My Business Page"
              value={form.page_name}
              onChange={e => setForm(prev => ({ ...prev, page_name: e.target.value }))}
            />
          </div>

          {/* Page ID */}
          <div className="space-y-1.5">
            <Label htmlFor="page_id">
              Facebook Page ID <span className="text-red-500">*</span>
            </Label>
            <Input
              id="page_id"
              placeholder="مثال: 123456789012345"
              value={form.page_id}
              onChange={e => setForm(prev => ({ ...prev, page_id: e.target.value }))}
              dir="ltr"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">معرف الصفحة من إعدادات صفحة Facebook</p>
          </div>

          {/* Page Access Token */}
          <div className="space-y-1.5">
            <Label htmlFor="page_access_token">
              Page Access Token <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="page_access_token"
              placeholder="Long-lived Page Access Token"
              value={form.page_access_token}
              onChange={e => setForm(prev => ({ ...prev, page_access_token: e.target.value }))}
              dir="ltr"
              className="font-mono text-xs"
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground">أنشئ رمز وصول طويل الأمد من Meta Developer Console</p>
          </div>

          <Separator />

          {/* App ID & Secret */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="app_id">معرف التطبيق (App ID)</Label>
              <Input
                id="app_id"
                placeholder="App ID"
                value={form.app_id}
                onChange={e => setForm(prev => ({ ...prev, app_id: e.target.value }))}
                dir="ltr"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="app_secret">المفتاح السري (App Secret)</Label>
              <Input
                id="app_secret"
                placeholder="App Secret"
                value={form.app_secret}
                onChange={e => setForm(prev => ({ ...prev, app_secret: e.target.value }))}
                dir="ltr"
                className="font-mono text-xs"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">مطلوبان للتحقق من توقيع Webhook (اختياري لكن مُوصى به)</p>

          {/* المنصة */}
          <div className="space-y-1.5">
            <Label>المنصة</Label>
            <Select
              value={form.platform}
              onValueChange={(v) => setForm(prev => ({ ...prev, platform: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="messenger">
                  <span className="flex items-center gap-2"><Facebook className="h-4 w-4 text-blue-600" /> Messenger فقط</span>
                </SelectItem>
                <SelectItem value="instagram">
                  <span className="flex items-center gap-2"><Instagram className="h-4 w-4 text-pink-500" /> Instagram فقط</span>
                </SelectItem>
                <SelectItem value="both">
                  <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-purple-600" /> Messenger + Instagram</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="border-t pt-4 mt-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إضافة الصفحة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════
// الصفحة الرئيسية
// ════════════════════════════════════════
const AdminMessengerAccounts: React.FC = () => {
  const {
    accounts, loading, fetchAccounts,
    createAccount, deleteAccount, toggleActive, testConnection,
  } = useMessengerAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return (
    <AdminLayout title="حسابات Messenger" subtitle="إدارة صفحات Facebook و Instagram المرتبطة بالبوت">
      <div className="space-y-6">

        {/* ═══ Webhook URL + خطوات الربط ═══ */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-5 w-5 text-blue-600" />
              إعداد Webhook
            </CardTitle>
            <CardDescription>
              انسخ الرابط أدناه والصقه في حقل "Callback URL" في إعدادات Webhooks في Meta Developer Console
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Callback URL */}
            <div className="space-y-1.5">
              <Label className="text-xs">عنوان URL الاستدعاء (Callback URL)</Label>
              <div className="flex gap-2">
                <Input
                  value={WEBHOOK_URL}
                  readOnly
                  dir="ltr"
                  className="font-mono text-xs bg-white dark:bg-black/20"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1"
                  onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success('تم نسخ رابط Webhook'); }}
                >
                  <Copy className="h-3.5 w-3.5" />
                  نسخ
                </Button>
              </div>
            </div>

            <Separator />

            {/* خطوات الربط */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1">
                <Settings className="h-4 w-4" />
                خطوات الربط:
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>أنشئ تطبيق Facebook في <a href="https://developers.facebook.com" target="_blank" className="text-blue-600 underline inline-flex items-center gap-0.5">Meta Developer Console <ExternalLink className="h-3 w-3" /></a></li>
                <li>فعّل منتج <strong>Messenger</strong> في التطبيق</li>
                <li>أضف صفحة Facebook أدناه بالبيانات المطلوبة</li>
                <li>بعد الإضافة، سيظهر رمز التحقق (Verify Token) تلقائياً في بطاقة الحساب</li>
                <li>انسخ رابط Webhook أعلاه والصقه في حقل <strong>Callback URL</strong></li>
                <li>انسخ رمز التحقق من بطاقة الحساب والصقه في حقل <strong>Verify Token</strong></li>
                <li>اشترك في أحداث <code className="bg-muted px-1 rounded">messages</code> و <code className="bg-muted px-1 rounded">messaging_postbacks</code></li>
              </ol>
            </div>

            {/* ملاحظة */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>ملاحظة:</strong> رمز التحقق يُنشأ تلقائياً عند إضافة الصفحة. أضف الصفحة أولاً ثم انسخ الرمز.
              </p>
            </div>

            {/* الأذونات المطلوبة */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold">الأذونات المطلوبة:</h4>
              <div className="flex flex-wrap gap-1.5">
                {['pages_messaging', 'pages_read_engagement', 'pages_manage_metadata', 'pages_read_user_content'].map(perm => (
                  <Badge key={perm} variant="outline" className="font-mono text-[10px]">{perm}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ═══ شريط الأدوات ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">الصفحات المرتبطة</h2>
            <Badge variant="secondary" className="text-xs">{accounts.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchAccounts} disabled={loading} className="gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
              <Plus className="h-4 w-4" />
              إضافة صفحة
            </Button>
          </div>
        </div>

        {/* ═══ قائمة الحسابات ═══ */}
        {loading && accounts.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <Facebook className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold">لا توجد صفحات مرتبطة</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                أضف صفحة Facebook لبدء استقبال رسائل Messenger و Instagram عبر البوت
              </p>
              <Button className="mt-4 gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                إضافة أول صفحة
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onToggle={toggleActive}
                onDelete={deleteAccount}
                onTest={testConnection}
              />
            ))}
          </div>
        )}

        {/* ═══ نموذج الإضافة ═══ */}
        <AddAccountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={createAccount}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminMessengerAccounts;
