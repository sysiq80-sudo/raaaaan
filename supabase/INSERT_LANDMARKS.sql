-- ترحيل: إضافة معالم أربيل والأنبار
-- كل معلم مرتبط بمحافظته الصحيحة

DO $$
DECLARE
    erbil_id UUID;
    anbar_id UUID;
BEGIN
    -- الحصول على IDs المحافظات
    SELECT id INTO erbil_id FROM governorates WHERE name_ar = 'أربيل';
    SELECT id INTO anbar_id FROM governorates WHERE name_ar = 'الأنبار';

    -- التحقق من وجود المحافظات
    IF erbil_id IS NULL THEN
        RAISE EXCEPTION 'محافظة أربيل غير موجودة في قاعدة البيانات';
    END IF;
    
    IF anbar_id IS NULL THEN
        RAISE EXCEPTION 'محافظة الأنبار غير موجودة في قاعدة البيانات';
    END IF;

    -- إدراج معالم أربيل (14 معلم)
    INSERT INTO landmarks (name_ar, name_en, category, governorate_id, location, is_active) VALUES
    ('قلعة أربيل', 'Erbil Citadel', 'landmark', erbil_id, '{"lat": 36.1913, "lng": 44.0092}', true),
    ('مطار أربيل الدولي', 'Erbil International Airport', 'airport', erbil_id, '{"lat": 36.2375, "lng": 43.9632}', true),
    ('جامعة صلاح الدين', 'Salahaddin University', 'university', erbil_id, '{"lat": 36.1897, "lng": 44.0089}', true),
    ('مستشفى الطوارئ أربيل', 'Erbil Emergency Hospital', 'hospital', erbil_id, '{"lat": 36.1875, "lng": 44.0125}', true),
    ('مجمع فاميلي مول', 'Family Mall', 'market', erbil_id, '{"lat": 36.1823, "lng": 44.0234}', true),
    ('ماجدي مول', 'Majidi Mall', 'market', erbil_id, '{"lat": 36.1945, "lng": 44.0312}', true),
    ('مستشفى راپرین', 'Raparin Hospital', 'hospital', erbil_id, '{"lat": 36.1789, "lng": 44.0156}', true),
    ('جامع جليل الخياط', 'Jalil Al-Khayat Mosque', 'mosque', erbil_id, '{"lat": 36.1901, "lng": 44.0078}', true),
    ('محطة وقود Total', 'Total Gas Station', 'gas_station', erbil_id, '{"lat": 36.1834, "lng": 44.0289}', true),
    ('فندق روتانا', 'Rotana Hotel', 'hotel', erbil_id, '{"lat": 36.1912, "lng": 44.0145}', true),
    ('مطعم ماسترو', 'Mastro Restaurant', 'restaurant', erbil_id, '{"lat": 36.1856, "lng": 44.0198}', true),
    ('مستشفى نانكلي', 'Nanakaly Hospital', 'hospital', erbil_id, '{"lat": 36.1923, "lng": 44.0267}', true),
    ('جامعة هولير الطبية', 'Hawler Medical University', 'university', erbil_id, '{"lat": 36.1867, "lng": 44.0134}', true),
    ('سوق القيصرية', 'Qaysari Bazaar', 'market', erbil_id, '{"lat": 36.1908, "lng": 44.0087}', true);

    -- إدراج معالم الأنبار (17 معلم)
    INSERT INTO landmarks (name_ar, name_en, category, governorate_id, location, is_active) VALUES
    ('مطار الرمادي', 'Ramadi Airport', 'airport', anbar_id, '{"lat": 33.4242, "lng": 43.3145}', true),
    ('جامعة الأنبار', 'University of Anbar', 'university', anbar_id, '{"lat": 33.4189, "lng": 43.3076}', true),
    ('مستشفى الرمادي التعليمي', 'Ramadi Teaching Hospital', 'hospital', anbar_id, '{"lat": 33.4234, "lng": 43.3012}', true),
    ('جامع الحضرة', 'Al-Hadra Mosque', 'mosque', anbar_id, '{"lat": 33.4201, "lng": 43.3098}', true),
    ('سوق الرمادي المركزي', 'Ramadi Central Market', 'market', anbar_id, '{"lat": 33.4178, "lng": 43.3089}', true),
    ('مستشفى الفلوجة العام', 'Fallujah General Hospital', 'hospital', anbar_id, '{"lat": 33.3489, "lng": 43.7834}', true),
    ('مسجد الفلوجة الكبير', 'Fallujah Grand Mosque', 'mosque', anbar_id, '{"lat": 33.3512, "lng": 43.7801}', true),
    ('محطة وقود الرمادي', 'Ramadi Gas Station', 'gas_station', anbar_id, '{"lat": 33.4156, "lng": 43.3123}', true),
    ('جامع القائم الكبير', 'Al-Qaim Grand Mosque', 'mosque', anbar_id, '{"lat": 34.3856, "lng": 41.0123}', true),
    ('مستشفى القائم العام', 'Al-Qaim General Hospital', 'hospital', anbar_id, '{"lat": 34.3878, "lng": 41.0145}', true),
    ('كلية التربية - جامعة الأنبار', 'College of Education - Anbar University', 'university', anbar_id, '{"lat": 33.4167, "lng": 43.3098}', true),
    ('مدرسة الرمادي الثانوية', 'Ramadi High School', 'school', anbar_id, '{"lat": 33.4145, "lng": 43.3067}', true),
    ('مبنى محافظة الأنبار', 'Anbar Governorate Building', 'government', anbar_id, '{"lat": 33.4212, "lng": 43.3034}', true),
    ('موقف الرمادي المركزي', 'Ramadi Central Bus Station', 'station', anbar_id, '{"lat": 33.4198, "lng": 43.3056}', true),
    ('حديقة الرمادي العامة', 'Ramadi Public Park', 'landmark', anbar_id, '{"lat": 33.4167, "lng": 43.3098}', true),
    ('مول الرمادي التجاري', 'Ramadi Commercial Mall', 'market', anbar_id, '{"lat": 33.4223, "lng": 43.3112}', true),
    ('فندق الرمادي', 'Ramadi Hotel', 'hotel', anbar_id, '{"lat": 33.4189, "lng": 43.3078}', true);

    RAISE NOTICE 'تم إضافة 31 معلم بنجاح (14 لأربيل + 17 للأنبار)';
END $$;
