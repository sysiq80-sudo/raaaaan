-- ═══════════════════════════════════════════════════════════════════
-- معالم وأحياء وأماكن مدينة أربيل — إدراج شامل
-- Governorate ID: 354d3286-0bc3-4c11-b450-b682b3829fcc
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  erb_gov UUID := '354d3286-0bc3-4c11-b450-b682b3829fcc';
BEGIN

-- ═══════════════ جامعات وكليات ═══════════════
INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
('جامعة صلاح الدين', 'Salahaddin University', 'university', '{"lat":36.1948,"lng":44.0285}', erb_gov, true),
('جامعة أربيل التقنية', 'Erbil Technical University', 'university', '{"lat":36.1925,"lng":44.0201}', erb_gov, true),
('جامعة كويه', 'Koya University', 'university', '{"lat":36.0807,"lng":44.6231}', erb_gov, true),
('الجامعة الأمريكية في أربيل', 'American University of Erbil', 'university', '{"lat":36.2057,"lng":44.0011}', erb_gov, true),
('جامعة ليفان', 'Livan University', 'university', '{"lat":36.1893,"lng":44.0156}', erb_gov, true),
('جامعة المعرفة', 'Knowledge University', 'university', '{"lat":36.1887,"lng":44.0196}', erb_gov, true),
('جامعة بحر الغوم', 'Bahr al-Ghoom University', 'university', '{"lat":36.2001,"lng":44.0123}', erb_gov, true),
('جامعة كرميان', 'Karmian University', 'university', '{"lat":35.1050,"lng":45.3911}', erb_gov, true),
('المعهد التقني أربيل', 'Technical Institute Erbil', 'university', '{"lat":36.1932,"lng":44.0312}', erb_gov, true),

-- ═══════════════ مستشفيات ومراكز صحية ═══════════════
('مستشفى روژهلات', 'Rozhalat Hospital', 'hospital', '{"lat":36.2021,"lng":44.0078}', erb_gov, true),
('مستشفى هيوا للأورام', 'Hiwa Cancer Hospital', 'hospital', '{"lat":36.1789,"lng":44.0198}', erb_gov, true),
('مستشفى جينان', 'Jinan Hospital', 'hospital', '{"lat":36.1951,"lng":44.0089}', erb_gov, true),
('مستشفى شاريا', 'Sharya Hospital', 'hospital', '{"lat":36.4611,"lng":42.8951}', erb_gov, true),
('مستشفى رزكاري التعليمي', 'Rizgary Teaching Hospital', 'hospital', '{"lat":36.1902,"lng":44.0123}', erb_gov, true),
('مستشفى جنيف', 'Geneva Hospital', 'hospital', '{"lat":36.1876,"lng":44.0087}', erb_gov, true),
('مستشفى ريزان', 'Rizwan Hospital', 'hospital', '{"lat":36.1845,"lng":44.0145}', erb_gov, true),
('المستشفى الجمهوري أربيل', 'Republican Hospital Erbil', 'hospital', '{"lat":36.1913,"lng":44.0098}', erb_gov, true),
('مستشفى كولان', 'Kolan Hospital', 'hospital', '{"lat":36.2101,"lng":44.0234}', erb_gov, true),
('مستشفى فرياد', 'Faryad Hospital', 'hospital', '{"lat":36.1998,"lng":44.0167}', erb_gov, true),
('مركز أربيل الطبي التخصصي', 'Erbil Specialized Medical Center', 'hospital', '{"lat":36.1923,"lng":44.0201}', erb_gov, true),

-- ═══════════════ مولات ومراكز تسوق ═══════════════
('مول أربيل', 'Erbil Mall', 'market', '{"lat":36.1831,"lng":44.0012}', erb_gov, true),
('مول فاميلي', 'Family Mall', 'market', '{"lat":36.1872,"lng":43.9987}', erb_gov, true),
('مجمع ماجيك مول', 'Magic Mall', 'market', '{"lat":36.1901,"lng":43.9901}', erb_gov, true),
('مجمع Dream City', 'Dream City Mall', 'market', '{"lat":36.2134,"lng":44.0089}', erb_gov, true),
('أسواق لانكاو', 'Langkawi Mall', 'market', '{"lat":36.1945,"lng":44.0145}', erb_gov, true),
('مول Empire', 'Empire Mall', 'market', '{"lat":36.1823,"lng":44.0056}', erb_gov, true),
('سوق قيصرية أربيل', 'Erbil Qaisari Market', 'market', '{"lat":36.1916,"lng":44.0089}', erb_gov, true),
('سوق 60م', 'Street 60 Market', 'market', '{"lat":36.2089,"lng":44.0234}', erb_gov, true),
('سوق كهرمانة', 'Kahramana Market', 'market', '{"lat":36.1934,"lng":44.0112}', erb_gov, true),
('مجمع فالكون', 'Falcon Mall', 'market', '{"lat":36.1878,"lng":43.9923}', erb_gov, true),

