import React, { useState } from "react";
import { 
  CreditCard, 
  Map, 
  MapPin, 
  MessageSquare, 
  Navigation, 
  Mic, 
  AlertCircle,
  PauseCircle,
  PlayCircle,
  TrendingDown,
  DollarSign
} from "lucide-react";

interface ServiceCostItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  status: "active" | "suspended" | "review";
  costImpact: "high" | "medium" | "low";
  provider: string;
}

const COST_SERVICES: ServiceCostItem[] = [
  {
    id: "places-api",
    name: "البحث الذكي عن الأماكن",
    description: "Google Places Autocomplete (ميزة البحث الآلي عن العناوين أثناء الكتابة)",
    icon: MapPin,
    status: "suspended",
    costImpact: "high",
    provider: "Google Maps Platform",
  },
  {
    id: "directions-api",
    name: "التتبع المباشر وإرشاد المسارات",
    description: "Google Directions API (تحديد مسار الكابتن بدقة، وتتبع وقت الوصول بشكل دوري)",
    icon: Navigation,
    status: "review",
    costImpact: "high",
    provider: "Google Maps Platform",
  },
  {
    id: "geocoding",
    name: "تحويل الإحداثيات لمحرك نصوص",
    description: "Google Geocoding (تحويل خطوط الطول/العرض إلى أسماء الميادين والشوارع)",
    icon: Map,
    status: "active",
    costImpact: "medium",
    provider: "Google Maps Platform",
  },
  {
    id: "twilio-sms",
    name: "بوابة الرسائل النصية القصيرة",
    description: "Twilio SMS (لرسائل التأكيد OTP والطوارئ)",
    icon: MessageSquare,
    status: "review",
    costImpact: "medium",
    provider: "Twilio",
  },
  {
    id: "ai-voice",
    name: "حجز الرحلات الصوتي بالذكاء الاصطناعي",
    description: "Supabase Edge + OpenAI Whisper (التعرف على الأصوات ومعالجتها)",
    icon: Mic,
    status: "active",
    costImpact: "medium",
    provider: "OpenAI / Supabase",
  }
];

const AdminCostControls = () => {
  const [services, setServices] = useState(COST_SERVICES);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "suspended":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "review":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "يتم الصرف (نشط)";
      case "suspended":
        return "متوقف لتجنب التكلفة";
      case "review":
        return "قيد المراجعة / التحديث";
      default:
        return "غير معروف";
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "high":
        return "text-red-400 bg-red-400/10";
      case "medium":
        return "text-amber-400 bg-amber-400/10";
      case "low":
        return "text-emerald-400 bg-emerald-400/10";
      default:
        return "";
    }
  };

  const toggleStatus = (id: string) => {
    // محاكاة تغيير حالة الخدمة للعرض الإداري فقط
    setServices((prev) => 
      prev.map(service => {
        if (service.id === id) {
          const newStatus = service.status === "suspended" ? "active" 
                          : service.status === "active" ? "review" 
                          : "suspended";
          return { ...service, status: newStatus };
        }
        return service;
      })
    );
  };

  return (
    <div className="flex-1 w-full p-4 lg:p-8 animate-in fade-in-50 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-border/50">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <CreditCard className="w-6 h-6 text-primary" />
            تحكم تكاليف الخدمات (APIs)
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            لوحة مخصصة لمراجعة وتعطيل الخدمات الخارجية عالية التكلفة لتقليل المصاريف والإدارة المالية بشكل استباقي. 
            يظهر هنا الخدمات التي تحتسب رسوماً إضافية ليتم مراقبتها أو إيقافها برمجياً لفترة المراجعة والتحديث.
          </p>
        </div>
        <div className="flex bg-[#0f172a] p-4 rounded-xl border border-slate-800 shrink-0 shadow-xl shadow-black/20">
          <div className="flex flex-col mx-3">
            <span className="text-xs text-slate-400 flex items-center gap-1"><TrendingDown className="w-3 h-3 text-emerald-400"/> الوضع المالي الآمن</span>
            <span className="text-xl font-bold text-white flex items-center gap-1">المصاريف مراقبة</span>
          </div>
          <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center border border-primary/30">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {services.map((service) => (
          <div 
            key={service.id} 
            className="flex flex-col bg-background/50 backdrop-blur-sm border border-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all hover:border-slate-700 relative overflow-hidden group"
          >
            {/* Status Indicator Bar */}
            <div className={`absolute top-0 left-0 w-1.5 h-full ${
              service.status === "active" ? "bg-emerald-500" :
              service.status === "suspended" ? "bg-red-500" : "bg-amber-500"
            }`} />

            <div className="flex items-start justify-between mb-4">
              <div className="flex gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                  service.status === "suspended" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  service.status === "review" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  "bg-primary/10 border-primary/20 text-primary"
                }`}>
                  <service.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight mb-1">{service.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 border border-slate-700 bg-slate-800/50 px-2 py-0.5 rounded-md">
                      {service.provider}
                    </span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${getImpactColor(service.costImpact)}`}>
                      {service.costImpact === "high" ? "تكلفة عالية" : service.costImpact === "medium" ? "تكلفة متوسطة" : "تكلفة بسيطة"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={`text-xs font-bold px-3 py-1.5 rounded-full border ${getStatusColor(service.status)} flex items-center gap-1.5`}>
                {service.status === "suspended" && <PauseCircle className="w-3.5 h-3.5" />}
                {service.status === "review" && <AlertCircle className="w-3.5 h-3.5" />}
                {service.status === "active" && <PlayCircle className="w-3.5 h-3.5" />}
                {getStatusText(service.status)}
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-6 flex-1 pr-14 leading-relaxed">
              {service.description}
            </p>

            <div className="mt-auto pr-14 pt-4 border-t border-slate-800/80 flex justify-between items-center bg-gradient-to-r from-transparent to-slate-900/40 p-2 rounded-lg">
              <span className="text-xs text-slate-500">
                {service.status === "suspended" 
                  ? "تم إيقاف الخدمة كلياً ولا تسجل أي صرف"
                  : service.status === "review"
                  ? "يتم مراجعة الكود البرمجي لتقليل التكلفة"
                  : "الخدمة تعمل وتستهلك أرصدة API بشكل حي"
                }
              </span>
              <button 
                onClick={() => toggleStatus(service.id)}
                className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${
                  service.status === "suspended" 
                    ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                }`}
              >
                {service.status === "suspended" ? "تفعيل الخدمة" : "إيقاف اضطراري"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 text-blue-400">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div className="text-sm">
          <p className="font-bold mb-1">ملاحظة تقنية</p>
          <p>
            هذه الصفحة مسؤولة حالياً عن مراقبة حالة الـ APIs. لتطبيق إيقاف أي خدمة، يتم تحديث الحالة في قاعدة البيانات وقراءتها عن طريق الـ Frontend / Edge Functions لعدم التنفيذ وتجنب أي Request.
          </p>
        </div>
      </div>

    </div>
  );
};

export default AdminCostControls;
