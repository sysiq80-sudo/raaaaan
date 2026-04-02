-- ======================================
-- ران - إصلاح: إضافة مكافآت المحفظة لنظام الإحالات
-- ======================================

-- تحديث دالة إكمال الإحالة لتشمل إضافة المكافآت للمحافظ
CREATE OR REPLACE FUNCTION public.complete_referral_on_first_ride()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_referral RECORD;
    v_ride_count INTEGER;
BEGIN
    -- تحقق من أن الرحلة مكتملة
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- احسب عدد رحلات المستخدم
        SELECT COUNT(*) INTO v_ride_count
        FROM public.rides
        WHERE rider_id = NEW.rider_id AND status = 'completed';
        
        -- إذا كانت هذه أول رحلة
        IF v_ride_count = 1 THEN
            -- ابحث عن إحالة معلقة
            SELECT * INTO v_referral
            FROM public.referrals
            WHERE referred_id = NEW.rider_id AND status = 'pending';
            
            IF v_referral IS NOT NULL THEN
                -- أكمل الإحالة
                UPDATE public.referrals
                SET status = 'completed', completed_at = now()
                WHERE id = v_referral.id;
                
                -- حدث إحصائيات المُحيل
                UPDATE public.referral_codes
                SET 
                    total_referrals = total_referrals + 1,
                    total_earned = total_earned + v_referral.referrer_reward
                WHERE user_id = v_referral.referrer_id;
                
                -- أضف مكافأة المُحيل للمحفظة
                UPDATE public.profiles
                SET wallet_balance = COALESCE(wallet_balance, 0) + v_referral.referrer_reward
                WHERE user_id = v_referral.referrer_id;
                
                -- أضف مكافأة المُحال للمحفظة
                UPDATE public.profiles
                SET wallet_balance = COALESCE(wallet_balance, 0) + v_referral.referred_reward
                WHERE user_id = v_referral.referred_id;
                
                -- سجل المعاملات المالية
                INSERT INTO public.wallet_transactions (user_id, amount, type, description, reference_id)
                VALUES 
                    (v_referral.referrer_id, v_referral.referrer_reward, 'referral_reward', 'مكافأة إحالة صديق', v_referral.id),
                    (v_referral.referred_id, v_referral.referred_reward, 'referral_reward', 'مكافأة التسجيل بكود إحالة', v_referral.id);
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.complete_referral_on_first_ride IS 'إكمال الإحالة وإضافة المكافآت للمحافظ بعد أول رحلة';
