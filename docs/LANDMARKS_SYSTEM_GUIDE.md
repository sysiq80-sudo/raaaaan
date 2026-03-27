# 🗺️ دليل شامل لنظام إدارة المعالم والأماكن - تطبيق ران RAAN

## لمحافظتي أربيل والأنبار

---

## 📍 المقدمة

يوفر تطبيق **ران RAAN** نظاماً متكاملاً لإدارة المعالم والأماكن الجغرافية بما يخدم عمليات التاكسي الذكي. هذا الدليل يشرح الآليات المتبعة وأفضل الممارسات لإدارة المعالم في أربيل والأنبار.

---

## 1️⃣ إدارة المعالم والأماكن

### 🏗️ البنية الحالية في RAAN

يستخدم التطبيق قاعدة بيانات PostgreSQL مع جدول `landmarks` يحتوي على:

```sql
CREATE TABLE landmarks (
  id UUID PRIMARY KEY,
  name_ar TEXT NOT NULL,           -- الاسم العربي (إجباري)
  name_en TEXT,                     -- الاسم الإنجليزي (اختياري)
  category TEXT,                    -- التصنيف
  location JSONB NOT NULL,          -- {lat, lng}
  region_id UUID REFERENCES regions(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ✅ استراتيجيات التحقق من الصحة

1. **التحقق من الإحداثيات**

   ```typescript
   // التحقق من أن الموقع ضمن حدود العراق
   const isValidIraqLocation = (lat: number, lng: number) => {
     return lat >= 29.0 && lat <= 37.5 && lng >= 38.5 && lng <= 48.8;
   };
   ```

2. **توحيد المعايير**

   - استخدام معيار WGS84 للإحداثيات
   - تنسيق موحد للأسماء (بدون أحرف خاصة غير ضرورية)
   - التحقق من عدم التكرار (نفس المعلم في نفس الموقع)

3. **التحديث الدوري**
   - مراجعة دورية كل 3 أشهر
   - تفعيل نظام إبلاغ المستخدمين عن معلومات خاطئة
   - استخدام RLS (Row Level Security) لحماية البيانات

---

## 2️⃣ إضافة وتعديل المعالم

### 📊 مصادر البيانات الموثوقة

#### أ) البيانات الحكومية الرسمية

- **وزارة البلديات والأشغال العامة العراقية**
- **أمانة بغداد** (للبيانات المرجعية)
- **محافظة أربيل** - قسم التخطيط العمراني
- **محافظة الأنبار** - دائرة المساحة

#### ب) الخرائط الرقمية

- **OpenStreetMap (OSM)** - أفضل مصدر مفتوح للعراق
- **Google Maps API** - للتحقق من المواقع
- **Mapbox** - المستخدم حالياً في RAAN

#### ج) الزيارات الميدانية

```javascript
// نموذج لتوثيق زيارة ميدانية
{
  landmarkName: "مستشفى الرازي - أربيل",
  verifiedBy: "فريق RAAN",
  verificationDate: "2026-01-13",
  gpsCoordinates: { lat: 36.1911, lng: 44.0092 },
  photos: ["url1", "url2"],
  notes: "تم التحقق من الموقع والاسم مع الإدارة"
}
```

### 🔧 آليات الإضافة في RAAN

```typescript
// src/components/admin/AddLandmarkDialog.tsx
const addLandmark = async (data: LandmarkInput) => {
  // 1. التحقق من البيانات
  if (!isValidIraqLocation(data.location.lat, data.location.lng)) {
    throw new Error("الموقع خارج حدود العراق");
  }

  // 2. التحقق من عدم التكرار
  const existing = await checkDuplicate(data.name_ar, data.location);
  if (existing) {
    throw new Error("هذا المعلم موجود مسبقاً");
  }

  // 3. الإضافة إلى قاعدة البيانات
  const { data: landmark, error } = await supabase.from("landmarks").insert({
    name_ar: data.name_ar.trim(),
    name_en: data.name_en?.trim(),
    category: data.category,
    location: data.location,
    region_id: data.region_id,
    is_active: true,
  });

  return landmark;
};
```

---

## 3️⃣ تصنيف المعالم

### 📂 التصنيفات المدعومة في RAAN

```typescript
export const landmarkCategories = {
  // 🏥 الخدمات الصحية
  hospital: {
    label: "مستشفى / مركز صحي",
    icon: Hospital,
    color: "bg-red-500",
    priority: "high",
    requiredFields: ["capacity", "emergency_service"],
  },

  // 🎓 التعليم
  university: {
    label: "جامعة / كلية",
    icon: GraduationCap,
    color: "bg-blue-500",
    priority: "medium",
  },
  school: {
    label: "مدرسة",
    icon: Building2,
    color: "bg-indigo-500",
    priority: "medium",
  },

  // 🕌 الأماكن الدينية
  mosque: {
    label: "مسجد / جامع",
    icon: Church,
    color: "bg-emerald-500",
    priority: "high",
  },

  // 🛍️ التجارة
  market: {
    label: "سوق / مجمع تجاري",
    icon: ShoppingBag,
    color: "bg-orange-500",
    priority: "medium",
    requiredFields: ["opening_hours", "parking_available"],
  },

  // 🏛️ الحكومة
  government: {
    label: "دائرة حكومية",
    icon: Landmark,
    color: "bg-purple-500",
    priority: "high",
    requiredFields: ["working_hours", "department_type"],
  },

  // 🚉 النقل
  station: {
    label: "محطة / موقف",
    icon: Train,
    color: "bg-cyan-500",
    priority: "high",
  },
  airport: {
    label: "مطار",
    icon: Plane,
    color: "bg-sky-500",
    priority: "critical",
    requiredFields: ["iata_code", "terminals"],
  },

  // ⛽ الوقود
  gas_station: {
    label: "محطة وقود",
    icon: Fuel,
    color: "bg-yellow-500",
    priority: "high",
    requiredFields: ["fuel_types", "24h_service"],
  },

  // 🍽️ المطاعم والفنادق
  restaurant: {
    label: "مطعم / مقهى",
    icon: Utensils,
    color: "bg-pink-500",
    priority: "medium",
    requiredFields: ["cuisine_type", "price_range"],
  },
  hotel: {
    label: "فندق",
    icon: Hotel,
    color: "bg-violet-500",
    priority: "high",
    requiredFields: ["stars", "rooms_count", "booking_available"],
  },

  // 🅿️ خدمات أخرى
  parking: {
    label: "موقف سيارات",
    icon: ParkingCircle,
    color: "bg-slate-500",
    priority: "medium",
    requiredFields: ["capacity", "pricing"],
  },

  // 🏛️ معالم بارزة
  landmark: {
    label: "معلم بارز",
    icon: Flag,
    color: "bg-amber-500",
    priority: "medium",
    requiredFields: ["historical_info", "visiting_hours"],
  },

  // 🏘️ أحياء
  residential: {
    label: "حي سكني",
    icon: Home,
    color: "bg-teal-500",
    priority: "low",
  },

  // 🔹 أخرى
  other: {
    label: "أخرى",
    icon: MapPin,
    color: "bg-gray-500",
    priority: "low",
  },
};
```

### 🎯 الخصائص الأساسية لكل فئة

#### مثال: الفنادق

```typescript
interface HotelLandmark extends BaseLandmark {
  category: "hotel";
  properties: {
    stars: 1 | 2 | 3 | 4 | 5;
    rooms_count: number;
    amenities: string[]; // ['wifi', 'parking', 'restaurant', 'gym', 'pool']
    price_range: "budget" | "mid" | "luxury";
    booking_phones: string[];
    website?: string;
    email?: string;
    check_in_time: string; // "14:00"
    check_out_time: string; // "12:00"
  };
  ratings?: {
    average: number;
    count: number;
    source: "google" | "booking" | "internal";
  };
}
```

#### مثال: المستشفيات

```typescript
interface HospitalLandmark extends BaseLandmark {
  category: "hospital";
  properties: {
    type: "عام" | "تخصصي" | "خاص";
    specializations: string[]; // ['طوارئ', 'جراحة', 'قلب']
    capacity: number; // عدد الأسرّة
    emergency_service: boolean;
    emergency_phone: string;
    doctors_count?: number;
    insurance_accepted: string[]; // ['حكومي', 'تأمين خاص']
    working_hours: {
      weekdays: string;
      weekends: string;
      emergency: "24/7";
    };
  };
}
```

---

## 4️⃣ تحديد المواقع الحقيقية

### 🛰️ استخدام GPS ونظم التموضع

```typescript
// src/hooks/useLocationPicker.ts
const getAccurateLocation = async () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("GPS غير مدعوم");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy, // بالمتر
          timestamp: new Date(position.timestamp),
        };

        // التحقق من دقة القراءة
        if (location.accuracy > 50) {
          console.warn("دقة GPS منخفضة:", location.accuracy);
        }

        resolve(location);
      },
      reject,
      {
        enableHighAccuracy: true, // أفضل دقة ممكنة
        timeout: 10000, // 10 ثواني
        maximumAge: 0, // عدم استخدام موقع مخزن
      }
    );
  });
};
```

### 🗺️ التكامل مع Mapbox

```typescript
// src/components/admin/LandmarksMapView.tsx
import mapboxgl from "mapbox-gl";

