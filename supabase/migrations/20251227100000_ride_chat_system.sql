-- ======================================
-- ران - نظام الدردشة في الرحلة
-- ======================================

-- جدول الرسائل
CREATE TABLE IF NOT EXISTS public.ride_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('rider', 'driver')),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- فهارس للبحث السريع
CREATE INDEX IF NOT EXISTS idx_ride_messages_ride_id ON public.ride_messages(ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_messages_created_at ON public.ride_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_ride_messages_sender_id ON public.ride_messages(sender_id);

-- Row Level Security
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

-- سياسة: المشاركون في الرحلة فقط يمكنهم رؤية الرسائل
DROP POLICY IF EXISTS "Ride participants can view messages" ON public.ride_messages;
CREATE POLICY "Ride participants can view messages"
    ON public.ride_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id
            AND (
                r.rider_id = auth.uid()
                OR r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
            )
        )
    );

-- سياسة: المشاركون يمكنهم إرسال رسائل
DROP POLICY IF EXISTS "Ride participants can send messages" ON public.ride_messages;
CREATE POLICY "Ride participants can send messages"
    ON public.ride_messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id
            AND r.status IN ('accepted', 'arrived', 'in_progress')
            AND (
                r.rider_id = auth.uid()
                OR r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
            )
        )
    );

-- سياسة: تحديث حالة القراءة
DROP POLICY IF EXISTS "Recipients can mark as read" ON public.ride_messages;
CREATE POLICY "Recipients can mark as read"
    ON public.ride_messages FOR UPDATE
    USING (
        sender_id != auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.rides r
            WHERE r.id = ride_id
            AND (
                r.rider_id = auth.uid()
                OR r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
            )
        )
    );

-- سياسة: الأدمن يمكنه رؤية كل الرسائل
DROP POLICY IF EXISTS "Admins can view all messages" ON public.ride_messages;
CREATE POLICY "Admins can view all messages"
    ON public.ride_messages FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

-- دالة إرسال رسالة
CREATE OR REPLACE FUNCTION public.send_ride_message(
    p_ride_id UUID,
    p_message TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_sender_type TEXT;
    v_ride RECORD;
    v_message_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'غير مسجل الدخول');
    END IF;
    
    -- التحقق من الرحلة
    SELECT * INTO v_ride FROM rides WHERE id = p_ride_id;
    IF v_ride IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'الرحلة غير موجودة');
    END IF;
    
    -- التحقق من حالة الرحلة
    IF v_ride.status NOT IN ('accepted', 'arrived', 'in_progress') THEN
        RETURN jsonb_build_object('success', false, 'error', 'لا يمكن إرسال رسائل في هذه المرحلة');
    END IF;
    
    -- تحديد نوع المرسل
    IF v_ride.rider_id = v_user_id THEN
        v_sender_type := 'rider';
    ELSIF EXISTS(SELECT 1 FROM drivers WHERE id = v_ride.driver_id AND user_id = v_user_id) THEN
        v_sender_type := 'driver';
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'ليس لديك صلاحية لهذه الرحلة');
    END IF;
    
    -- إدراج الرسالة
    INSERT INTO ride_messages (ride_id, sender_id, sender_type, message)
    VALUES (p_ride_id, v_user_id, v_sender_type, trim(p_message))
    RETURNING id INTO v_message_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message_id', v_message_id,
        'sender_type', v_sender_type
    );
END;
$$;

-- دالة الحصول على رسائل الرحلة
CREATE OR REPLACE FUNCTION public.get_ride_messages(p_ride_id UUID)
RETURNS TABLE (
    id UUID,
    sender_id UUID,
    sender_type TEXT,
    sender_name TEXT,
    message TEXT,
    is_read BOOLEAN,
    created_at TIMESTAMPTZ,
    is_mine BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rm.id,
        rm.sender_id,
        rm.sender_type,
        COALESCE(p.full_name, 'مستخدم') as sender_name,
        rm.message,
        rm.is_read,
        rm.created_at,
        (rm.sender_id = auth.uid()) as is_mine
    FROM ride_messages rm
    LEFT JOIN profiles p ON p.user_id = rm.sender_id
    WHERE rm.ride_id = p_ride_id
    ORDER BY rm.created_at ASC;
END;
$$;

-- دالة تحديث حالة القراءة
CREATE OR REPLACE FUNCTION public.mark_messages_as_read(p_ride_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE ride_messages
    SET is_read = true
    WHERE ride_id = p_ride_id
    AND sender_id != auth.uid()
    AND is_read = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- تمكين Realtime للجدول
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;

-- صلاحيات
GRANT SELECT, INSERT, UPDATE ON public.ride_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_ride_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ride_messages TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read TO authenticated;

-- تعليقات
COMMENT ON TABLE public.ride_messages IS 'رسائل الدردشة بين الراكب والسائق';
COMMENT ON FUNCTION public.send_ride_message IS 'إرسال رسالة في الرحلة';
COMMENT ON FUNCTION public.get_ride_messages IS 'الحصول على رسائل الرحلة';

SELECT 'تم إنشاء نظام الدردشة بنجاح! ✅' as message;
