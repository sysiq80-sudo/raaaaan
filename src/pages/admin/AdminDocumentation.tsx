import React from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle, Zap, MapPin, Calculator, Brain, Globe,
  ArrowDown, ArrowLeft, CheckCircle2, Settings, Phone,
} from 'lucide-react';

const AdminDocumentation: React.FC = () => {
  return (
    <AdminLayout title="التوثيق" subtitle="توثيق كامل لنظام البوت والتدفقات">
      <div className="space-y-6 max-w-4xl">

        {/* Bot Architecture */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-500" />
              هيكلية بوت الواتساب
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-sm leading-relaxed">
              البوت الحالي يعمل عبر <strong>WhatsApp Cloud API</strong> ويستقبل الرسائل من خلال Webhook.
              الملف الرئيسي هو <code className="bg-muted px-1.5 py-0.5 rounded text-xs">whatsapp-webhook/index.ts</code> (1186 سطر)
              مع 10 Modules مساعدة.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: 'config.ts', desc: 'إعدادات + Rate Limiting', icon: Settings },
                { name: 'messages.ts', desc: 'قوالب الرسائل العربية', icon: MessageCircle },
                { name: 'whatsapp-api.ts', desc: 'WhatsApp Cloud API', icon: Phone },
                { name: 'ai-services.ts', desc: 'GPT-4o + Whisper', icon: Brain },
                { name: 'geocoding.ts', desc: 'Geocoding (محلي + Nominatim + Google)', icon: Globe },
                { name: 'fare.ts', desc: 'حساب الأجرة والمسافة', icon: Calculator },
                { name: 'user-session.ts', desc: 'إدارة المستخدمين والجلسات', icon: Zap },
                { name: 'local-classifier.ts', desc: 'تصنيف محلي للرسائل', icon: Brain },
                { name: 'cache.ts', desc: 'كاش للبيانات المتكررة', icon: Settings },
                { name: 'analytics.ts', desc: 'تحليلات الاستخدام', icon: Zap },
              ].map((mod) => (
                <div key={mod.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <mod.icon className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <code className="text-xs font-bold">{mod.name}</code>
                    <p className="text-[11px] text-muted-foreground">{mod.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Flow Diagram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              تدفق الحجز عبر الواتساب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: 1, title: 'استقبال الرسالة', desc: 'Meta Webhook يوصل الرسالة لـ whatsapp-webhook', color: 'bg-blue-500', icon: MessageCircle },
                { step: 2, title: 'تصنيف النية', desc: 'local-classifier يحدد: حجز / استفسار / إلغاء / غير ذلك', color: 'bg-purple-500', icon: Brain },
                { step: 3, title: 'استخراج الوجهة', desc: 'GPT-4o يستخرج اسم المكان من النص أو الصوت (Whisper)', color: 'bg-indigo-500', icon: Brain },
                { step: 4, title: 'تحويل لإحداثيات', desc: 'geocoding يحول العنوان النصي لـ GPS (محلي → Nominatim → Google)', color: 'bg-cyan-500', icon: MapPin },
                { step: 5, title: 'حساب الأجرة', desc: 'fare.ts يحسب المسافة والأجرة بناءً على نوع المركبة', color: 'bg-green-500', icon: Calculator },
                { step: 6, title: 'الرد على العميل', desc: 'إرسال تفاصيل الرحلة مع أزرار تأكيد / إلغاء', color: 'bg-emerald-500', icon: CheckCircle2 },
                { step: 7, title: 'إنشاء الطلب', desc: 'عند التأكيد: draft → pending → match-ride (مطابقة سائق)', color: 'bg-orange-500', icon: Zap },
              ].map((item, i) => (
                <div key={item.step}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full ${item.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {item.step}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  {i < 6 && <div className="flex justify-start ms-3.5 my-1"><ArrowDown className="h-4 w-4 text-muted-foreground/40" /></div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Related Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              صفحات الإدارة المرتبطة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: 'عملاء البوت', href: '/admin/bot-customers', desc: 'قائمة العملاء الذين تواصلوا عبر واتساب' },
                { label: 'الإعدادات', href: '/admin/settings', desc: 'مفاتيح API، إعدادات واتساب، OpenAI' },
                { label: 'إعدادات الأجرة', href: '/admin/fare-settings', desc: 'أسعار الكيلومتر وأنواع المركبات' },
                { label: 'سجلات SMS', href: '/admin/sms-logs', desc: 'سجلات الرسائل المرسلة' },
                { label: 'البوت المتحكم', href: '/admin/bot-controller', desc: 'التبديل بين الوضع المبرمج والتدفق المرئي' },
                { label: 'التدفقات المرئية', href: '/admin/workflows', desc: 'بناء تدفقات واتساب بالسحب والإفلات' },
              ].map((page) => (
                <a key={page.href} href={page.href} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group">
                  <ArrowLeft className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{page.label}</span>
                      <Badge variant="outline" className="text-[9px]">{page.href}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{page.desc}</p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Visual Workflow vs Hardcoded */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-500" />
              المقارنة: الوضع المبرمج vs التدفق المرئي
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-3 font-semibold">الميزة</th>
                    <th className="text-center py-2 px-3 font-semibold">المبرمج (Hardcoded)</th>
                    <th className="text-center py-2 px-3 font-semibold">التدفق المرئي (Visual)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ['السرعة', '⚡ أسرع', '🔄 جيد'],
                    ['المرونة', '❌ يحتاج مبرمج', '✅ بدون كود'],
                    ['AI Fallback', '✅ مدمج', '✅ كتوغل'],
                    ['حساب الأجرة', '✅ مدمج', '✅ عقدة مخصصة'],
                    ['تعديل الردود', '❌ تعديل كود', '✅ من الواجهة'],
                    ['التتبع', '📊 logs فقط', '🔴 Live Trace'],
                    ['إضافة إجراءات', '❌ يحتاج deploy', '✅ سحب وإفلات'],
                  ].map(([feature, hard, visual]) => (
                    <tr key={feature}>
                      <td className="py-2 px-3 text-right font-medium">{feature}</td>
                      <td className="py-2 px-3 text-center text-xs">{hard}</td>
                      <td className="py-2 px-3 text-center text-xs">{visual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDocumentation;
