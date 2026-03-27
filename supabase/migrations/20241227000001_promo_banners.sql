-- جدول العروض الترويجية
-- قم بتنفيذ هذا في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS promo_banners (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    subtitle VARCHAR(200),
    button_text VARCHAR(50),
    discount_value VARCHAR(20),
    discount_label VARCHAR(50),
    gradient_from VARCHAR(30) DEFAULT 'green-600',
    gradient_via VARCHAR(30) DEFAULT 'emerald-500',
    gradient_to VARCHAR(30) DEFAULT 'teal-600',
    icon_type VARCHAR(20) DEFAULT 'sparkles',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    link_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- تفعيل RLS
ALTER TABLE promo_banners ENABLE ROW LEVEL SECURITY;

-- سياسة القراءة للجميع (العروض النشطة فقط)
CREATE POLICY "Anyone can view active banners" ON promo_banners
    FOR SELECT USING (is_active = true);

-- سياسة الإدارة للأدمن فقط
CREATE POLICY "Admins can manage banners" ON promo_banners
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- إدخال بيانات افتراضية
INSERT INTO promo_banners (title, subtitle, button_text, discount_value, discount_label, is_active, display_order, gradient_from, gradient_via, gradient_to, icon_type)
VALUES 
('عروض مذهلة!', 'تسوق الآن واحصل على خصم', 'اجعل الرياض', '40%', 'خصم على', true, 1, 'green-600', 'emerald-500', 'teal-600', 'sparkles'),
('رحلات VIP', 'استمتع برفاهية السفر مع سائقينا المميزين', 'احجز الآن', '25%', 'خصم خاص', true, 2, 'purple-600', 'violet-500', 'indigo-600', 'crown');
