/**
 * ران - صفحة عن التطبيق
 * واجهة هندسية فاخرة (Premium Dark Luxury)
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowRight,
    Shield,
    Zap,
    Heart,
    MapPin,
    Star,
    Phone,
    Mail,
    Globe,
    CheckCircle,
    Cpu,
    Users,
    Clock,
    Award,
    ExternalLink,
} from 'lucide-react';
import logo from '@/assets/logo.png';
import { APP_INFO } from '@/lib/constants';

// ── Animation Variants ──
const stagger = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

const About: React.FC = () => {
    const navigate = useNavigate();

    const features = [
        {
            icon: <MapPin className="w-6 h-6" />,
            title: 'نقاط دالة محلية',
            description: 'نفهم شوارع الأنبار ونستخدم أسماء المعالم المعروفة',
            gradient: 'from-emerald-500/20 to-teal-500/10',
            border: 'border-emerald-500/20',
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: 'أمان متقدم',
            description: 'جميع سائقينا معتمدون ومتحقق من هوياتهم',
            gradient: 'from-sky-500/20 to-blue-500/10',
            border: 'border-sky-500/20',
        },
        {
            icon: <Zap className="w-6 h-6" />,
            title: 'سرعة وخفة',
            description: 'التطبيق يعمل حتى مع ضعف الإنترنت',
            gradient: 'from-amber-500/20 to-orange-500/10',
            border: 'border-amber-500/20',
        },
        {
            icon: <Heart className="w-6 h-6" />,
            title: 'تاكسي نسائي',
            description: 'سائقات محترفات للنساء فقط',
            gradient: 'from-pink-500/20 to-rose-500/10',
            border: 'border-pink-500/20',
        },
    ];

    const stats = [
        { number: '24/7', label: 'خدمة متواصلة', icon: <Clock className="w-5 h-5" /> },
        { number: '+40', label: 'كابتن معتمد', icon: <Users className="w-5 h-5" /> },
        { number: 'AI', label: 'حجز ذكي', icon: <Cpu className="w-5 h-5" /> },
        { number: '4.9', label: 'تقييم عام', icon: <Award className="w-5 h-5" /> },
    ];

    const values = [
        { text: 'الأمان أولاً — سلامتك هي أولويتنا', color: '#5bdda6' },
        { text: 'الشفافية — أسعار واضحة بدون مفاجآت', color: '#60a5fa' },
        { text: 'الجودة — نختار أفضل السائقين', color: '#fbbf24' },
        { text: 'المحلية — نفهم احتياجات مجتمعنا', color: '#f472b6' },
    ];

    const contacts = [
        {
            icon: <Phone className="w-5 h-5" />,
            label: 'الهاتف',
            value: APP_INFO.phone,
            href: `tel:${APP_INFO.phone}`,
            color: '#5bdda6',
        },
        {
            icon: <Mail className="w-5 h-5" />,
            label: 'البريد الإلكتروني',
            value: APP_INFO.email,
            href: `mailto:${APP_INFO.email}`,
            color: '#60a5fa',
        },
        {
            icon: <Globe className="w-5 h-5" />,
            label: 'الموقع الرسمي',
            value: APP_INFO.website,
            href: APP_INFO.website,
            color: '#c084fc',
            external: true,
        },
    ];

    return (
        <div className="min-h-screen overflow-y-auto" dir="rtl" style={{ background: '#060d1b' }}>
            {/* ── Decorative Blurs ── */}
            <div className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full opacity-30" style={{ background: 'radial-gradient(circle, rgba(91,221,166,0.25), transparent 70%)' }} />
            <div className="pointer-events-none fixed -left-24 bottom-0 h-80 w-80 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.2), transparent 70%)' }} />

            {/* ── Header ── */}
            <header className="relative z-10 px-5 pt-[max(1.5rem,env(safe-area-inset-top))]">
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
                        style={{ background: 'rgba(91,221,166,0.08)', border: '1px solid rgba(91,221,166,0.15)' }}
                    >
                        <ArrowRight className="w-5 h-5" style={{ color: '#5bdda6' }} />
                    </button>
                    <h1 className="text-lg font-bold" style={{ color: '#e6edff' }}>عن ران</h1>
                    <div className="w-10" /> {/* Spacer */}
                </div>
            </header>

            {/* ── Hero / Logo ── */}
            <motion.section
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="relative z-10 px-5 text-center mb-10"
            >
                <motion.div variants={fadeUp} className="relative mx-auto mb-5 w-28 h-28">
                    <div className="absolute inset-0 rounded-3xl opacity-40" style={{ background: 'linear-gradient(135deg, #5bdda6, #3b82f6)', filter: 'blur(18px)' }} />
                    <div
                        className="relative w-full h-full rounded-3xl flex items-center justify-center p-3"
                        style={{ background: 'linear-gradient(145deg, #111d30, #0a1220)', border: '2px solid rgba(91,221,166,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                    >
                        <img src={logo} alt="RAAN" className="w-16 h-16" />
                    </div>
                </motion.div>

                <motion.h2 variants={fadeUp} className="text-3xl font-extrabold mb-2" style={{ color: '#e6edff' }}>
                    {APP_INFO.name} <span style={{ color: '#5bdda6' }}>{APP_INFO.nameEn}</span>
                </motion.h2>
                <motion.p variants={fadeUp} className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    الإصدار {APP_INFO.version}
                </motion.p>
                <motion.p variants={fadeUp} className="text-[13px] max-w-xs mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {APP_INFO.description}
                </motion.p>
            </motion.section>

            {/* ── Content ── */}
            <motion.main
                initial="hidden"
                animate="visible"
                variants={stagger}
                className="relative z-10 px-5 pb-[max(2rem,env(safe-area-inset-bottom))]"
            >
                {/* ── من نحن ── */}
                <motion.div variants={fadeUp}>
                    <div
                        className="rounded-2xl p-5 mb-6"
                        style={{ background: 'linear-gradient(180deg, #111b2e 0%, #0d1525 100%)', border: '1px solid rgba(91,221,166,0.1)', boxShadow: '0 4px 24px rgba(0,0,0,0.3)' }}
                    >
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(91,221,166,0.1)' }}>
                                <Star className="w-4 h-4" style={{ color: '#5bdda6' }} />
                            </div>
                            <h3 className="text-[17px] font-bold" style={{ color: '#e6edff' }}>من نحن</h3>
                        </div>
                        <div className="space-y-3">
                            <p className="text-[13px] leading-[1.8]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                كادر برمجي تابع إلى <span className="font-bold" style={{ color: '#5bdda6' }}>مركز الرؤية للتدريب والتطوير</span> في مدينة الرمادي.
                            </p>
                            <p className="text-[13px] leading-[1.8]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                وجدنا مشكلة حقيقية في عشوائية عمل التاكسي بالمدينة — لا تنظيم، لا أسعار ثابتة، ولا أمان كافي. فقررنا نلاقي حل سهل وسريع يخدم أهل الأنبار.
                            </p>
                            <p className="text-[13px] leading-[1.8]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                من هالفكرة وُلد <span className="font-extrabold" style={{ color: '#5bdda6' }}>ران RAAN</span> — أول تطبيق تاكسي بالعالم يعمل بالذكاء الاصطناعي. فكرة استثنائية تحل مشاكل التطبيقات الأخرى وتقدم تجربة فريدة مصممة خصيصاً لشوارع ومعالم الأنبار.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* ── الإحصائيات ── */}
                <motion.div variants={fadeUp} className="grid grid-cols-4 gap-2.5 mb-6">
                    {stats.map((stat, i) => (
                        <div
                            key={i}
                            className="rounded-xl p-3 text-center"
                            style={{ background: 'rgba(17,27,46,0.8)', border: '1px solid rgba(91,221,166,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.2)' }}
                        >
                            <div className="flex justify-center mb-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(91,221,166,0.1)' }}>
                                    {React.cloneElement(stat.icon, { style: { color: '#5bdda6' } })}
                                </div>
                            </div>
                            <p className="text-[18px] font-extrabold" style={{ color: '#5bdda6' }}>{stat.number}</p>
                            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{stat.label}</p>
                        </div>
                    ))}
                </motion.div>

                {/* ── لماذا ران؟ ── */}
                <motion.div variants={fadeUp} className="mb-6">
                    <h3 className="text-[17px] font-bold mb-4" style={{ color: '#e6edff' }}>لماذا ران؟</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {features.map((f, i) => (
                            <div
                                key={i}
                                className={`rounded-2xl p-4 bg-gradient-to-br ${f.gradient} ${f.border} border transition-all`}
                                style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.15)' }}
                            >
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    {React.cloneElement(f.icon, { style: { color: '#5bdda6' } })}
                                </div>
                                <h4 className="text-[14px] font-bold mb-1" style={{ color: '#e6edff' }}>{f.title}</h4>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>{f.description}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ── مركز الرؤية ── */}
                <motion.div variants={fadeUp}>
                    <div
                        className="rounded-2xl p-5 mb-6 relative overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, rgba(91,221,166,0.06), rgba(59,130,246,0.04))', border: '1px solid rgba(91,221,166,0.12)' }}
                    >
                        <div className="pointer-events-none absolute -left-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(91,221,166,0.08), transparent 70%)' }} />
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(91,221,166,0.12)', border: '1px solid rgba(91,221,166,0.15)' }}>
                                <Star className="w-5 h-5 fill-[#5bdda6]" style={{ color: '#5bdda6' }} />
                            </div>
                            <h3 className="text-[15px] font-bold" style={{ color: '#e6edff' }}>مركز الرؤية للتدريب والتطوير</h3>
                        </div>
                        <p className="text-[12px] leading-[1.9]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            مركز متخصص في التدريب التقني والبرمجي في مدينة الرمادي، يسعى لبناء كوادر عراقية قادرة على تطوير حلول تقنية محلية تلبي احتياجات المجتمع الأنباري.
                        </p>
                    </div>
                </motion.div>

                {/* ── قيمنا ── */}
                <motion.div variants={fadeUp} className="mb-6">
                    <div
                        className="rounded-2xl p-5"
                        style={{ background: 'linear-gradient(180deg, #111b2e 0%, #0d1525 100%)', border: '1px solid rgba(91,221,166,0.08)' }}
                    >
                        <h3 className="text-[17px] font-bold mb-4" style={{ color: '#e6edff' }}>قيمنا</h3>
                        <div className="space-y-3">
                            {values.map((v, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div
                                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                        style={{ background: `${v.color}15`, border: `1px solid ${v.color}25` }}
                                    >
                                        <CheckCircle className="w-4 h-4" style={{ color: v.color }} />
                                    </div>
                                    <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{v.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* ── تواصل معنا ── */}
                <motion.div variants={fadeUp} className="mb-6">
                    <h3 className="text-[17px] font-bold mb-4" style={{ color: '#e6edff' }}>تواصل معنا</h3>
                    <div className="space-y-3">
                        {contacts.map((c, i) => (
                            <a
                                key={i}
                                href={c.href}
                                target={c.external ? '_blank' : undefined}
                                rel={c.external ? 'noopener noreferrer' : undefined}
                                className="flex items-center gap-3.5 rounded-xl p-3.5 transition-all active:scale-[0.98]"
                                style={{ background: 'rgba(17,27,46,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}
                            >
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: `${c.color}12`, border: `1px solid ${c.color}20` }}
                                >
                                    {React.cloneElement(c.icon, { style: { color: c.color } })}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{c.label}</p>
                                    <p className="text-[14px] font-bold truncate" dir="ltr" style={{ color: '#e6edff' }}>{c.value}</p>
                                </div>
                                {c.external && <ExternalLink className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />}
                            </a>
                        ))}
                    </div>
                </motion.div>

                {/* ── تابعنا ── */}
                <motion.div variants={fadeUp} className="mb-8">
                    <h3 className="text-[17px] font-bold mb-4 text-center" style={{ color: '#e6edff' }}>تابعنا</h3>
                    <div className="flex gap-3 justify-center">
                        {[
                            { icon: '𝕏', label: 'X', bg: 'rgba(255,255,255,0.06)' },
                            { icon: '📸', label: 'Instagram', bg: 'rgba(225,48,108,0.08)' },
                            { icon: '📘', label: 'Facebook', bg: 'rgba(59,89,152,0.1)' },
                        ].map((s, i) => (
                            <button
                                key={i}
                                className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-all active:scale-95"
                                style={{ background: s.bg, border: '1px solid rgba(255,255,255,0.06)' }}
                                aria-label={s.label}
                            >
                                {s.icon}
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* ── Footer ── */}
                <motion.div variants={fadeUp} className="text-center space-y-4">
                    <div className="flex gap-6 justify-center">
                        <Link to="/terms" className="text-[13px] font-medium transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            الشروط والأحكام
                        </Link>
                        <Link to="/privacy" className="text-[13px] font-medium transition-colors" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            سياسة الخصوصية
                        </Link>
                    </div>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        © 2026 ران RAAN. جميع الحقوق محفوظة.
                    </p>
                </motion.div>
            </motion.main>
        </div>
    );
};

export default About;
