-- إضافة عمود user_id لدعم إشعارات الركاب
-- push_subscriptions كان يدعم السائقين فقط (driver_id)
-- الآن يمكن للركاب أيضاً تسجيل اشتراكات push

ALTER TABLE push_subscriptions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- فهرس للبحث السريع عن اشتراكات الركاب
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
ON push_subscriptions(user_id) WHERE user_id IS NOT NULL;

-- سياسة RLS للركاب (يمكنهم إدارة اشتراكاتهم الخاصة)
CREATE POLICY "Users can manage their own push subscriptions"
ON push_subscriptions
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- تحديث القيد الفريد ليشمل user_id
-- (لا نلغي القديم لأن السائقين ما زالوا يستخدمونه)
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint
ON push_subscriptions(user_id, endpoint) WHERE user_id IS NOT NULL;
