-- إضافة فهارس لتحسين الأداء

-- فهرس على coordinates في regions للبحث الجغرافي
CREATE INDEX idx_regions_coordinates ON public.regions USING GIN (coordinates);

-- فهرس على created_at في rides للبحث بالتاريخ
CREATE INDEX idx_rides_created_at ON public.rides (created_at);

-- فهرس على status في rides للبحث بالحالة
CREATE INDEX idx_rides_status ON public.rides (status);

-- فهرس على driver_id في rides للبحث برحلات السائق
CREATE INDEX idx_rides_driver_id ON public.rides (driver_id);

-- فهرس على rider_id في rides للبحث برحلات الراكب
CREATE INDEX idx_rides_rider_id ON public.rides (rider_id);

-- فهرس على user_id في profiles للبحث بالمستخدم
CREATE INDEX idx_profiles_user_id ON public.profiles (user_id);

-- فهرس على role في user_roles للبحث بالأدوار
CREATE INDEX idx_user_roles_role ON public.user_roles (role);