const initializeMap = (token: string) => {
  mapboxgl.accessToken = token;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [44.0092, 36.1911], // أربيل كمركز افتراضي
    zoom: 12,
    locale: "ar", // واجهة عربية
  });

  // إضافة تحكمات
  map.addControl(new mapboxgl.NavigationControl(), "top-left");
  map.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }),
    "top-left"
  );

  return map;
};

// إضافة معلم على الخريطة
const addLandmarkMarker = (map: mapboxgl.Map, landmark: LandmarkData) => {
  const el = document.createElement("div");
  el.className = "custom-marker";
  el.style.backgroundImage = getMarkerIcon(landmark.category);
  el.style.width = "32px";
  el.style.height = "32px";

  const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
    <div class="p-2">
      <h3 class="font-bold">${landmark.name_ar}</h3>
      <p class="text-sm">${getCategoryLabel(landmark.category)}</p>
      <p class="text-xs text-gray-500">
        ${landmark.location.lat.toFixed(6)}, ${landmark.location.lng.toFixed(6)}
      </p>
    </div>
  `);

  new mapboxgl.Marker(el)
    .setLngLat([landmark.location.lng, landmark.location.lat])
    .setPopup(popup)
    .addTo(map);
};
```

### 📍 التحقق من دقة الموقع

```typescript
// التحقق من أن الموقع منطقي (مثلاً: ليس في وسط البحر)
const validateLandmarkLocation = async (location: {
  lat: number;
  lng: number;
}) => {
  const checks = {
    inIraq: isValidIraqLocation(location.lat, location.lng),
    notInWater: await checkNotInWater(location),
    nearRoad: await checkNearRoad(location),
    notDuplicate: await checkNoDuplicate(location, 100), // 100 متر
  };

  const issues = [];
  if (!checks.inIraq) issues.push("الموقع خارج العراق");
  if (!checks.notInWater) issues.push("الموقع في منطقة مائية");
  if (!checks.nearRoad) issues.push("الموقع بعيد عن أي طريق (أكثر من 500م)");
  if (!checks.notDuplicate) issues.push("يوجد معلم مشابه قريب جداً");

  return {
    valid: issues.length === 0,
    issues,
  };
};
```

---

## 5️⃣ قاعدة البيانات المتكاملة

### 🗄️ تصميم قاعدة البيانات

```sql
-- جدول المناطق (أربيل والأنبار وغيرها)
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  name_ku TEXT,                    -- كردي لأربيل
  governorate TEXT NOT NULL,       -- 'أربيل' أو 'الأنبار'
  center_location JSONB NOT NULL,  -- مركز المنطقة
  boundaries JSONB,                -- حدود المنطقة (polygon)
  population INTEGER,
  area_km2 DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- جدول المعالم الرئيسي
CREATE TABLE landmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_ar TEXT NOT NULL,
  name_en TEXT,
  name_ku TEXT,                    -- للمعالم في أربيل
  category TEXT NOT NULL,
  location JSONB NOT NULL,         -- {lat, lng}
  address_ar TEXT,
  address_en TEXT,
  region_id UUID REFERENCES regions(id),
  properties JSONB DEFAULT '{}',   -- خصائص مخصصة حسب النوع

  -- معلومات التحقق
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMP,
  verification_method TEXT,        -- 'field_visit', 'official_source', 'osm'

  -- معلومات الاتصال
  phone_numbers TEXT[],
  email TEXT,
  website TEXT,
  social_media JSONB,              -- {facebook, instagram, etc}

  -- معلومات التشغيل
  opening_hours JSONB,             -- جدول الدوام
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT true,  -- ظاهر للمستخدمين

  -- البيانات الوصفية
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  last_updated_by UUID REFERENCES profiles(id),

  -- للبحث
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('arabic', name_ar)
  ) STORED
);

-- جدول التقييمات والمراجعات
CREATE TABLE landmark_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landmark_id UUID REFERENCES landmarks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- جدول سجل التعديلات (Audit Log)
CREATE TABLE landmark_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  landmark_id UUID REFERENCES landmarks(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES profiles(id),
  change_type TEXT NOT NULL,       -- 'create', 'update', 'delete', 'verify'
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes للأداء
CREATE INDEX idx_landmarks_location ON landmarks USING GIST (((location->>'lat')::float), ((location->>'lng')::float));
CREATE INDEX idx_landmarks_region ON landmarks(region_id);
CREATE INDEX idx_landmarks_category ON landmarks(category);
CREATE INDEX idx_landmarks_active ON landmarks(is_active);
CREATE INDEX idx_landmarks_search ON landmarks USING GIN(search_vector);

-- Function للبحث الجغرافي
CREATE OR REPLACE FUNCTION find_nearby_landmarks(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_km FLOAT DEFAULT 5,
  limit_count INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name_ar TEXT,
  category TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name_ar,
    l.category,
    calculate_distance(
      user_lat, user_lng,
      (l.location->>'lat')::float,
      (l.location->>'lng')::float
    ) as distance_km
  FROM landmarks l
  WHERE l.is_active = true
    AND l.is_public = true
    AND calculate_distance(
      user_lat, user_lng,
      (l.location->>'lat')::float,
      (l.location->>'lng')::float
    ) <= radius_km
  ORDER BY distance_km
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
```

### 🔄 آليات التحديث الدوري

```typescript
// src/lib/landmarkMaintenance.ts

// 1. التحديث التلقائي من OpenStreetMap
export async function syncWithOSM(regionBounds: BoundingBox) {
  const osmData = await fetchOSMData(regionBounds);

  for (const osmFeature of osmData.features) {
    const landmark = mapOSMToLandmark(osmFeature);

    // التحقق من وجود المعلم
    const existing = await findSimilarLandmark(landmark);

    if (existing) {
      // تحديث البيانات إذا تغيرت
      if (hasSignificantChanges(existing, landmark)) {
        await updateLandmark(existing.id, landmark, {
          source: "osm_sync",
          auto_updated: true,
        });
      }
    } else {
      // إضافة معلم جديد
      await addLandmark(landmark, {
        source: "osm",
        needs_verification: true,
      });
    }
  }
}

// 2. نظام تقارير المستخدمين
export async function handleUserReport(report: LandmarkReport) {
  const { landmark_id, issue_type, description, suggested_fix } = report;

  // إضافة إلى قائمة المراجعة
  await supabase.from("landmark_reports").insert({
    landmark_id,
    reported_by: report.user_id,
    issue_type, // 'wrong_location', 'closed', 'wrong_info', 'duplicate'
    description,
    suggested_fix,
    status: "pending",
  });

  // إذا كان العدد كبير، تعطيل المعلم مؤقتاً
  const reportsCount = await getReportsCount(landmark_id);
  if (reportsCount >= 3) {
    await supabase
      .from("landmarks")
      .update({ is_public: false, needs_review: true })
      .eq("id", landmark_id);
  }
}

// 3. مراجعة دورية كل 3 أشهر
export async function schedulePeriodicReview() {
  const landmarksToReview = await supabase
    .from("landmarks")
    .select("*")
    .lt("last_reviewed_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));

  for (const landmark of landmarksToReview.data || []) {
    // التحقق من استمرار صحة البيانات
    const verification = await verifyLandmarkStillValid(landmark);

    await supabase
      .from("landmarks")
      .update({
        last_reviewed_at: new Date(),
        verification_status: verification.status,
        verification_notes: verification.notes,
      })
      .eq("id", landmark.id);
  }
}
```

### 🔐 RLS (Row Level Security)

```sql
-- سياسات الأمان للمعالم
ALTER TABLE landmarks ENABLE ROW LEVEL SECURITY;

-- المستخدمون العاديون: قراءة المعالم النشطة فقط
CREATE POLICY "public_read_active_landmarks" ON landmarks
  FOR SELECT
  USING (is_active = true AND is_public = true);

-- المدراء: صلاحيات كاملة
CREATE POLICY "admins_full_access" ON landmarks
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'admin'
    )
  );

-- السائقون: قراءة فقط
CREATE POLICY "drivers_read_landmarks" ON landmarks
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM drivers
    )
  );

-- حماية سجل التعديلات
ALTER TABLE landmark_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_history" ON landmark_history
  FOR ALL
  USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role = 'admin'
    )
  );
```

---

## 6️⃣ البيانات المطلوبة لأربيل والأنبار

### 📊 أربيل (Erbil)

```typescript
const erbilLandmarksData = {
  region: {
    name_ar: "أربيل",
    name_en: "Erbil",
    name_ku: "Hewlêr",
    center: { lat: 36.1911, lng: 44.0092 },
    governorate: "إقليم كردستان",
  },

  majorLandmarks: [
    // المعالم التاريخية
    {
      name_ar: "قلعة أربيل",
      name_en: "Erbil Citadel",
      name_ku: "Qelay Hewlêr",
      category: "landmark",
      location: { lat: 36.1913, lng: 44.0092 },
      properties: {
        unesco_heritage: true,
        historical_significance: "أقدم مدينة مأهولة بالسكان في العالم",
        visiting_hours: "09:00-17:00",
      },
    },

    // المطارات
    {
      name_ar: "مطار أربيل الدولي",
      name_en: "Erbil International Airport",
      name_ku: "Firogeha Navneteweyî ya Hewlêrê",
      category: "airport",
      location: { lat: 36.2376, lng: 43.9633 },
      properties: {
        iata_code: "EBL",
        terminals: 1,
        international: true,
      },
    },

    // المستشفيات الرئيسية
    {
      name_ar: "مستشفى الطوارئ - أربيل",
      name_en: "Erbil Emergency Hospital",
      category: "hospital",
      location: { lat: 36.1826, lng: 44.0189 },
      properties: {
        type: "حكومي",
        emergency_service: true,
        emergency_phone: "115",
        capacity: 300,
      },
    },

    // الجامعات
    {
      name_ar: "جامعة صلاح الدين",
      name_en: "Salahaddin University",
      category: "university",
      location: { lat: 36.1706, lng: 44.0066 },
      properties: {
        established: 1968,
        student_count: 30000,
      },
    },

    // المجمعات التجارية
    {
      name_ar: "مجمع فاميلي مول",
      name_en: "Family Mall",
      category: "market",
      location: { lat: 36.1889, lng: 43.9961 },
      properties: {
        type: "مول",
        floors: 4,
        parking_spaces: 1000,
      },
    },
  ],

  // أحياء رئيسية
  neighborhoods: [
    {
      name_ar: "عنكاوا",
      name_ku: "Enqawa",
      location: { lat: 36.1619, lng: 43.9961 },
    },
    {
      name_ar: "شورش",
      name_ku: "Şoreş",
      location: { lat: 36.1836, lng: 44.0278 },
    },
    { name_ar: "المشتل", location: { lat: 36.2142, lng: 44.0086 } },
  ],
};
```

### 📊 الأنبار (Anbar)

```typescript
const anbarLandmarksData = {
  region: {
    name_ar: "الأنبار",
    name_en: "Anbar",
    center: { lat: 33.4209, lng: 43.3003 }, // الرمادي
    governorate: "الأنبار",
  },

  majorLandmarks: [
    // المدن الرئيسية
    {
      name_ar: "الرمادي",
      name_en: "Ramadi",
      category: "residential",
      location: { lat: 33.4209, lng: 43.3003 },
      properties: {
        is_capital: true,
        population: 500000,
      },
    },
    {
      name_ar: "الفلوجة",
      name_en: "Fallujah",
      category: "residential",
      location: { lat: 33.3489, lng: 43.7841 },
      properties: {
        population: 300000,
      },
    },
    {
      name_ar: "القائم",
      name_en: "Al-Qaim",
      category: "residential",
      location: { lat: 34.3989, lng: 41.0128 },
      properties: {
        border_city: true,
        near_syria: true,
      },
    },

    // المستشفيات
    {
      name_ar: "مستشفى الرمادي التعليمي",
      name_en: "Ramadi Teaching Hospital",
      category: "hospital",
      location: { lat: 33.4156, lng: 43.3089 },
      properties: {
        type: "تعليمي",
        emergency_service: true,
        capacity: 400,
      },
    },

    // الجامعات
    {
      name_ar: "جامعة الأنبار",
      name_en: "University of Anbar",
      category: "university",
      location: { lat: 33.4389, lng: 43.2978 },
      properties: {
        established: 1987,
        student_count: 25000,
      },
    },

    // المعالم الدينية
    {
      name_ar: "جامع الحضرة",
      category: "mosque",
      location: { lat: 33.4211, lng: 43.3067 },
      properties: {
        historical: true,
        capacity: 2000,
      },
    },
  ],
};
```

---

## 7️⃣ استيراد البيانات

### 📤 استيراد من ملف Excel/CSV

```typescript
// src/components/admin/ImportLandmarksDialog.tsx
export const importFromExcel = async (file: File) => {
  const data = await parseExcelFile(file);

  // التحقق من الصيغة
  const requiredColumns = ["name_ar", "category", "lat", "lng"];
  const hasAllColumns = requiredColumns.every((col) =>
    data[0].hasOwnProperty(col)
  );

  if (!hasAllColumns) {
    throw new Error("الملف لا يحتوي على الأعمدة المطلوبة");
  }

  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (const row of data) {
    try {
      // التحقق والإضافة
      await addLandmark({
        name_ar: row.name_ar,
        name_en: row.name_en,
        category: row.category,
        location: { lat: parseFloat(row.lat), lng: parseFloat(row.lng) },
        region_id: row.region_id,
        properties: row.properties ? JSON.parse(row.properties) : {},
      });
      results.success++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        row: row.name_ar,
        error: error.message,
      });
    }
  }

  return results;
};
```

### 📥 استيراد من OpenStreetMap

```typescript
// استيراد بيانات OSM لمنطقة محددة
export const importFromOSM = async (bounds: BoundingBox, category: string) => {
  const overpassQuery = `
    [out:json];
    (
      node["amenity"="${category}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      way["amenity"="${category}"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out center;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: overpassQuery,
  });

  const data = await response.json();

  const landmarks = data.elements.map((element) => ({
    name_ar: element.tags["name:ar"] || element.tags.name,
    name_en: element.tags["name:en"] || element.tags.name,
    category: mapOSMCategory(element.tags.amenity),
    location: {
      lat: element.lat || element.center.lat,
      lng: element.lon || element.center.lon,
    },
    properties: {
      osm_id: element.id,
      osm_type: element.type,
      ...element.tags,
    },
  }));

  return landmarks;
};
```

---

## 8️⃣ التكامل مع تطبيق RAAN

### 🚖 استخدام المعالم في حجز الرحلات

```typescript
// src/pages/rider/GoPage.tsx
const suggestNearbyLandmarks = async (userLocation: Location) => {
  const { data: landmarks } = await supabase.rpc("find_nearby_landmarks", {
    user_lat: userLocation.lat,
    user_lng: userLocation.lng,
    radius_km: 2,
    limit_count: 10,
  });

  return landmarks;
};

