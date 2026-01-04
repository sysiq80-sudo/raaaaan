/**
 * ران - صفحة تواصل معنا
 * صفحة احترافية للتواصل مع فريق الدعم
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
    Headphones
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { APP_INFO } from "@/lib/constants";
import logo from "@/assets/logo.png";

const ContactUs = () => {
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        subject: "",
        message: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

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
        { icon: Facebook, href: "#", label: "فيسبوك", color: "bg-blue-600" },
        { icon: Instagram, href: "#", label: "انستغرام", color: "bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500" },
        { icon: MessageSquare, href: "#", label: "تيليجرام", color: "bg-sky-500" }
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-gradient-to-br from-primary via-primary/90 to-emerald-600 p-4 pt-8 pb-24 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute inset-0" style={{
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
                        <h1 className="text-xl font-bold text-white">تواصل معنا</h1>
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

            {/* Main Content */}
            <main className="px-4 -mt-16 relative z-20 pb-8">
                {/* Contact Methods */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="grid gap-3 mb-6"
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
                                <p className={`font-medium ${method.iconColor}`} dir="ltr">{method.value}</p>
                            </div>
                        </motion.a>
                    ))}
                </motion.div>

                {/* Working Hours */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-6"
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
                    transition={{ delay: 0.4 }}
                    className="mb-6"
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="name">الاسم *</Label>
                                            <Input
                                                id="name"
                                                value={formData.name}
                                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                                placeholder="اسمك الكريم"
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="phone">رقم الهاتف *</Label>
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
                                        <Label htmlFor="email">البريد الإلكتروني (اختياري)</Label>
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
                                        <Label htmlFor="subject">الموضوع</Label>
                                        <Input
                                            id="subject"
                                            value={formData.subject}
                                            onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                                            placeholder="استفسار عن..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="message">الرسالة *</Label>
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
                    className="mb-6"
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

export default ContactUs;
