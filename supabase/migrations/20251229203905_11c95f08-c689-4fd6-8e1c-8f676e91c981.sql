-- إضافة عمود region_id لجدول promo_banners للاستهداف حسب المنطقة
ALTER TABLE promo_banners 
ADD COLUMN IF NOT EXISTS region_id uuid REFERENCES regions(id) ON DELETE SET NULL;

-- إنشاء index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_promo_banners_region ON promo_banners(region_id);

COMMENT ON COLUMN promo_banners.region_id IS 'المنطقة المستهدفة - NULL يعني جميع المناطق';