# دليل المطور: تحسين Reverse Geocoding

## نظرة عامة

تم تطوير نظام متقدم لعرض أسماء الأماكن المشهورة (POI) بدلاً من الرموز الجغرافية (Plus Codes) عند تحديد المواقع على الخريطة.

---

## البنية التقنية

### 1. الخوارزمية الرئيسية (useLocationPicker.ts)

```typescript
/**
 * خوارزمية من 4 مستويات للحصول على أفضل اسم للموقع
 */
const reverseGeocode = async (lat: number, lng: number) => {
  // المستوى 1: Places API nearbySearch
  if (map.current) {
    const placesService = new google.maps.places.PlacesService(map.current);
    const poiName = await searchNearbyPOI(placesService, lat, lng);
    if (poiName) return poiName; // ✅ وجدنا اسم مباشر
  }

  // المستوى 2: Geocoding API مع تفضيل POI
  const geocoder = new google.maps.Geocoder();
  const results = await geocoder.geocode({ location: {lat, lng}, language: 'ar' });
  
  const poiResult = results.find(r => 
    r.types.includes('point_of_interest') && r.name
  );
  if (poiResult?.name) return poiResult.name; // ✅ وجدنا POI في Geocoding

  // المستوى 3: فلترة Plus Codes
  const firstResult = results[0].formatted_address;
  const isPlusCode = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(firstResult.split(',')[0].trim());
  
  if (isPlusCode && results.length > 1) {
    return results[1].formatted_address; // ✅ تخطي Plus Code
  }

  // المستوى 4: Fallback
  return firstResult || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};
```

---

## التفاصيل الفنية

### Places API nearbySearch

**الغرض**: الحصول على أسماء الأماكن القريبة جداً (50 متر)

```typescript
const request: google.maps.places.PlaceSearchRequest = {
  location: new google.maps.LatLng(lat, lng),
  radius: 50, // ⚠️ مهم: نطاق ضيق لتقليل الخطأ
  language: 'ar' // ✅ أسماء عربية
};

placesService.nearbySearch(request, (results, status) => {
  if (status === PlacesServiceStatus.OK && results?.length > 0) {
    const nearestPlace = results[0]; // أقرب مكان
    console.log("✅ POI found:", nearestPlace.name);
  }
});
```

**مثال نتيجة**:
```json
{
  "name": "دائرة صحة الأنبار",
  "place_id": "ChIJ...",
  "geometry": {
    "location": { "lat": 33.4262, "lng": 43.2954 }
  }
}
```

---

### Geocoding API with POI Priority

**الغرض**: Fallback محسّن للحصول على أسماء من Geocoding

```typescript
const result = await geocoder.geocode({
  location: { lat, lng },
  language: 'ar'
});

// البحث عن point_of_interest بحقل name
const poiResult = result.results.find(r => 
  r.types.includes('point_of_interest') && r.name
);

if (poiResult?.name) {
  console.log("✅ POI from geocoding:", poiResult.name);
  return poiResult.name;
}
```

**مثال نتيجة**:
```json
{
  "types": ["point_of_interest", "establishment"],
  "name": "جامع الحاج عبدالله", // ✅ هذا ما نريده
  "formatted_address": "C7GX+9C8، الرمادي، الأنبار، العراق",
  "place_id": "ChIJ..."
}
```

---

### Plus Code Detection & Filtering

**الغرض**: تجنب عرض رموز مثل `C7GX+9C8`

```typescript
const formattedAddress = result.results[0].formatted_address;

// Regex للكشف عن Plus Codes
const isPlusCode = /^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(
  formattedAddress.split(',')[0].trim()
);

if (isPlusCode && result.results.length > 1) {
  // استخدم النتيجة الثانية بدلاً من الأولى
  return result.results[1].formatted_address;
}
```

**أمثلة Plus Codes**:
- ✅ يكتشف: `C7GX+9C8`
- ✅ يكتشف: `8G5M+WV`
- ✅ يكتشف: `7J2X+3H`
- ❌ لا يكتشف: `شارع الحرية`

---

### Clickable POI Integration

**الغرض**: عند النقر على أيقونة مكان في الخريطة، التقاط اسمه مباشرة

```typescript
map.current.addListener('click', (event: google.maps.MapMouseEvent) => {
  if (event.placeId) {
    event.stop(); // منع السلوك الافتراضي

    const placesService = new google.maps.places.PlacesService(map.current!);
    placesService.getDetails(
      {
        placeId: event.placeId,
        fields: ['name', 'geometry', 'formatted_address']
      },
      (place, status) => {
        if (status === PlacesServiceStatus.OK && place?.name) {
          setCenterAddress(place.name); // ✅ عرض الاسم مباشرة
          
          if (place.geometry?.location) {
            map.current?.panTo(place.geometry.location);
          }
        }
      }
    );
  }
});
```