-- ═══════════════ فنادق ═══════════════
('فندق دونين أربيل', 'Divan Erbil Hotel', 'hotel', '{"lat":36.1923,"lng":44.0023}', erb_gov, true),
('فندق روتانا أربيل', 'Rotana Erbil Hotel', 'hotel', '{"lat":36.1901,"lng":44.0045}', erb_gov, true),
('فندق كمبنسكي أربيل', 'Kempinski Hotel Erbil', 'hotel', '{"lat":36.1867,"lng":43.9989}', erb_gov, true),
('فندق كلاردج أربيل', 'Claridge Hotel Erbil', 'hotel', '{"lat":36.1912,"lng":44.0067}', erb_gov, true),
('فندق كرون بلازا أربيل', 'Crowne Plaza Erbil', 'hotel', '{"lat":36.1889,"lng":44.0012}', erb_gov, true),
('فندق خيال', 'Hayat Hotel', 'hotel', '{"lat":36.1934,"lng":44.0089}', erb_gov, true),

-- ═══════════════ أحياء ومناطق ═══════════════
('حي أزادي', 'Azadi District', 'residential', '{"lat":36.2012,"lng":44.0134}', erb_gov, true),
('حي باخچه جوي', 'Bakhchajoy District', 'residential', '{"lat":36.1945,"lng":44.0189}', erb_gov, true),
('حي كاوه', 'Kawa District', 'residential', '{"lat":36.1878,"lng":44.0245}', erb_gov, true),
('حي گردان', 'Gurdan District', 'residential', '{"lat":36.1834,"lng":44.0301}', erb_gov, true),
('حي آنكاوا', 'Ankawa District', 'residential', '{"lat":36.2234,"lng":43.9967}', erb_gov, true),
('حي عينكاوا', 'Ainkawa', 'residential', '{"lat":36.2198,"lng":43.9989}', erb_gov, true),
('حي عرفة', 'Arafa District', 'residential', '{"lat":36.1756,"lng":44.0123}', erb_gov, true),
('حي هةولير', 'Hewler District', 'residential', '{"lat":36.1901,"lng":44.0098}', erb_gov, true),
('حي كونه ماسي', 'Kona Masi', 'residential', '{"lat":36.1867,"lng":44.0156}', erb_gov, true),
('حي دارتو', 'Daratu', 'residential', '{"lat":36.2145,"lng":44.0289}', erb_gov, true),
('حي باردارو', 'Bardaro', 'residential', '{"lat":36.1923,"lng":44.0423}', erb_gov, true),
('حي بريمكه', 'Brimke', 'residential', '{"lat":36.2078,"lng":44.0178}', erb_gov, true),
('منطقة 30م', 'Street 30 Area', 'residential', '{"lat":36.1845,"lng":44.0212}', erb_gov, true),
('منطقة 60م', 'Street 60 Area', 'residential', '{"lat":36.2056,"lng":44.0234}', erb_gov, true),
('منطقة 100م', 'Street 100 Area', 'residential', '{"lat":36.1978,"lng":44.0312}', erb_gov, true),
('منطقة زاغروس', 'Zagros Area', 'residential', '{"lat":36.2167,"lng":44.0145}', erb_gov, true),
('منطقة باشتابيا', 'Bashtabia', 'residential', '{"lat":36.1812,"lng":44.0089}', erb_gov, true),
('منطقة كردستان', 'Kurdistan Area', 'residential', '{"lat":36.1934,"lng":44.0056}', erb_gov, true),
('حي شقلاوه', 'Shaqlawa District', 'residential', '{"lat":36.4089,"lng":44.3223}', erb_gov, true),
('منطقة روستم آغا', 'Rustem Agha', 'residential', '{"lat":36.1856,"lng":44.0167}', erb_gov, true),
('حي صانية', 'Sania', 'residential', '{"lat":36.2012,"lng":44.0401}', erb_gov, true),
('حي خورمالا', 'Khormala', 'residential', '{"lat":36.2089,"lng":44.0523}', erb_gov, true),
('حي بلدية واحد', 'Baladiya 1', 'residential', '{"lat":36.1923,"lng":44.0098}', erb_gov, true),
('حي بلدية ثلاثة', 'Baladiya 3', 'residential', '{"lat":36.1867,"lng":44.0145}', erb_gov, true),

