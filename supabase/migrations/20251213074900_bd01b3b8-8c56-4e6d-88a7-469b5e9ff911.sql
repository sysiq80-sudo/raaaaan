-- ======================================
-- منصة رايد - قاعدة البيانات الأساسية
-- ======================================

-- إنشاء أنواع التعداد
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.driver_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE public.ride_status AS ENUM ('pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.vehicle_type AS ENUM ('economy', 'comfort', 'premium', 'women_only');
CREATE TYPE public.payment_method AS ENUM ('cash', 'zain_cash', 'asia_hawala', 'qi_card');

-- ======================================
-- جدول الملفات الشخصية (Profiles)
-- ======================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'ar',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ======================================
-- جدول أدوار المستخدمين (User Roles)
-- ======================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- دالة للتحقق من الصلاحيات
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

CREATE POLICY "Users can view their own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
    ON public.user_roles FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ======================================
-- جدول المناطق والتسعير (Regions)
-- ======================================
CREATE TABLE public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    name_ku TEXT,
    base_fare INTEGER NOT NULL DEFAULT 2000,
    per_km_fare INTEGER NOT NULL DEFAULT 500,
    waiting_fare_per_min INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    coordinates JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active regions"
    ON public.regions FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage regions"
    ON public.regions FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ======================================
-- جدول السائقين (Drivers)
-- ======================================
CREATE TABLE public.drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    license_number TEXT,
    license_image_url TEXT,
    id_image_url TEXT,
    vehicle_type vehicle_type DEFAULT 'economy',
    vehicle_model TEXT,
    vehicle_color TEXT,
    vehicle_plate TEXT,
    status driver_status DEFAULT 'pending',
    is_online BOOLEAN DEFAULT false,
    is_available BOOLEAN DEFAULT true,
    current_location JSONB,
    total_earnings NUMERIC(12,2) DEFAULT 0,
    total_rides INTEGER DEFAULT 0,
    rating NUMERIC(2,1) DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view their own data"
    ON public.drivers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Drivers can update their own data"
    ON public.drivers FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can register as driver"
    ON public.drivers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all drivers"
    ON public.drivers FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage drivers"
    ON public.drivers FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ======================================
-- جدول الرحلات (Rides)
-- ======================================
CREATE TABLE public.rides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
    region_id UUID REFERENCES public.regions(id),
    pickup_location JSONB NOT NULL,
    pickup_address TEXT,
    dropoff_location JSONB NOT NULL,
    dropoff_address TEXT,
    vehicle_type vehicle_type DEFAULT 'economy',
    status ride_status DEFAULT 'pending',
    estimated_fare INTEGER,
    final_fare INTEGER,
    distance_km NUMERIC(6,2),
    duration_minutes INTEGER,
    waiting_minutes INTEGER DEFAULT 0,
    payment_method payment_method DEFAULT 'cash',
    rider_rating INTEGER,
    driver_rating INTEGER,
    cancelled_by TEXT,
    cancellation_reason TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can view their own rides"
    ON public.rides FOR SELECT
    USING (auth.uid() = rider_id);

CREATE POLICY "Riders can create rides"
    ON public.rides FOR INSERT
    WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders can update their pending rides"
    ON public.rides FOR UPDATE
    USING (auth.uid() = rider_id AND status = 'pending');

CREATE POLICY "Drivers can view assigned rides"
    ON public.rides FOR SELECT
    USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "Drivers can update their assigned rides"
    ON public.rides FOR UPDATE
    USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all rides"
    ON public.rides FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ======================================
-- جدول النقاط الدالة (Landmarks)
-- ======================================
CREATE TABLE public.landmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    region_id UUID REFERENCES public.regions(id),
    location JSONB NOT NULL,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.landmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active landmarks"
    ON public.landmarks FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage landmarks"
    ON public.landmarks FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));

-- ======================================
-- Triggers للتحديث التلقائي
-- ======================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
    BEFORE UPDATE ON public.drivers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_regions_updated_at
    BEFORE UPDATE ON public.regions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
    BEFORE UPDATE ON public.rides
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ======================================
-- إنشاء ملف شخصي تلقائياً عند التسجيل
-- ======================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name');
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ======================================
-- إضافة بيانات أولية للمناطق
-- ======================================
INSERT INTO public.regions (name_ar, name_en, base_fare, per_km_fare, waiting_fare_per_min) VALUES
    ('الكرادة', 'Karrada', 2000, 750, 100),
    ('المنصور', 'Mansour', 2500, 800, 125),
    ('الكاظمية', 'Kadhimiya', 1500, 600, 75),
    ('الأعظمية', 'Adhamiyah', 2000, 700, 100),
    ('البياع', 'Bayaa', 1500, 600, 75),
    ('زيونة', 'Zayouna', 2000, 700, 100),
    ('المنطقة الخضراء', 'Green Zone', 5000, 1500, 200);