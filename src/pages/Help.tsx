/**
 * ران - صفحة المساعدة والدعم
 * تجلب بيانات الاتصال من إعدادات الأدمن (app_settings[support])
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Phone,
    MessageCircle,
    Mail,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    Car,
    CreditCard,
    MapPin,
    Shield,
    Clock,
    Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSupportSettings } from "@/hooks/useSupportSettings";

// الأسئلة الشائعة
const faqs = [
    {
        question: "كيف أحجز رحلة؟",
        answer: "افتح التطبيق، حدد وجهتك في شريط البحث أو من الخريطة، اختر نوع السيارة، ثم اضغط 'احجز الآن'. سيتم البحث عن سائق قريب منك.",
        icon: Car
    },
    {
        question: "ما هي طرق الدفع المتاحة؟",
        answer: "نقبل الدفع نقداً، زين كاش، آسيا حوالة، وكي كارد. يمكنك اختيار طريقة الدفع المفضلة قبل حجز الرحلة.",
        icon: CreditCard
    },
    {
        question: "كيف أغيّر موقع الانطلاق أو الوجهة؟",
        answer: "اضغط على 'تغيير' بجانب الموقع الذي تريد تعديله، أو اسحب الدبوس على الخريطة لتحديد موقع جديد.",
        icon: MapPin
    },
    {
        question: "ماذا أفعل إذا نسيت شيئاً في السيارة؟",
        answer: "اذهب إلى 'رحلاتي' واضغط على الرحلة المعنية، ثم تواصل مع السائق مباشرة أو اتصل بالدعم الفني.",
        icon: HelpCircle
    },
    {
        question: "كيف أضمن سلامتي أثناء الرحلة؟",
        answer: "شارك رابط رحلتك مع عائلتك، استخدم زر الطوارئ عند الحاجة، وتأكد من مطابقة رقم السيارة ووجه السائق قبل الركوب.",
        icon: Shield
    },
    {
        question: "كم يستغرق وصول السائق؟",
        answer: "يعتمد على توفر السائقين في منطقتك. عادةً بين 3-10 دقائق. سترى وقت الوصول المتوقع عند قبول السائق للرحلة.",
        icon: Clock
    },
    {
        question: "كيف أقيّم السائق؟",
        answer: "بعد انتهاء الرحلة، ستظهر شاشة التقييم تلقائياً. اختر عدد النجوم واكتب تعليقاً اختيارياً لمساعدتنا في تحسين الخدمة.",
        icon: Star
    }
];

const Help = () => {
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const { support } = useSupportSettings();

    // تنسيق رقم الهاتف للروابط
    const phoneLink = support.phone.replace(/\s/g, '');
    const whatsappNumber = (support.whatsapp || support.phone).replace(/[\s+]/g, '');

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Link to="/rider" className="p-2 -m-2 hover:bg-secondary rounded-lg transition-colors">
                        <ArrowRight className="w-6 h-6" />
                    </Link>
                    <h1 className="text-xl font-bold">المساعدة والدعم</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-6 space-y-8">
                {/* Contact Cards */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.a
                        href={`tel:${phoneLink}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 hover:border-primary/40 transition-all"
                    >
                        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Phone className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">اتصل بنا</p>
                            <p className="text-sm text-muted-foreground">متاح 24/7</p>
                        </div>
                    </motion.a>

                    <motion.a
                        href={`https://wa.me/${whatsappNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20 hover:border-green-500/40 transition-all"
                    >
                        <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                            <MessageCircle className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">واتساب</p>
                            <p className="text-sm text-muted-foreground">رد سريع</p>
                        </div>
                    </motion.a>

                    <motion.a
                        href={`mailto:${support.email}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                    >
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                            <Mail className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="font-bold text-lg">البريد الإلكتروني</p>
                            <p className="text-sm text-muted-foreground">{support.email}</p>
                        </div>
                    </motion.a>
                </section>

                {/* FAQs */}
                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-primary" />
                        الأسئلة الشائعة
                    </h2>
                    <div className="space-y-3">
                        {faqs.map((faq, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                <Card className="overflow-hidden">
                                    <button
                                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                        className="w-full p-4 flex items-center gap-3 text-right hover:bg-secondary/50 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <faq.icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <span className="flex-1 font-medium">{faq.question}</span>
                                        {expandedFaq === index ? (
                                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                        )}
                                    </button>
                                    {expandedFaq === index && (
                                        <CardContent className="pt-0 pb-4 px-4">
                                            <div className="pr-13 text-muted-foreground leading-relaxed">
                                                {faq.answer}
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                </section>

                {/* Emergency */}
                <section>
                    <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20">
                        <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
                                    <Shield className="w-6 h-6 text-destructive" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg mb-2">في حالة الطوارئ</h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        إذا كنت في خطر أثناء الرحلة، استخدم زر الطوارئ في التطبيق أو اتصل مباشرة بالشرطة.
                                    </p>
                                    <div className="flex gap-3">
                                        <a href="tel:104" className="flex-1">
                                            <Button variant="destructive" className="w-full">
                                                الشرطة 104
                                            </Button>
                                        </a>
                                        <a href="tel:115" className="flex-1">
                                            <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
                                                الإسعاف 115
                                            </Button>
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* Footer */}
                <div className="text-center py-6 text-sm text-muted-foreground">
                    <p>نسعى دائماً لخدمتكم بأفضل طريقة</p>
                    <p className="mt-1">فريق دعم ران 💚</p>
                </div>
            </main>
        </div>
    );
};

export default Help;
