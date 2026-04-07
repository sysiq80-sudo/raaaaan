import { AlertTriangle, Download } from 'lucide-react';

interface ForceUpdateScreenProps {
  currentVersion: string;
  minVersion: string | null;
}

export function ForceUpdateScreen({ currentVersion, minVersion }: ForceUpdateScreenProps) {
  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-6" dir="rtl">
      <div className="text-center max-w-sm space-y-6">
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-10 h-10 text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">تحديث مطلوب</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            يجب تحديث التطبيق للاستمرار. النسخة الحالية ({currentVersion}) لم تعد مدعومة.
          </p>
          {minVersion && (
            <p className="text-slate-500 text-xs">
              الحد الأدنى المطلوب: {minVersion}
            </p>
          )}
        </div>

        <a
          href="https://play.google.com/store/apps/details?id=com.raan.rider"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold px-8 py-4 rounded-xl transition-colors"
        >
          <Download className="w-5 h-5" />
          تحديث الآن
        </a>
      </div>
    </div>
  );
}