// عرض المعالم في واجهة المستخدم
const LandmarkSuggestions = ({ landmarks }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium">معالم قريبة:</p>
    {landmarks.map((landmark) => (
      <Button
        key={landmark.id}
        variant="outline"
        className="w-full justify-start"
        onClick={() => selectLandmark(landmark)}
      >
        {getCategoryIcon(landmark.category)}
        <span className="mr-2">{landmark.name_ar}</span>
        <span className="text-xs text-muted-foreground mr-auto">
          {landmark.distance_km.toFixed(1)} كم
        </span>
      </Button>
    ))}
  </div>
);
```

### 📱 عرض المعالم على الخريطة للراكب

```typescript
// عرض المعالم القريبة على خريطة الراكب
const showNearbyLandmarksOnMap = (map: mapboxgl.Map, landmarks: Landmark[]) => {
  // إضافة طبقة للمعالم
  map.addSource("landmarks", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: landmarks.map((l) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [l.location.lng, l.location.lat],
        },
        properties: {
          name: l.name_ar,
          category: l.category,
        },
      })),
    },
  });

  map.addLayer({
    id: "landmarks-layer",
    type: "symbol",
    source: "landmarks",
    layout: {
      "icon-image": ["get", "category"],
      "icon-size": 0.8,
      "text-field": ["get", "name"],
      "text-size": 10,
      "text-offset": [0, 1.5],
      "text-anchor": "top",
    },
  });
};
```

---

## 9️⃣ التوصيات والخطوات القادمة

### ✅ أولويات التنفيذ

1. **المرحلة الأولى (شهر واحد)**

   - [ ] جمع بيانات المعالم الرئيسية في أربيل (100+ معلم)
   - [ ] جمع بيانات المعالم الرئيسية في الأنبار (50+ معلم)
   - [ ] تدريب فريق على استخدام نظام الإدارة
   - [ ] إطلاق نظام التقارير للمستخدمين

2. **المرحلة الثانية (شهرين)**

   - [ ] التكامل الكامل مع OSM
   - [ ] نظام التحديث التلقائي
   - [ ] إضافة 500+ معلم لكل محافظة
   - [ ] تفعيل خاصية التحقق الميداني

3. **المرحلة الثالثة (ثلاثة أشهر)**
   - [ ] توسيع التغطية لباقي المحافظات
   - [ ] نظام تقييمات المستخدمين
   - [ ] API عامة للمطورين
   - [ ] تطبيق موبايل للتحقق الميداني

### 🎯 مؤشرات الأداء (KPIs)

- **التغطية**: 80%+ من المعالم الرئيسية
- **الدقة**: 95%+ إحداثيات صحيحة (±50 متر)
- **الحداثة**: تحديث 90%+ من البيانات كل 6 أشهر
- **الاستخدام**: 70%+ من الرحلات تستخدم معالم محفوظة

---

## 📚 المراجع والموارد

### 🔗 روابط مفيدة

1. **OpenStreetMap Iraq**: https://www.openstreetmap.org/relation/304934
2. **Mapbox Geocoding API**: https://docs.mapbox.com/api/search/geocoding/
3. **PostGIS Documentation**: https://postgis.net/documentation/
4. **Overpass API**: https://wiki.openstreetmap.org/wiki/Overpass_API

### 📖 مصادر تعليمية

- دليل OpenStreetMap للمحررين: https://learnosm.org/ar/
- Mapbox GL JS Documentation: https://docs.mapbox.com/mapbox-gl-js/
- PostgreSQL PostGIS Tutorial: https://postgis.net/workshops/postgis-intro/

---

**والحمد لله رب العالمين** 🤲

**تم إعداد هذا الدليل بواسطة**: فريق تطوير RAAN  
**تاريخ الإصدار**: 2026-01-13  
**الإصدار**: 1.0.0
