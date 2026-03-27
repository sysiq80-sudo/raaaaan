-- 1. جدول جهات الاتصال للطوارئ
CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Users can manage their own emergency contacts"
ON public.emergency_contacts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. جدول سجل الطوارئ
CREATE TABLE public.emergency_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ride_id UUID REFERENCES public.rides,
  location JSONB NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- تفعيل RLS
ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Users can create their own alerts"
ON public.emergency_alerts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own alerts"
ON public.emergency_alerts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all alerts"
ON public.emergency_alerts FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- 3. جدول روابط مشاركة الرحلة
CREATE TABLE public.ride_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.ride_share_links ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول - الروابط عامة للقراءة بواسطة الـ token
CREATE POLICY "Anyone can read share links by token"
ON public.ride_share_links FOR SELECT
USING (true);

CREATE POLICY "Riders can create share links for their rides"
ON public.ride_share_links FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rides 
    WHERE id = ride_id AND rider_id = auth.uid()
  )
);

-- 4. جدول الرسائل
CREATE TABLE public.ride_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID REFERENCES public.rides NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('rider', 'driver')),
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- تفعيل RLS
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;

-- سياسات الوصول
CREATE POLICY "Ride participants can view messages"
ON public.ride_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_id AND (
      r.rider_id = auth.uid() OR
      r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    )
  )
);

CREATE POLICY "Ride participants can send messages"
ON public.ride_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.id = ride_id AND (
      r.rider_id = auth.uid() OR
      r.driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    )
  )
);

-- 5. فهارس لتحسين الأداء
CREATE INDEX idx_emergency_contacts_user ON public.emergency_contacts(user_id);
CREATE INDEX idx_emergency_alerts_user ON public.emergency_alerts(user_id);
CREATE INDEX idx_ride_share_links_token ON public.ride_share_links(token);
CREATE INDEX idx_ride_messages_ride ON public.ride_messages(ride_id);

-- 6. تفعيل Realtime للرسائل
ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;