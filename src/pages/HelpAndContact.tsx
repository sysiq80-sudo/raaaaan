/**
 * ران - صفحة الاتصال و المساعدة الموحدة
 * Dark Luxury — مطابق لتنسيق صفحة المالية
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Phone,
    MessageCircle,
    Mail,
    MapPin,
    Send,
    Clock,
    CheckCircle2,
    Loader2,
    Facebook,
    Instagram,
    MessageSquare,
    Headphones,
    HelpCircle,
    AlertTriangle,
    Ambulance,
    AlertCircle,
    ChevronDown,
    ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { APP_INFO } from "@/lib/constants";
import logo from "@/assets/logo.png";
import DriverPageHeader from "@/components/driver/DriverPageHeader";

type TabType = "help" | "contact";

const HelpAndContact = () => {
    const [activeTab, setActiveTab] = useState<TabType>("help");

    // إزالة driver-mode لتفعيل السكرول
    useEffect(() => {
        const hadDriverMode = document.body.classList.contains('driver-mode');
        document.body.classList.remove('driver-mode');
        document.body.style.overflow = 'auto';
        document.body.style.position = 'static';
        return () => {
            if (hadDriverMode) document.body.classList.add('driver-mode');
            document.body.style.overflow = '';
            document.body.style.position = '';
        };
    }, []);

    const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        subject: "",
        message: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const faqs = [
        { icon: HelpCircle,    title: "كيف أحجز رحلة؟",                     answer: "افتح التطبيق، أدخل موقعك الحالي والوجهة، اختر نوع المركبة، وأكد الحجز. سيظهر السائق المتاح قريباً." },
        { icon: Clock,         title: "كم المتوسط لانتظار السائق؟",          answer: "عادة ما يصل السائق خلال 3-7 دقائق حسب توفر السائقين في منطقتك والطلب الحالي." },
        { icon: Mail,          title: "كيف أتواصل بالمشاكل التقنية؟",       answer: "استخدم قسم التواصل معنا أو أرسل بريد إلى support@raan.app مع وصف المشكلة." },
        { icon: AlertTriangle, title: "ماذا لو لم أجد سائق؟",              answer: "جرب مرة أخرى خلال لحظات، أو غير نوع المركبة، أو تحقق من اتصالك بالإنترنت." },
        { icon: Phone,         title: "هل يمكن الاتصال بالسائق قبل الوصول؟", answer: "نعم، يمكنك الاتصال به مباشرة عند قبوله للرحلة. رقمه سيظهر في تطبيقك." },
        { icon: Mail,          title: "كيف أسترجع أموالي؟",               answer: "في حالة الإلغاء قبل وصول السائق، يتم استرجاع المبلغ كاملاً. للمزيد، تواصل معنا." },
        { icon: AlertCircle,   title: "ماذا لو حدثت مشكلة أثناء الرحلة؟",  answer: "اضغط على زر المساعدة أو الطوارئ في صفحة الرحلة، سيتم الاتصال بفريق الدعم فوراً." },
    ];

    const contactMethods = [
        { icon: Phone,         title: "اتصل بنا",          subtitle: "متاح 24/7",        value: APP_INFO.phone,       href: `tel:${APP_INFO.phone}`,                                   color: "text-[#5bdda6]",  glow: "bg-[#5bdda6]/10 border-[#5bdda6]/20" },
        { icon: MessageCircle, title: "واتساب",             subtitle: "رد خلال دقائق",    value: "راسلنا الآن",        href: `https://wa.me/${APP_INFO.phone.replace(/\D/g, '')}`,       color: "text-green-400",  glow: "bg-green-500/10 border-green-500/20" },
        { icon: Mail,          title: "البريد الإلكتروني",  subtitle: "للاستفسارات",      value: APP_INFO.email,       href: `mailto:${APP_INFO.email}`,                                color: "text-blue-400",   glow: "bg-blue-500/10 border-blue-500/20" },
    ];

    const socialLinks = [
        { icon: Facebook,       href: "https://facebook.com/raan.app",     label: "فيسبوك",   color: "bg-blue-600/20 border-blue-600/30 text-blue-400" },
        { icon: Instagram,      href: "https://instagram.com/raan.app",    label: "انستغرام", color: "bg-pink-600/20 border-pink-600/30 text-pink-400" },
        { icon: MessageSquare,  href: "https://t.me/raan_1_bot",           label: "تيليجرام", color: "bg-sky-600/20 border-sky-600/30 text-sky-400" },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.phone || !formData.message) {
            toast.error("يرجى ملء الحقول المطلوبة");
            return;
        }
        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 1500));
        setIsSubmitting(false);
        setIsSubmitted(true);
        toast.success("تم إرسال رسالتك بنجاح! سنتواصل معك قريباً");
        setTimeout(() => {
            setFormData({ name: "", phone: "", email: "", subject: "", message: "" });
            setIsSubmitted(false);
        }, 3000);
    };

    return (
        <div className="min-h-screen bg-[#0b1326] pb-8 overflow-y-auto" dir="rtl">
            <DriverPageHeader title="المساعدة والتواصل" />

            {/* خلفية ديكورية */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-[#5bdda6]/5 blur-[120px]" />
                <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-blue-500/3 blur-[100px]" />
            </div>

            <div className="relative z-10 pt-[calc(3.5rem+env(safe-area-inset-top)+1rem)] px-5 space-y-4">
                <div className="max-w-lg mx-auto space-y-4">

                    {/* Hero Card */}
                    <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                        <div className="h-1 bg-gradient-to-r from-transparent via-[#5bdda6]/50 to-transparent" />
                        <div className="p-5">
                            <div className="flex items-center justify-between">
                                <div className="w-14 h-14 rounded-2xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center shadow-[0_0_20px_rgba(91,221,166,0.15)] flex-shrink-0">
                                    <Headphones className="w-7 h-7 text-[#5bdda6]" />
                                </div>
                                <div className="text-right">
                                    <p className="text-slate-500 text-xs font-medium mb-1">فريق الدعم</p>
                                    <p className="text-xl font-black text-white">نحن هنا لمساعدتك</p>
                                    <p className="text-slate-500 text-xs mt-0.5">متاح 24/7 طوال الأسبوع</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* تبويبات */}
                    <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-1.5 flex gap-1.5">
                        <button
                            onClick={() => setActiveTab("help")}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                activeTab === "help"
                                    ? "bg-[#5bdda6] text-[#0b1326] shadow-md"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            <HelpCircle className="w-4 h-4" />
                            المساعدة
                        </button>
                        <button
                            onClick={() => setActiveTab("contact")}
                            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                activeTab === "contact"
                                    ? "bg-[#5bdda6] text-[#0b1326] shadow-md"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            <Phone className="w-4 h-4" />
                            تواصل معنا
                        </button>
                    </div>

                    {/* ── تبويب المساعدة ── */}
                    {activeTab === "help" && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-4"
                        >
                            {/* طرق التواصل السريعة */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <Phone className="w-4 h-4 text-[#5bdda6]" />
                                    <h2 className="font-bold text-white text-sm">طرق التواصل السريعة</h2>
                                    <div className="flex-1 h-px bg-slate-700/50" />
                                </div>
                                {contactMethods.map((method, index) => (
                                    <a
                                        key={index}
                                        href={method.href}
                                        target={method.href.startsWith('http') ? '_blank' : undefined}
                                        rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                        className={`flex items-center gap-3 p-4 rounded-2xl bg-[#171f33] border border-slate-700/30 hover:border-slate-600/50 active:scale-[0.97] transition-all`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${method.glow}`}>
                                            <method.icon className={`w-5 h-5 ${method.color}`} />
                                        </div>
                                        <div className="flex-1 text-right">
                                            <p className="font-bold text-white text-sm">{method.title}</p>
                                            <p className="text-xs text-slate-500">{method.subtitle}</p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-slate-600 rotate-180" />
                                    </a>
                                ))}
                            </div>

                            {/* الأسئلة الشائعة */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <HelpCircle className="w-4 h-4 text-amber-400" />
                                    <h2 className="font-bold text-white text-sm">الأسئلة الشائعة</h2>
                                    <div className="flex-1 h-px bg-slate-700/50" />
                                </div>
                                {faqs.map((faq, index) => (
                                    <div
                                        key={index}
                                        className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden cursor-pointer"
                                        onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                                    >
                                        <div className="p-4 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                                <faq.icon className="w-4 h-4 text-amber-400" />
                                            </div>
                                            <p className="font-bold text-white text-sm flex-1 text-right">{faq.title}</p>
                                            <motion.div animate={{ rotate: expandedFAQ === index ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                                <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                                            </motion.div>
                                        </div>
                                        {expandedFAQ === index && (
                                            <div className="px-4 pb-4 border-t border-slate-700/30 pt-3">
                                                <p className="text-sm text-slate-400 text-right leading-relaxed">{faq.answer}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* الطوارئ */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2.5">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <h2 className="font-bold text-red-400 text-sm">حالات الطوارئ</h2>
                                    <div className="flex-1 h-px bg-slate-700/50" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <a href="tel:112" className="bg-[#171f33] rounded-2xl border border-red-500/20 p-4 text-center hover:border-red-500/40 active:scale-[0.97] transition-all">
                                        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                        <p className="font-bold text-red-400 text-sm">شرطة</p>
                                        <p className="text-xs text-slate-500 mt-1">112</p>
                                    </a>
                                    <a href="tel:113" className="bg-[#171f33] rounded-2xl border border-red-500/20 p-4 text-center hover:border-red-500/40 active:scale-[0.97] transition-all">
                                        <Ambulance className="w-8 h-8 text-red-400 mx-auto mb-2" />
                                        <p className="font-bold text-red-400 text-sm">إسعاف</p>
                                        <p className="text-xs text-slate-500 mt-1">113</p>
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── تبويب التواصل ── */}
                    {activeTab === "contact" && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                            className="space-y-4"
                        >
                            {/* طرق التواصل */}
                            <div className="space-y-2">
                                {contactMethods.map((method, index) => (
                                    <a
                                        key={index}
                                        href={method.href}
                                        target={method.href.startsWith('http') ? '_blank' : undefined}
                                        rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                        className="flex items-center gap-3 p-4 rounded-2xl bg-[#171f33] border border-slate-700/30 hover:border-slate-600/50 active:scale-[0.97] transition-all"
                                    >
                                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${method.glow}`}>
                                            <method.icon className={`w-5 h-5 ${method.color}`} />
                                        </div>
                                        <div className="flex-1 text-right">
                                            <p className="font-bold text-white text-sm">{method.title}</p>
                                            <p className="text-xs text-slate-500">{method.subtitle}</p>
                                        </div>
                                        <span className={`text-xs font-medium ${method.color}`} dir="ltr">{method.value}</span>
                                    </a>
                                ))}
                            </div>

                            {/* ساعات العمل */}
                            <div className="bg-[#171f33] rounded-2xl border border-amber-500/20 p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                    <Clock className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white text-sm">ساعات العمل</p>
                                    <p className="text-xs text-slate-500">الدعم الفني متاح <span className="text-amber-400 font-bold">24/7</span></p>
                                </div>
                            </div>

                            {/* نموذج الاتصال */}
                            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 overflow-hidden">
                                <div className="h-1 bg-gradient-to-r from-transparent via-[#5bdda6]/50 to-transparent" />
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Send className="w-4 h-4 text-[#5bdda6]" />
                                        <h3 className="font-bold text-white text-sm">أرسل لنا رسالة</h3>
                                    </div>

                                    {isSubmitted ? (
                                        <div className="py-8 text-center">
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center">
                                                <CheckCircle2 className="w-8 h-8 text-[#5bdda6]" />
                                            </div>
                                            <h4 className="text-lg font-bold text-white mb-2">تم إرسال رسالتك!</h4>
                                            <p className="text-slate-500 text-sm">سنتواصل معك في أقرب وقت ممكن</p>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="space-y-3">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-slate-400">الاسم *</Label>
                                                    <Input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="اسمك الكريم"
                                                        className="bg-[#0b1326] border-slate-700/50 text-white placeholder:text-slate-600 text-sm"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs text-slate-400">رقم الهاتف *</Label>
                                                    <Input
                                                        type="tel"
                                                        dir="ltr"
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                                        placeholder="07XXXXXXXX"
                                                        className="bg-[#0b1326] border-slate-700/50 text-white placeholder:text-slate-600 text-sm"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-400">الموضوع</Label>
                                                <Input
                                                    value={formData.subject}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                                    placeholder="استفسار عن..."
                                                    className="bg-[#0b1326] border-slate-700/50 text-white placeholder:text-slate-600 text-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-400">الرسالة *</Label>
                                                <Textarea
                                                    value={formData.message}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                                    placeholder="اكتب رسالتك هنا..."
                                                    rows={4}
                                                    className="bg-[#0b1326] border-slate-700/50 text-white placeholder:text-slate-600 text-sm resize-none"
                                                    required
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                className="w-full py-3 rounded-xl bg-[#5bdda6] text-[#0b1326] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#4dc99a] active:scale-[0.97] transition-all disabled:opacity-60"
                                            >
                                                {isSubmitting ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
                                                ) : (
                                                    <><Send className="w-4 h-4" /> إرسال الرسالة</>
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            </div>

                            {/* سوشيال ميديا */}
                            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-5">
                                <p className="font-bold text-white text-sm text-center mb-4">تابعنا على</p>
                                <div className="flex justify-center gap-3">
                                    {socialLinks.map((social, index) => (
                                        <a
                                            key={index}
                                            href={social.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${social.color}`}
                                            aria-label={social.label}
                                        >
                                            <social.icon className="w-5 h-5" />
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* الموقع */}
                            <div className="bg-[#171f33] rounded-2xl border border-slate-700/30 p-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#5bdda6]/10 border border-[#5bdda6]/20 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-5 h-5 text-[#5bdda6]" />
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-white text-sm">المكتب الرئيسي</p>
                                    <p className="text-xs text-slate-500">الرمادي، محافظة الأنبار، العراق</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Footer */}
                    <div className="text-center py-4 text-xs text-slate-600">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <img src={logo} alt="RAAN" className="w-5 h-5 rounded" />
                            <span className="font-bold text-slate-500">ران RAAN</span>
                        </div>
                        <p>نسعى دائماً لخدمتكم بأفضل طريقة 💚</p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default HelpAndContact;
