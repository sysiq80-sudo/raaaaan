/**
 * ران - صفحة عن التطبيق
 * تعرض معلومات عن التطبيق والفريق
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    ArrowLeft,
    Shield,
    Zap,
    Heart,
    MapPin,
    Users,
    Star,
    Phone,
    Mail,
    Facebook,
    Instagram,
    Twitter,
    Globe,
    CheckCircle
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { APP_INFO } from '@/lib/constants';

const About: React.FC = () => {
    const features = [
        {
            icon: <MapPin className="w-6 h-6" />,
            title: 'نقاط دالة محلية',
            description: 'نفهم شوارع الأنبار ونستخدم أسماء المعالم المعروفة',
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: 'أمان متقدم',
            description: 'جميع سائقينا معتمدون ومتحقق من هوياتهم',
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: 'سرعة وخفة',
            description: 'التطبيق يعمل حتى مع ضعف الإنترنت',
        },
        {
            icon: <Heart className="w-6 h-6" />,
            title: 'تاكسي نسائي',
            description: 'سائقات محترفات للنساء فقط',
        },
    ];

    const stats = [
        { number: '+50K', label: 'راكب' },
        { number: '+10K', label: 'سائق' },
        { number: '+1M', label: 'رحلة' },
        { number: '4.9', label: 'تقييم' },
    ];

    const team = [
        { name: 'فريق التطوير', role: 'تصميم وبرمجة التطبيق' },
        { name: 'فريق العمليات', role: 'إدارة السائقين والدعم' },
        { name: 'فريق خدمة العملاء', role: 'دعم الركاب على مدار الساعة' },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="bg-gradient-primary p-4 pt-8 pb-20 relative overflow-hidden">
                <div className="absolute inset-0 dots-pattern opacity-20" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <Link to="/">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold text-white">عن ران</h1>
                    </div>

                    <div className="text-center">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.5 }}
                            className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-white/10 backdrop-blur-lg flex items-center justify-center p-2"
                        >
                            <img src={logo} alt="RAAN" className="w-16 h-16" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {APP_INFO.name} <span className="text-white/80">{APP_INFO.nameEn}</span>
                        </h2>
                        <p className="text-white/80 text-sm">
                            الإصدار {APP_INFO.version}
                        </p>
                    </div>
                </div>
            </header>

            {/* المحتوى */}
            <main className="px-4 -mt-12 relative z-20 pb-8">
                {/* الوصف */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <Card className="border-primary/20 mb-6">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold mb-3">رحلتنا</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                ران هو تطبيق تاكسي ذكي مصمم خصيصاً لمحافظة الأنبار في العراق.
                                بدأنا رحلتنا بهدف توفير وسيلة نقل آمنة ومريحة وبأسعار عادلة
                                لأهلنا في الأنبار. نحن نفهم طبيعة المنطقة ونعرف شوارعها
                                ومعالمها، لذلك صممنا تطبيقاً يتحدث لغة الأنباريين.
                            </p>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* الإحصائيات */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="grid grid-cols-4 gap-3 mb-6"
                >
                    {stats.map((stat, index) => (
                        <Card key={index} className="border-border/30">
                            <CardContent className="p-4 text-center">
                                <p className="text-xl font-bold text-primary">{stat.number}</p>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                            </CardContent>
                        </Card>
                    ))}
                </motion.div>

                {/* المميزات */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mb-6"
                >
                    <h3 className="text-lg font-bold mb-4">لماذا ران؟</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {features.map((feature, index) => (
                            <Card key={index} className="border-border/30">
                                <CardContent className="p-4">
                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                                        {feature.icon}
                                    </div>
                                    <h4 className="font-bold text-sm mb-1">{feature.title}</h4>
                                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </motion.div>

                {/* قيمنا */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="mb-6"
                >
                    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-bold mb-4">قيمنا</h3>
                            <div className="space-y-3">
                                {[
                                    'الأمان أولاً - سلامتك هي أولويتنا',
                                    'الشفافية - أسعار واضحة بدون مفاجآت',
                                    'الجودة - نختار أفضل السائقين',
                                    'المحلية - نفهم احتياجات مجتمعنا',
                                ].map((value, index) => (
                                    <div key={index} className="flex items-center gap-3">
                                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                                        <span className="text-sm">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* تواصل معنا */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mb-6"
                >
                    <h3 className="text-lg font-bold mb-4">تواصل معنا</h3>
                    <Card className="border-border/30">
                        <CardContent className="p-4 space-y-4">
                            <a
                                href={`tel:${APP_INFO.phone}`}
                                className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Phone className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">الهاتف</p>
                                    <p className="font-medium text-foreground" dir="ltr">{APP_INFO.phone}</p>
                                </div>
                            </a>

                            <a
                                href={`mailto:${APP_INFO.email}`}
                                className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">البريد الإلكتروني</p>
                                    <p className="font-medium text-foreground">{APP_INFO.email}</p>
                                </div>
                            </a>

                            <a
                                href={APP_INFO.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors"
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <Globe className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">الموقع</p>
                                    <p className="font-medium text-foreground">{APP_INFO.website}</p>
                                </div>
                            </a>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* الشبكات الاجتماعية */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="mb-6"
                >
                    <h3 className="text-lg font-bold mb-4">تابعنا</h3>
                    <div className="flex gap-3 justify-center">
                        <Button variant="outline" size="icon" className="w-12 h-12 rounded-xl">
                            <Facebook className="w-5 h-5" />
                        </Button>
                        <Button variant="outline" size="icon" className="w-12 h-12 rounded-xl">
                            <Instagram className="w-5 h-5" />
                        </Button>
                        <Button variant="outline" size="icon" className="w-12 h-12 rounded-xl">
                            <Twitter className="w-5 h-5" />
                        </Button>
                    </div>
                </motion.div>

                {/* القسم القانوني */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                >
                    <div className="flex gap-4 justify-center text-sm">
                        <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                            الشروط والأحكام
                        </Link>
                        <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                            سياسة الخصوصية
                        </Link>
                    </div>

                    <p className="text-center text-xs text-muted-foreground mt-6">
                        © 2024 ران RAAN. جميع الحقوق محفوظة.
                    </p>
                </motion.div>
            </main>
        </div>
    );
};

export default About;