**سيناريو الاستخدام**:
1. المستخدم ينقر على أيقونة "🏥 مستشفى الرمادي" في الخريطة
2. يتم التقاط `placeId` من الحدث
3. يتم جلب التفاصيل عبر `PlacesService.getDetails`
4. عرض "مستشفى الرمادي" في حقل الموقع

---

## إعدادات الخريطة المحسّنة

```typescript
const mapOptions: google.maps.MapOptions = {
  center: initialCenter,
  zoom: 16,
  mapTypeId: google.maps.MapTypeId.ROADMAP,
  
  // ✨ تحسينات للـ POI
  clickableIcons: true, // ⚠️ مهم: لتفعيل النقر على الأماكن
  
  // إخفاء UI الافتراضي
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
};
```

---

## تحميل Google Maps Script

```typescript
const script = document.createElement('script');
script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geocoding&language=ar&region=IQ`;
//                                                                   ^^^^^^^^^^^^^^^^^ ^^^^^^^^^^^^^  ^^^^^^^^^^^
//                                                                   المكتبات المطلوبة  اللغة العربية  منطقة العراق
```

**المعاملات المهمة**:
- `libraries=places,geocoding`: لتفعيل Places API و Geocoding API
- `language=ar`: لعرض النتائج بالعربية
- `region=IQ`: لتحسين النتائج للعراق

---

## TypeScript Definitions

### Places API Types

```typescript
namespace google.maps.places {
  enum PlacesServiceStatus {
    OK,
    ZERO_RESULTS,
    NOT_FOUND,
    INVALID_REQUEST,
    OVER_QUERY_LIMIT,
    REQUEST_DENIED,
    UNKNOWN_ERROR,
  }

  interface PlaceResult {
    name?: string;             // ✅ الحقل المطلوب
    place_id?: string;
    geometry?: PlaceGeometry;
    formatted_address?: string;
    types?: string[];
  }

  interface PlaceSearchRequest {
    location: LatLng | { lat: number; lng: number };
    radius: number;           // بالمتر
    language?: string;        // مثال: 'ar'
  }

  class PlacesService {
    constructor(map: Map);
    nearbySearch(
      request: PlaceSearchRequest,
      callback: (results: PlaceResult[] | null, status: PlacesServiceStatus) => void
    ): void;
    getDetails(
      request: { placeId: string; fields?: string[] },
      callback: (result: PlaceResult | null, status: PlacesServiceStatus) => void
    ): void;
  }
}
```

### Geocoder Enhanced Types

```typescript
interface GeocoderResult {
  address_components: GeocoderAddressComponent[];
  formatted_address: string;
  geometry: GeocoderGeometry;
  place_id: string;
  types: string[];
  name?: string; // ✨ إضافة جديدة للـ POI
}

interface Geocoder {
  geocode(request: GeocoderRequest): Promise<{ results: GeocoderResult[] }>;
}
```

### Map Events

```typescript
interface MapMouseEvent {
  latLng?: LatLng;
  placeId?: string;  // ✨ مهم للنقر على POI
  stop(): void;      // لمنع السلوك الافتراضي
}
```

---

## API Usage & Quota

### Places API nearbySearch
- **Cost**: 1 credit per request
- **Frequency**: مرة واحدة عند كل سحب للخريطة
- **Monthly Free Tier**: 40,000 requests (Google Maps Platform)

### Geocoding API
- **Cost**: 0.5 credits per request
- **Frequency**: مرة واحدة (fallback) إذا فشلت Places API
- **Monthly Free Tier**: 40,000 requests

### Total Estimated Usage
```
معدل الاستخدام اليومي:
- 100 مستخدم × 10 عمليات سحب = 1,000 request/day
- Places API: 1,000 credits/day
- Geocoding API: ~200 credits/day (20% fallback)
- Total: ~1,200 credits/day

شهرياً:
- 1,200 × 30 = 36,000 credits/month
- ✅ ضمن الحد المجاني (40,000)
```

---

## Error Handling

### Places API Failure

```typescript
try {
  const poiName = await searchNearbyPOI(placesService, lat, lng);
  if (poiName) return poiName;
} catch (placeError) {
  // ⚠️ لا نُظهر خطأ للمستخدم (non-critical)
  console.warn("Places API error (non-critical):", placeError);
  // ✅ نستمر للـ Fallback (Geocoding API)
}
```

### Geocoding API Failure

```typescript
try {
  const result = await geocoder.geocode({ location: { lat, lng } });
  // معالجة النتائج...
} catch (error: any) {
  console.error("Reverse geocode error:", error);
  
  if (error.message?.includes('REQUEST_DENIED')) {
    toast({
      title: "تنبيه: Geocoding API",
      description: "API Key غير مصرح له",
      variant: "destructive"
    });
  }
  
  // ✅ Fallback للإحداثيات
  setCenterAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}
