/**
 * ران - صفحة الاتصال و المساعدة الموحدة
 * تجمع بين صفحة المساعدة و التواصل معنا
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowRight,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { APP_INFO } from "@/lib/constants";
import logo from "@/assets/logo.png";

type TabType = "help" | "contact";

const HelpAndContact = () => {
    const [activeTab, setActiveTab] = useState<TabType>("help");
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

    // FAQs Data
    const faqs = [
        {
            icon: HelpCircle,
            title: "كيف أحجز رحلة؟",
            answer: "افتح التطبيق، أدخل موقعك الحالي والوجهة، اختر نوع المركبة، وأكد الحجز. سيظهر السائق المتاح قريباً."
        },
        {
            icon: Clock,
            title: "كم المتوسط لانتظار السائق؟",
            answer: "عادة ما يصل السائق خلال 3-7 دقائق حسب توفر السائقين في منطقتك والطلب الحالي."
        },
        {
            icon: Mail,
            title: "كيف أتواصل بالمشاكل التقنية؟",
            answer: "استخدم قسم التواصل معنا أو أرسل بريد إلى support@raan.app مع وصف المشكلة."
        },
        {
            icon: AlertTriangle,
            title: "ماذا لو لم أجد سائق؟",
            answer: "جرب مرة أخرى خلال لحظات، أو غير نوع المركبة، أو تحقق من اتصالك بالإنترنت."
        },
        {
            icon: Phone,
            title: "هل يمكن الاتصال بالسائق قبل الوصول؟",
            answer: "نعم، يمكنك الاتصال به مباشرة عند قبوله للرحلة. رقمه سيظهر في تطبيقك."
        },
        {
            icon: Mail,
            title: "كيف أسترجع أموالي؟",
            answer: "في حالة الإلغاء قبل وصول السائق، يتم استرجاع المبلغ كاملاً. للمزيد، تواصل معنا."
        },
        {
            icon: AlertCircle,
            title: "ماذا لو حدثت مشكلة أثناء الرحلة؟",
            answer: "اضغط على زر المساعدة أو الطوارئ في الحي الصفحة، سيتم الاتصال بفريق الدعم فوراً."
        }
    ];

    const contactMethods = [
        {
            icon: Phone,
            title: "اتصل بنا",
            subtitle: "متاح 24/7",
            value: APP_INFO.phone,
            href: `tel:${APP_INFO.phone}`,
            color: "from-primary/20 to-primary/5",
            iconColor: "text-primary",
            borderColor: "border-primary/20 hover:border-primary/40"
        },
        {
            icon: MessageCircle,
            title: "واتساب",
            subtitle: "رد خلال دقائق",
            value: "راسلنا الآن",
            href: `https://wa.me/${APP_INFO.phone.replace(/\D/g, '')}`,
            color: "from-green-500/20 to-green-500/5",
            iconColor: "text-green-500",
            borderColor: "border-green-500/20 hover:border-green-500/40"
        },
        {
            icon: Mail,
            title: "البريد الإلكتروني",
            subtitle: "للاستفسارات",
            value: APP_INFO.email,
            href: `mailto:${APP_INFO.email}`,
            color: "from-blue-500/20 to-blue-500/5",
            iconColor: "text-blue-500",
            borderColor: "border-blue-500/20 hover:border-blue-500/40"
        }
    ];

    const socialLinks = [
        { icon: Facebook, href: "https://facebook.com/raan.app", label: "فيسبوك", color: "bg-blue-600" },
        { icon: Instagram, href: "https://instagram.com/raan.app", label: "انستغرام", color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500" },
        { icon: MessageSquare, href: "https://t.me/raan_1_bot", label: "تيليجرام", color: "bg-sky-500" }
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.phone || !formData.message) {
            toast.error("يرجى ملء الحقول المطلوبة");
            return;
        }

        setIsSubmitting(true);

        // Simulate sending message
        await new Promise(resolve => setTimeout(resolve, 1500));

        setIsSubmitting(false);
        setIsSubmitted(true);
        toast.success("تم إرسال رسالتك بنجاح! سنتواصل معك قريباً");

        // Reset form after 3 seconds
        setTimeout(() => {
            setFormData({ name: "", phone: "", email: "", subject: "", message: "" });
            setIsSubmitted(false);
        }, 3000);
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-gradient-to-br from-primary via-primary/90 to-emerald-600 p-4 pt-8 pb-24 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500 via-blue-400 to-blue-300" style={{
                        backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
                        backgroundSize: '30px 30px'
                    }} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <Link to="/rider">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                            >
                                <ArrowRight className="w-5 h-5" />
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold text-white">الاتصال و المساعدة</h1>
                    </div>

                    <div className="text-center">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/10 backdrop-blur-lg flex items-center justify-center"
                        >
                            <Headphones className="w-10 h-10 text-white" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-white mb-2">نحن هنا لمساعدتك</h2>
                        <p className="text-white/80 text-sm">فريق دعم ران متاح على مدار الساعة</p>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3 -mt-12">
                <div className="flex gap-2 justify-center max-w-md mx-auto">
                    <motion.button
                        onClick={() => setActiveTab("help")}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
                            activeTab === "help"
                                ? "bg-primary text-white shadow-md"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <HelpCircle className="w-4 h-4" />
                            المساعدة
                        </div>
                    </motion.button>
                    <motion.button
                        onClick={() => setActiveTab("contact")}
                        className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${
                            activeTab === "contact"
                                ? "bg-primary text-white shadow-md"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Phone className="w-4 h-4" />
                            تواصل معنا
                        </div>
                    </motion.button>
                </div>
            </div>

            {/* Main Content */}
            <main className="px-4 pb-8">
                {/* Help Tab */}
                {activeTab === "help" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4 mt-6"
                    >
                        {/* Contact Methods in Help */}
                        <div className="space-y-3 mb-6">
                            <h3 className="text-lg font-bold px-2">طرق التواصل السريعة</h3>
                            {contactMethods.map((method, index) => (
                                <motion.a
                                    key={index}
                                    href={method.href}
                                    target={method.href.startsWith('http') ? '_blank' : undefined}
                                    rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br ${method.color} border ${method.borderColor} transition-all`}
                                >
                                    <div className={`w-10 h-10 rounded-lg bg-white/80 dark:bg-card flex items-center justify-center`}>
                                        <method.icon className={`w-5 h-5 ${method.iconColor}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-foreground">{method.title}</p>
                                        <p className="text-xs text-muted-foreground">{method.subtitle}</p>
                                    </div>
                                </motion.a>
                            ))}
                        </div>

                        {/* FAQs */}
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold px-2">الأسئلة الشائعة</h3>
                            {faqs.map((faq, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                >
                                    <Card
                                        className="cursor-pointer hover:border-primary/40 transition-all"
                                        onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                    <faq.icon className="w-5 h-5 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="font-bold text-foreground">{faq.title}</p>
                                                        <motion.div
                                                            animate={{ rotate: expandedFAQ === index ? 180 : 0 }}
                                                            transition={{ duration: 0.3 }}
                                                        >
                                                            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                                        </motion.div>
                                                    </div>
                                                    {expandedFAQ === index && (
                                                        <motion.p
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="text-sm text-muted-foreground mt-3"
                                                        >
                                                            {faq.answer}
                                                        </motion.p>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>

                        {/* Emergency Section */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-8 mb-6"
                        >
                            <h3 className="text-lg font-bold mb-3 px-2 text-red-600">حالات الطوارئ</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <motion.a
                                    href="tel:112"
                                    className="bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center hover:border-red-500/40 transition-all"
                                    whileHover={{ y: -5 }}
                                >
                                    <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                                    <p className="font-bold text-red-600">شرطة</p>
                                    <p className="text-xs text-muted-foreground mt-1">112</p>
                                </motion.a>
                                <motion.a
                                    href="tel:113"
                                    className="bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/20 rounded-2xl p-4 text-center hover:border-red-500/40 transition-all"
                                    whileHover={{ y: -5 }}
                                >
                                    <Ambulance className="w-8 h-8 text-red-600 mx-auto mb-2" />
                                    <p className="font-bold text-red-600">إسعاف</p>
                                    <p className="text-xs text-muted-foreground mt-1">113</p>
                                </motion.a>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Contact Tab */}
                {activeTab === "contact" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6 mt-6"
                    >
                        {/* Contact Methods */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="space-y-3"
                        >
                            {contactMethods.map((method, index) => (
                                <motion.a
                                    key={index}
                                    href={method.href}
                                    target={method.href.startsWith('http') ? '_blank' : undefined}
                                    rel={method.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br ${method.color} border ${method.borderColor} transition-all shadow-sm hover:shadow-md`}
                                >
                                    <div className={`w-12 h-12 rounded-xl bg-white/80 dark:bg-card flex items-center justify-center shadow-sm`}>
                                        <method.icon className={`w-6 h-6 ${method.iconColor}`} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-foreground">{method.title}</p>
                                        <p className="text-sm text-muted-foreground">{method.subtitle}</p>
                                    </div>
                                    <div className="text-left">
                                        <p className={`font-medium text-sm ${method.title === 'واتساب' ? 'text-white dark:text-foreground' : method.iconColor}`} dir="ltr">{method.value}</p>
                                    </div>
                                </motion.a>
                            ))}
                        </motion.div>

                        {/* Working Hours */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                            <Clock className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground">ساعات العمل</p>
                                            <p className="text-sm text-muted-foreground">الدعم الفني متاح <span className="text-amber-600 font-bold">24/7</span></p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Contact Form */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <Send className="w-5 h-5 text-primary" />
                                أرسل لنا رسالة
                            </h3>

                            <Card>
                                <CardContent className="p-5">
                                    {isSubmitted ? (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="py-8 text-center"
                                        >
                                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                                            </div>
                                            <h4 className="text-lg font-bold mb-2">تم إرسال رسالتك!</h4>
                                            <p className="text-muted-foreground">سنتواصل معك في أقرب وقت ممكن</p>
                                        </motion.div>
                                    ) : (
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-2">
                                                    <Label htmlFor="name" className="text-sm">الاسم *</Label>
                                                    <Input
                                                        id="name"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                        placeholder="اسمك الكريم"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="phone" className="text-sm">رقم الهاتف *</Label>
                                                    <Input
                                                        id="phone"
                                                        type="tel"
                                                        dir="ltr"
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                                        placeholder="07XXXXXXXX"
                                                        required
                                                    />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email" className="text-sm">البريد الإلكتروني (اختياري)</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    dir="ltr"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                                    placeholder="example@email.com"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="subject" className="text-sm">الموضوع</Label>
                                                <Input
                                                    id="subject"
                                                    value={formData.subject}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                                    placeholder="استفسار عن..."
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="message" className="text-sm">الرسالة *</Label>
                                                <Textarea
                                                    id="message"
                                                    value={formData.message}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                                                    placeholder="اكتب رسالتك هنا..."
                                                    rows={4}
                                                    required
                                                />
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full h-12 text-lg font-bold"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin ml-2" />
                                                        جاري الإرسال...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-5 h-5 ml-2" />
                                                        إرسال الرسالة
                                                    </>
                                                )}
                                            </Button>
                                        </form>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Social Media */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <h3 className="text-lg font-bold mb-4 text-center">تابعنا على</h3>
                            <div className="flex justify-center gap-4">
                                {socialLinks.map((social, index) => (
                                    <motion.a
                                        key={index}
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        whileHover={{ scale: 1.1, y: -5 }}
                                        whileTap={{ scale: 0.95 }}
                                        className={`w-14 h-14 rounded-2xl ${social.color} flex items-center justify-center shadow-lg text-white`}
                                    >
                                        <social.icon className="w-6 h-6" />
                                    </motion.a>
                                ))}
                            </div>
                        </motion.div>

                        {/* Office Location */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                        >
                            <Card className="border-border/30">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <MapPin className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground">المكتب الرئيسي</p>
                                            <p className="text-sm text-muted-foreground">الرمادي، محافظة الأنبار، العراق</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </motion.div>
                )}

                {/* Footer */}
                <div className="text-center py-8 text-sm text-muted-foreground">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <img src={logo} alt="RAAN" className="w-6 h-6" />
                        <span className="font-bold">ران RAAN</span>
                    </div>
                    <p>نسعى دائماً لخدمتكم بأفضل طريقة 💚</p>
                </div>
            </main>
        </div>
    );
};

export default HelpAndContact;
