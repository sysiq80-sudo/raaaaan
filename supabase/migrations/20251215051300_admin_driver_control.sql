-- ======================================
-- إضافة تحكم الأدمن في تفعيل السائقين
-- ======================================
-- إضافة حقل للتحكم الإجباري من الأدمن
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS admin_controlled BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS admin_activated BOOLEAN DEFAULT true;
-- تحديث السائقين الموجودين
UPDATE public.drivers
SET admin_controlled = false,
    admin_activated = true
WHERE admin_controlled IS NULL;
-- إنشاء دالة للتحكم في تفعيل السائق من الأدمن
CREATE OR REPLACE FUNCTION public.admin_toggle_driver_activation(
        p_driver_id UUID,
        p_is_active BOOLEAN,
        p_admin_user_id UUID
    ) RETURNS BOOLEAN AS $$
DECLARE v_is_admin BOOLEAN;
BEGIN -- التحقق من أن المستخدم أدمن
SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = p_admin_user_id
            AND role = 'admin'
    ) INTO v_is_admin;
IF NOT v_is_admin THEN RAISE EXCEPTION 'غير مصرح لك بهذا الإجراء';
END IF;
-- تحديث حالة السائق
UPDATE public.drivers
SET admin_controlled = true,
    admin_activated = p_is_active,
    is_available = CASE
        WHEN p_is_active THEN is_available
        ELSE false
    END,
    updated_at = now()
WHERE id = p_driver_id;
RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
-- إنشاء trigger لمنع السائق من تفعيل نفسه إذا كان تحت التحكم الإجباري
CREATE OR REPLACE FUNCTION public.prevent_driver_self_activation() RETURNS TRIGGER AS $$ BEGIN -- إذا كان السائق تحت التحكم الإجباري ومعطل من الأدمن
    IF NEW.admin_controlled = true
    AND NEW.admin_activated = false THEN -- منع تفعيل is_available
    IF NEW.is_available = true
    AND OLD.is_available = false THEN RAISE EXCEPTION 'لا يمكنك تفعيل حسابك. يرجى التواصل مع الإدارة';
END IF;
-- فرض is_available = false
NEW.is_available = false;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
-- إنشاء trigger
DROP TRIGGER IF EXISTS check_driver_activation ON public.drivers;
CREATE TRIGGER check_driver_activation BEFORE
UPDATE ON public.drivers FOR EACH ROW
    WHEN (
        OLD.is_available IS DISTINCT
        FROM NEW.is_available
            OR OLD.admin_activated IS DISTINCT
        FROM NEW.admin_activated
    ) EXECUTE FUNCTION public.prevent_driver_self_activation();
-- إضافة index للأداء
CREATE INDEX IF NOT EXISTS idx_drivers_admin_controlled ON public.drivers(admin_controlled, admin_activated);
-- تعليقات
COMMENT ON COLUMN public.drivers.admin_controlled IS 'هل السائق تحت التحكم الإجباري من الأدمن';
COMMENT ON COLUMN public.drivers.admin_activated IS 'هل السائق مفعّل من قبل الأدمن (عند التحكم الإجباري)';
COMMENT ON FUNCTION public.admin_toggle_driver_activation IS 'تفعيل/تعطيل السائق من قبل الأدمن فقط';
COMMENT ON FUNCTION public.prevent_driver_self_activation IS 'منع السائق من تفعيل نفسه عند التحكم الإجباري';