-- ═══════════════ معالم بارزة ═══════════════
('قلعة أربيل', 'Erbil Citadel', 'landmark', '{"lat":36.1912,"lng":44.0091}', erb_gov, true),
('مطار أربيل الدولي', 'Erbil International Airport', 'airport', '{"lat":36.2376,"lng":43.9632}', erb_gov, true),
('شارع 100م الرئيسي', '100m Street', 'landmark', '{"lat":36.1978,"lng":44.0312}', erb_gov, true),
('برج ساعة أربيل', 'Erbil Clock Tower', 'landmark', '{"lat":36.1912,"lng":44.0078}', erb_gov, true),
('ملعب فرانسو حريري', 'Franso Hariri Stadium', 'landmark', '{"lat":36.2034,"lng":44.0189}', erb_gov, true),
('حديقة سامي عبدالرحمن', 'Sami Abdulrahman Park', 'landmark', '{"lat":36.1989,"lng":44.0056}', erb_gov, true),
('حديقة شانيدر', 'Shanidar Park', 'landmark', '{"lat":36.1901,"lng":44.0134}', erb_gov, true),
('قصر هه‌ژار الثقافي', 'Hezhar Cultural Palace', 'landmark', '{"lat":36.1923,"lng":44.0067}', erb_gov, true),
('بازار أربيل القديم', 'Old Erbil Bazaar', 'landmark', '{"lat":36.1909,"lng":44.0084}', erb_gov, true),
('متحف أربيل الحضاري', 'Erbil Civilization Museum', 'landmark', '{"lat":36.1915,"lng":44.0093}', erb_gov, true),
('مجمع حكومة إقليم كردستان', 'KRG Complex', 'government', '{"lat":36.1934,"lng":44.0023}', erb_gov, true),
('مبنى المحافظة', 'Governorate Building', 'government', '{"lat":36.1912,"lng":44.0089}', erb_gov, true),
('مجمع بازيان السياحي', 'Bazian Tourist Complex', 'landmark', '{"lat":35.8234,"lng":45.1123}', erb_gov, true),
('منطقة صلاح الدين السياحية', 'Salahaddin Tourist Area', 'landmark', '{"lat":36.3745,"lng":44.1834}', erb_gov, true),
('شلالات شقلاوة', 'Shaqlawa Waterfalls', 'landmark', '{"lat":36.4089,"lng":44.3223}', erb_gov, true),

-- ═══════════════ مساجد ومراكز دينية ═══════════════
('جامع نور الإسلام الكبير', 'Nour Al-Islam Grand Mosque', 'mosque', '{"lat":36.1923,"lng":44.0089}', erb_gov, true),
('مسجد الشهيد خالد', 'Shaheed Khalid Mosque', 'mosque', '{"lat":36.1867,"lng":44.0134}', erb_gov, true),
('جامع الرحمن', 'Al-Rahman Mosque', 'mosque', '{"lat":36.1945,"lng":44.0178}', erb_gov, true),
('مسجد آنكاوا الكبير', 'Ankawa Grand Mosque', 'mosque', '{"lat":36.2189,"lng":43.9978}', erb_gov, true),

-- ═══════════════ مدارس ═══════════════
('ثانوية كمال أتاتورك', 'Kamal Ataturk High School', 'school', '{"lat":36.1912,"lng":44.0145}', erb_gov, true),
('مدرسة الرواد التجريبية', 'Al-Rawad Experimental School', 'school', '{"lat":36.1934,"lng":44.0167}', erb_gov, true),
('مدرسة آنكاوا الأساسية', 'Ankawa Primary School', 'school', '{"lat":36.2167,"lng":43.9989}', erb_gov, true),
('ثانوية دارتو', 'Daratu High School', 'school', '{"lat":36.2134,"lng":44.0312}', erb_gov, true),
('مدرسة البيان النموذجية', 'Al-Bayan Model School', 'school', '{"lat":36.1889,"lng":44.0201}', erb_gov, true),

-- ═══════════════ محطات وقود ومرافق ═══════════════
('محطة كهرمانة للوقود', 'Kahramana Gas Station', 'gas_station', '{"lat":36.1923,"lng":44.0056}', erb_gov, true),
('محطة الشمال للوقود', 'North Gas Station', 'gas_station', '{"lat":36.2145,"lng":44.0089}', erb_gov, true),
('محطة آنكاوا للوقود', 'Ankawa Gas Station', 'gas_station', '{"lat":36.2178,"lng":43.9967}', erb_gov, true),

-- ═══════════════ دوائر حكومية ═══════════════
('مديرية مرور أربيل', 'Erbil Traffic Directorate', 'government', '{"lat":36.1934,"lng":44.0134}', erb_gov, true),
('محكمة أربيل الإستئنافية', 'Erbil Appeals Court', 'government', '{"lat":36.1912,"lng":44.0067}', erb_gov, true),
('مديرية جوازات أربيل', 'Erbil Passport Directorate', 'government', '{"lat":36.1945,"lng":44.0089}', erb_gov, true),
('مديرية تسجيل عقارات أربيل', 'Erbil Real Estate Registration', 'government', '{"lat":36.1923,"lng":44.0101}', erb_gov, true),
('غرفة تجارة وصناعة أربيل', 'Erbil Chamber of Commerce', 'government', '{"lat":36.1901,"lng":44.0078}', erb_gov, true)

ON CONFLICT DO NOTHING;

END $$;

-- تأكيد
SELECT COUNT(*) as total_inserted,
       category,
       COUNT(*) as per_category
FROM public.landmarks
WHERE governorate_id = '354d3286-0bc3-4c11-b450-b682b3829fcc'
GROUP BY category
ORDER BY per_category DESC;
