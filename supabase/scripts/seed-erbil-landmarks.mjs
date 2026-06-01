// seed-erbil-landmarks.mjs
// تشغيل: node supabase/scripts/seed-erbil-landmarks.mjs
// يستخدم Supabase REST API مباشرة لتجنب مشكلة ترميز PowerShell

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// قراءة .env
const envPath = resolve(__dirname, '../../.env');
let SUPABASE_URL = '';
let SUPABASE_SERVICE_KEY = '';

try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    const key = k?.trim();
    const val = v.join('=').trim().replace(/^["']|["']$/g, '');
    if (key === 'VITE_SUPABASE_URL') SUPABASE_URL = val;
    if (key === 'SUPABASE_SERVICE_ROLE_KEY' || key === 'VITE_SUPABASE_SERVICE_ROLE_KEY') SUPABASE_SERVICE_KEY = val;
  }
} catch (e) {
  console.error('❌ لم يُعثر على ملف .env');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ VITE_SUPABASE_URL أو SUPABASE_SERVICE_ROLE_KEY غير موجودة في .env');
  console.log('Available env vars hint: check .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const ERB_GOV = '354d3286-0bc3-4c11-b450-b682b3829fcc';

const landmarks = [
  // ═══ جامعات وكليات ═══
  { name_ar: 'جامعة صلاح الدين',          name_en: 'Salahaddin University',             category: 'university',   location: { lat: 36.1948, lng: 44.0285 } },
  { name_ar: 'جامعة أربيل التقنية',        name_en: 'Erbil Technical University',         category: 'university',   location: { lat: 36.1925, lng: 44.0201 } },
  { name_ar: 'جامعة كويه',                 name_en: 'Koya University',                   category: 'university',   location: { lat: 36.0807, lng: 44.6231 } },
  { name_ar: 'الجامعة الأمريكية في أربيل', name_en: 'American University of Erbil',       category: 'university',   location: { lat: 36.2057, lng: 44.0186 } },
  { name_ar: 'جامعة ليفان',                name_en: 'Livan University',                  category: 'university',   location: { lat: 36.1893, lng: 44.0223 } },
  { name_ar: 'جامعة المعرفة',              name_en: 'Knowledge University',               category: 'university',   location: { lat: 36.1043480, lng: 44.0337080 } },
  { name_ar: 'جامعة بحر الغوم',            name_en: 'Bahr al-Ghoom University',           category: 'university',   location: { lat: 36.2001, lng: 44.0187 } },
  { name_ar: 'جامعة كرميان',               name_en: 'Karmian University',                 category: 'university',   location: { lat: 35.1050, lng: 45.3911 } },
  { name_ar: 'المعهد التقني أربيل',         name_en: 'Technical Institute Erbil',          category: 'university',   location: { lat: 36.1932, lng: 44.0312 } },

  // ═══ مستشفيات ═══
  { name_ar: 'مستشفى روژهلات',             name_en: 'Rozhalat Hospital',                  category: 'hospital',     location: { lat: 36.2021, lng: 44.0078 } },
  { name_ar: 'مستشفى هيوا للأورام',        name_en: 'Hiwa Cancer Hospital',               category: 'hospital',     location: { lat: 36.1789, lng: 44.0198 } },
  { name_ar: 'مستشفى جينان',               name_en: 'Jinan Hospital',                    category: 'hospital',     location: { lat: 36.1951, lng: 44.0089 } },
  { name_ar: 'مستشفى شاريا',               name_en: 'Sharya Hospital',                   category: 'hospital',     location: { lat: 36.4611, lng: 42.8951 } },
  { name_ar: 'مستشفى رزكاري التعليمي',     name_en: 'Rizgary Teaching Hospital',          category: 'hospital',     location: { lat: 36.1902, lng: 44.0123 } },
  { name_ar: 'مستشفى جنيف',                name_en: 'Geneva Hospital',                   category: 'hospital',     location: { lat: 36.1876, lng: 44.0087 } },
  { name_ar: 'مستشفى ريزان',               name_en: 'Rizwan Hospital',                   category: 'hospital',     location: { lat: 36.1845, lng: 44.0145 } },
  { name_ar: 'المستشفى الجمهوري أربيل',    name_en: 'Republican Hospital Erbil',          category: 'hospital',     location: { lat: 36.1913, lng: 44.0098 } },
  { name_ar: 'مستشفى كولان',               name_en: 'Kolan Hospital',                    category: 'hospital',     location: { lat: 36.2101, lng: 44.0234 } },
  { name_ar: 'مستشفى فرياد',               name_en: 'Faryad Hospital',                   category: 'hospital',     location: { lat: 36.1998, lng: 44.0167 } },
  { name_ar: 'مركز أربيل الطبي التخصصي',  name_en: 'Erbil Specialized Medical Center',  category: 'hospital',     location: { lat: 36.1923, lng: 44.0201 } },

  // ═══ مولات وأسواق ═══
  { name_ar: 'مول أربيل',                  name_en: 'Erbil Mall',                        category: 'market',       location: { lat: 36.1831, lng: 44.0012 } },
  { name_ar: 'مول فاميلي',                 name_en: 'Family Mall',                       category: 'market',       location: { lat: 36.1872, lng: 43.9987 } },
  { name_ar: 'مجمع ماجيك مول',             name_en: 'Magic Mall',                        category: 'market',       location: { lat: 36.1901, lng: 43.9901 } },
  { name_ar: 'مجمع Dream City',            name_en: 'Dream City Mall',                   category: 'market',       location: { lat: 36.2134, lng: 44.0089 } },
  { name_ar: 'أسواق لانكاو',               name_en: 'Langkawi Mall',                     category: 'market',       location: { lat: 36.1945, lng: 44.0145 } },
  { name_ar: 'مول Empire',                 name_en: 'Empire Mall',                       category: 'market',       location: { lat: 36.1823, lng: 44.0056 } },
  { name_ar: 'سوق قيصرية أربيل',           name_en: 'Erbil Qaisari Market',              category: 'market',       location: { lat: 36.1916, lng: 44.0089 } },
  { name_ar: 'سوق 60م',                    name_en: 'Street 60 Market',                  category: 'market',       location: { lat: 36.2089, lng: 44.0234 } },
  { name_ar: 'سوق كهرمانة',                name_en: 'Kahramana Market',                  category: 'market',       location: { lat: 36.1934, lng: 44.0112 } },
  { name_ar: 'مجمع فالكون',                name_en: 'Falcon Mall',                       category: 'market',       location: { lat: 36.1878, lng: 43.9923 } },

  // ═══ فنادق ═══
  { name_ar: 'فندق دونين أربيل',           name_en: 'Divan Erbil Hotel',                 category: 'hotel',        location: { lat: 36.1923, lng: 44.0023 } },
  { name_ar: 'فندق روتانا أربيل',          name_en: 'Rotana Erbil Hotel',                category: 'hotel',        location: { lat: 36.1901, lng: 44.0045 } },
  { name_ar: 'فندق كمبنسكي أربيل',         name_en: 'Kempinski Hotel Erbil',             category: 'hotel',        location: { lat: 36.1867, lng: 43.9989 } },
  { name_ar: 'فندق كلاردج أربيل',          name_en: 'Claridge Hotel Erbil',              category: 'hotel',        location: { lat: 36.1912, lng: 44.0067 } },
  { name_ar: 'فندق كرون بلازا أربيل',      name_en: 'Crowne Plaza Erbil',                category: 'hotel',        location: { lat: 36.1889, lng: 44.0012 } },
  { name_ar: 'فندق خيال',                  name_en: 'Hayat Hotel',                       category: 'hotel',        location: { lat: 36.1934, lng: 44.0089 } },

  // ═══ أحياء ومناطق ═══
  { name_ar: 'حي أزادي',                   name_en: 'Azadi District',                    category: 'residential',  location: { lat: 36.2012, lng: 44.0134 } },
  { name_ar: 'حي باخچه جوي',              name_en: 'Bakhchajoy District',               category: 'residential',  location: { lat: 36.1945, lng: 44.0189 } },
  { name_ar: 'حي كاوه',                    name_en: 'Kawa District',                     category: 'residential',  location: { lat: 36.1878, lng: 44.0245 } },
  { name_ar: 'حي گردان',                   name_en: 'Gurdan District',                   category: 'residential',  location: { lat: 36.1834, lng: 44.0301 } },
  { name_ar: 'حي آنكاوا',                  name_en: 'Ankawa District',                   category: 'residential',  location: { lat: 36.2234, lng: 43.9967 } },
  { name_ar: 'حي عينكاوا',                 name_en: 'Ainkawa',                           category: 'residential',  location: { lat: 36.2198, lng: 43.9989 } },
  { name_ar: 'حي عرفة',                    name_en: 'Arafa District',                    category: 'residential',  location: { lat: 36.1756, lng: 44.0123 } },
  { name_ar: 'حي هةولير',                  name_en: 'Hewler District',                   category: 'residential',  location: { lat: 36.1901, lng: 44.0098 } },
  { name_ar: 'حي كونه ماسي',              name_en: 'Kona Masi',                         category: 'residential',  location: { lat: 36.1867, lng: 44.0156 } },
  { name_ar: 'حي دارتو',                   name_en: 'Daratu',                            category: 'residential',  location: { lat: 36.2145, lng: 44.0289 } },
  { name_ar: 'حي باردارو',                 name_en: 'Bardaro',                           category: 'residential',  location: { lat: 36.1923, lng: 44.0423 } },
  { name_ar: 'حي بريمكه',                  name_en: 'Brimke',                            category: 'residential',  location: { lat: 36.2078, lng: 44.0178 } },
  { name_ar: 'منطقة 30م',                  name_en: 'Street 30 Area',                    category: 'residential',  location: { lat: 36.1845, lng: 44.0212 } },
  { name_ar: 'منطقة 60م',                  name_en: 'Street 60 Area',                    category: 'residential',  location: { lat: 36.2056, lng: 44.0234 } },
  { name_ar: 'منطقة 100م',                 name_en: 'Street 100 Area',                   category: 'residential',  location: { lat: 36.1978, lng: 44.0312 } },
  { name_ar: 'منطقة زاغروس',               name_en: 'Zagros Area',                       category: 'residential',  location: { lat: 36.2167, lng: 44.0145 } },
  { name_ar: 'منطقة باشتابيا',             name_en: 'Bashtabia',                         category: 'residential',  location: { lat: 36.1812, lng: 44.0089 } },
  { name_ar: 'منطقة كردستان',              name_en: 'Kurdistan Area',                    category: 'residential',  location: { lat: 36.1934, lng: 44.0056 } },
  { name_ar: 'حي شقلاوه',                  name_en: 'Shaqlawa District',                 category: 'residential',  location: { lat: 36.4089, lng: 44.3223 } },
  { name_ar: 'منطقة روستم آغا',            name_en: 'Rustem Agha',                       category: 'residential',  location: { lat: 36.1856, lng: 44.0167 } },
  { name_ar: 'حي صانية',                   name_en: 'Sania',                             category: 'residential',  location: { lat: 36.2012, lng: 44.0401 } },
  { name_ar: 'حي خورمالا',                 name_en: 'Khormala',                          category: 'residential',  location: { lat: 36.2089, lng: 44.0523 } },
  { name_ar: 'حي بلدية واحد',              name_en: 'Baladiya 1',                        category: 'residential',  location: { lat: 36.1923, lng: 44.0098 } },
  { name_ar: 'حي بلدية ثلاثة',             name_en: 'Baladiya 3',                        category: 'residential',  location: { lat: 36.1867, lng: 44.0145 } },

  // ═══ معالم بارزة ═══
  { name_ar: 'قلعة أربيل',                 name_en: 'Erbil Citadel',                     category: 'landmark',     location: { lat: 36.1912, lng: 44.0091 } },
  { name_ar: 'مطار أربيل الدولي',          name_en: 'Erbil International Airport',        category: 'airport',      location: { lat: 36.2376, lng: 43.9632 } },
  { name_ar: 'شارع 100م الرئيسي',          name_en: '100m Street',                       category: 'landmark',     location: { lat: 36.1978, lng: 44.0312 } },
  { name_ar: 'برج ساعة أربيل',             name_en: 'Erbil Clock Tower',                 category: 'landmark',     location: { lat: 36.1912, lng: 44.0078 } },
  { name_ar: 'ملعب فرانسو حريري',          name_en: 'Franso Hariri Stadium',             category: 'landmark',     location: { lat: 36.2034, lng: 44.0189 } },
  { name_ar: 'حديقة سامي عبدالرحمن',       name_en: 'Sami Abdulrahman Park',             category: 'landmark',     location: { lat: 36.1989, lng: 44.0056 } },
  { name_ar: 'حديقة شانيدر',               name_en: 'Shanidar Park',                     category: 'landmark',     location: { lat: 36.1901, lng: 44.0134 } },
  { name_ar: 'بازار أربيل القديم',          name_en: 'Old Erbil Bazaar',                  category: 'landmark',     location: { lat: 36.1909, lng: 44.0084 } },
  { name_ar: 'متحف أربيل الحضاري',         name_en: 'Erbil Civilization Museum',         category: 'landmark',     location: { lat: 36.1915, lng: 44.0093 } },
  { name_ar: 'منطقة صلاح الدين السياحية',  name_en: 'Salahaddin Tourist Area',           category: 'landmark',     location: { lat: 36.3745, lng: 44.1834 } },
  { name_ar: 'شلالات شقلاوة',              name_en: 'Shaqlawa Waterfalls',               category: 'landmark',     location: { lat: 36.4089, lng: 44.3223 } },

  // ═══ دوائر حكومية ═══
  { name_ar: 'مجمع حكومة إقليم كردستان',  name_en: 'KRG Complex',                       category: 'government',   location: { lat: 36.1934, lng: 44.0023 } },
  { name_ar: 'مبنى المحافظة',              name_en: 'Governorate Building',              category: 'government',   location: { lat: 36.1912, lng: 44.0089 } },
  { name_ar: 'مديرية مرور أربيل',          name_en: 'Erbil Traffic Directorate',         category: 'government',   location: { lat: 36.1934, lng: 44.0134 } },
  { name_ar: 'مديرية جوازات أربيل',        name_en: 'Erbil Passport Directorate',        category: 'government',   location: { lat: 36.1945, lng: 44.0089 } },
  { name_ar: 'غرفة تجارة وصناعة أربيل',   name_en: 'Erbil Chamber of Commerce',         category: 'government',   location: { lat: 36.1901, lng: 44.0078 } },

  // ═══ مساجد ═══
  { name_ar: 'جامع نور الإسلام الكبير',    name_en: 'Nour Al-Islam Grand Mosque',        category: 'mosque',       location: { lat: 36.1923, lng: 44.0089 } },
  { name_ar: 'مسجد الشهيد خالد',           name_en: 'Shaheed Khalid Mosque',             category: 'mosque',       location: { lat: 36.1867, lng: 44.0134 } },
  { name_ar: 'جامع الرحمن',                name_en: 'Al-Rahman Mosque',                  category: 'mosque',       location: { lat: 36.1945, lng: 44.0178 } },
  { name_ar: 'جامع آنكاوا الكبير',         name_en: 'Ankawa Grand Mosque',               category: 'mosque',       location: { lat: 36.2189, lng: 43.9978 } },

  // ═══ مدارس ═══
  { name_ar: 'ثانوية كمال أتاتورك',        name_en: 'Kamal Ataturk High School',         category: 'school',       location: { lat: 36.1912, lng: 44.0145 } },
  { name_ar: 'مدرسة الرواد التجريبية',     name_en: 'Al-Rawad Experimental School',      category: 'school',       location: { lat: 36.1934, lng: 44.0167 } },
  { name_ar: 'مدرسة آنكاوا الأساسية',      name_en: 'Ankawa Primary School',             category: 'school',       location: { lat: 36.2167, lng: 43.9989 } },
  { name_ar: 'ثانوية دارتو',               name_en: 'Daratu High School',                category: 'school',       location: { lat: 36.2134, lng: 44.0312 } },
  { name_ar: 'مدرسة البيان النموذجية',     name_en: 'Al-Bayan Model School',             category: 'school',       location: { lat: 36.1889, lng: 44.0201 } },

  // ═══ محطات وقود ═══
  { name_ar: 'محطة كهرمانة للوقود',        name_en: 'Kahramana Gas Station',             category: 'gas_station',  location: { lat: 36.1923, lng: 44.0056 } },
  { name_ar: 'محطة الشمال للوقود',          name_en: 'North Gas Station',                 category: 'gas_station',  location: { lat: 36.2145, lng: 44.0089 } },
  { name_ar: 'محطة آنكاوا للوقود',          name_en: 'Ankawa Gas Station',                category: 'gas_station',  location: { lat: 36.2178, lng: 43.9967 } },
].map(lm => ({
  ...lm,
  governorate_id: ERB_GOV,
  is_active: true,
  location: lm.location,
}));

async function seed() {
  console.log(`📍 إدراج ${landmarks.length} معلم لأربيل...`);

  // إدراج على دفعات لتجنب تجاوز حجم الطلب
  const BATCH = 20;
  let total = 0;

  for (let i = 0; i < landmarks.length; i += BATCH) {
    const batch = landmarks.slice(i, i + BATCH);
    const { error } = await supabase
      .from('landmarks')
      .upsert(batch, { onConflict: 'name_en,governorate_id', ignoreDuplicates: false });

    if (error) {
      console.error(`❌ خطأ في الدفعة ${i}-${i + BATCH}:`, error.message);
    } else {
      total += batch.length;
      console.log(`  ✅ ${total}/${landmarks.length}`);
    }
  }

  // إحصاء
  const { count } = await supabase
    .from('landmarks')
    .select('*', { count: 'exact', head: true })
    .eq('governorate_id', ERB_GOV);

  console.log(`\n🎉 إجمالي معالم أربيل في قاعدة البيانات: ${count}`);
}

seed().catch(console.error);
