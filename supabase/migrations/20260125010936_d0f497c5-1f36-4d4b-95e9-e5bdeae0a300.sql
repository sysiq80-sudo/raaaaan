-- إضافة عمود الأولوية للمناطق (القيمة الأعلى = أولوية أعلى)
ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN public.regions.priority IS 'أولوية المنطقة - المناطق الفرعية تأخذ أولوية أعلى من المناطق الرئيسية';