```

---

## Performance Optimization

### 1. Debouncing

```typescript
// في dragend event، لا نُرسل طلبات أثناء السحب
map.current.addListener('dragstart', () => setIsDragging(true));
map.current.addListener('dragend', () => {
  setIsDragging(false);
  const center = map.current?.getCenter();
  if (center) reverseGeocode(center.lat(), center.lng());
  // ✅ طلب واحد فقط عند انتهاء السحب
});
```

### 2. Caching (مقترح للمستقبل)

```typescript
const geocodeCache = new Map<string, string>();

const getCacheKey = (lat: number, lng: number) => 
  `${lat.toFixed(4)}_${lng.toFixed(4)}`; // دقة ~10 متر

const reverseGeocode = async (lat: number, lng: number) => {
  const key = getCacheKey(lat, lng);
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!; // ✅ نتيجة محفوظة
  }
  
  const result = await performReverseGeocode(lat, lng);
  geocodeCache.set(key, result);
  return result;
};
```

---

## Testing Guide

### Unit Tests (مقترح)

```typescript
describe('reverseGeocode', () => {
  it('should prioritize POI name over plus code', async () => {
    const result = await reverseGeocode(33.4262, 43.2954);
    expect(result).toBe("دائرة صحة الأنبار");
    expect(result).not.toMatch(/^[A-Z0-9]{4}\+/); // لا plus codes
  });

  it('should filter plus codes when available', async () => {
    const results = mockGeocodingResults([
      { formatted_address: "C7GX+9C8, Ramadi" },
      { formatted_address: "شارع الحرية، الرمادي" }
    ]);
    
    const address = selectBestAddress(results);
    expect(address).toBe("شارع الحرية، الرمادي");
  });

  it('should fallback to coordinates when no results', async () => {
    const result = await reverseGeocode(0, 0);
    expect(result).toMatch(/^\d+\.\d+, \d+\.\d+$/);
  });
});
```

### Integration Tests

```typescript
describe('POI Click Integration', () => {
  it('should show POI name on marker click', async () => {
    const map = createTestMap();
    const mockPlaceId = 'ChIJdZ123abc';
    
    // Simulate clicking on POI
    const event = {
      placeId: mockPlaceId,
      latLng: new google.maps.LatLng(33.4262, 43.2954),
      stop: jest.fn()
    };
    
    await handleMapClick(event);
    
    expect(event.stop).toHaveBeenCalled();
    expect(getCenterAddress()).toBe("دائرة صحة الأنبار");
  });
});
```

---

## Debugging

### Console Logs

تم إضافة console logs مفيدة للتطوير:

```typescript
console.log("✅ POI found:", poiName);
console.log("✅ POI name from geocoding:", poiResult.name);
console.log("⚠️ First result is plus code, trying alternative...");
console.log("⚠️ Geocoding API: REQUEST_DENIED");
```

### Chrome DevTools

لفحص الطلبات:
1. افتح DevTools → Network
2. ابحث عن:
   - `nearbysearch` (Places API)
   - `geocode` (Geocoding API)
3. تحقق من الـ Response لكل طلب

---

## Migration Notes

### من الإصدار القديم

```typescript
// ❌ القديم (يعرض Plus Code)
const result = await geocoder.geocode({ location: { lat, lng } });
return result.results[0].formatted_address;
// Output: "C7GX+9C8، الرمادي، الأنبار"

// ✅ الجديد (يعرض اسم المكان)
const poiName = await searchNearbyPOI(...);
if (poiName) return poiName;
// Output: "دائرة صحة الأنبار"
```

---

## Future Enhancements

### 1. User Favorites
```typescript
// حفظ الأماكن المفضلة مع أسمائها
const saveFavoritePlace = (placeId: string, name: string) => {
  favorites.push({ placeId, name, savedAt: Date.now() });
};
```

### 2. Recent Places Cache
```typescript
// كاش للأماكن الأخيرة
const recentPlaces = new LRUCache<string, PlaceResult>(50);
```

### 3. Offline Support
```typescript
// حفظ أسماء الأماكن الشائعة محلياً
const offlinePOIDatabase = indexedDB.open('raan_poi', 1);
```

---

## Support & Troubleshooting

### مشكلة: لا تظهر أسماء الأماكن

**الحل**:
1. تأكد من تفعيل Places API في Google Cloud Console
2. تحقق من API Key Restrictions (يجب السماح بـ Places API)
3. افحص Console للأخطاء

### مشكلة: Plus Codes لا تزال تظهر

**الحل**:
1. تأكد من تحميل `libraries=places` في script
2. تحقق من `clickableIcons: true` في map options
3. زيادة `radius` من 50 إلى 100 متر في nearbySearch

### مشكلة: استهلاك عالي للـ API

**الحل**:
1. تفعيل الـ Caching المقترح أعلاه
2. زيادة Debounce delay في dragend
3. تقليل دقة الـ Cache key (من 4 إلى 3 decimal places)

---

**آخر تحديث**: 2026-02-01  
**المطور**: AI Assistant  
**المراجع**: [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)

**تم الحمد لله رب العالمين** 🤲
