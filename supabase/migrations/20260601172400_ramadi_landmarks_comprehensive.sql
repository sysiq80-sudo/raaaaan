-- ════════════════════════════════════════════════════════════════════
-- معالم وأحياء مدينة الرمادي ومحافظة الأنبار — إدراج شامل
-- الإحداثيات: مصدر أساسي geocoding.ts + معرفة جغرافية مؤكدة
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  anb UUID;
BEGIN
  -- أحاول code أولاً، ثم name_ar كـ fallback
  SELECT id INTO anb FROM public.governorates WHERE code = 'AN' LIMIT 1;
  IF anb IS NULL THEN
    SELECT id INTO anb FROM public.governorates WHERE name_ar = 'الأنبار' LIMIT 1;
  END IF;
  IF anb IS NULL THEN
    RAISE EXCEPTION 'محافظة الأنبار غير موجودة في جدول governorates';
  END IF;


  -- ═══════════════ أحياء سكنية — الرمادي (مؤكدة من geocoding.ts) ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('حي التأميم',   'Al-Tameem District',       'residential', '{"lat":33.4350,"lng":43.3100}', anb, true),
    ('حي الحوز',     'Al-Hawz District',         'residential', '{"lat":33.4200,"lng":43.3150}', anb, true),
    ('حي الملعب',    'Al-Malaab District',       'residential', '{"lat":33.4300,"lng":43.2900}', anb, true),
    ('حي الضباط',    'Al-Dhubbat District',      'residential', '{"lat":33.4150,"lng":43.2850}', anb, true),
    ('حي العزيزية',  'Al-Aziziya District',      'residential', '{"lat":33.4180,"lng":43.3200}', anb, true),
    ('حي خمسة كيلو','Five Kilo District',        'residential', '{"lat":33.4100,"lng":43.2750}', anb, true),
    ('حي العشرين',   'Al-Ishreen District',      'residential', '{"lat":33.4220,"lng":43.2800}', anb, true),
    ('حي البكر',     'Al-Bakr District',         'residential', '{"lat":33.4280,"lng":43.2950}', anb, true),
    ('حي الورار',    'Al-Warar District',        'residential', '{"lat":33.4320,"lng":43.3200}', anb, true),
    ('حي السلام',    'Al-Salam District',        'residential', '{"lat":33.4250,"lng":43.2700}', anb, true),
    ('حي المعلمين',  'Al-Muallimeen District',   'residential', '{"lat":33.4150,"lng":43.3050}', anb, true),
    ('حي الأندلس',   'Al-Andalus District',      'residential', '{"lat":33.4100,"lng":43.3100}', anb, true),
    ('حي الثيلة',    'Al-Theela District',       'residential', '{"lat":33.4300,"lng":43.3150}', anb, true),
    ('حي القطانة',   'Al-Qatana District',       'residential', '{"lat":33.4270,"lng":43.3180}', anb, true),
    ('حي السفحة',    'Al-Safha District',        'residential', '{"lat":33.4350,"lng":43.3050}', anb, true),
    ('حي البوذياب',  'Al-Bouziyab District',     'residential', '{"lat":33.4380,"lng":43.2900}', anb, true),
    ('حي الروضة',    'Al-Rawdha District',       'residential', '{"lat":33.4180,"lng":43.2900}', anb, true),
    ('حي الجزيرة',   'Al-Jazira District',       'residential', '{"lat":33.4300,"lng":43.2800}', anb, true),
    ('حي التقدم',    'Al-Taqaddum District',     'residential', '{"lat":33.4100,"lng":43.2650}', anb, true),
    ('حي الطيران',   'Al-Tayaran District',      'residential', '{"lat":33.4050,"lng":43.2800}', anb, true),
    ('حي الصوفية',   'Al-Sufiya District',       'residential', '{"lat":33.4280,"lng":43.3100}', anb, true),
    ('حي الجمهوري',  'Al-Jumhuri District',      'residential', '{"lat":33.4210,"lng":43.3060}', anb, true),
    ('حي الشرطة',    'Al-Shurta District',       'residential', '{"lat":33.4190,"lng":43.2980}', anb, true),
    ('حي المعاضيد',  'Al-Muadheed District',     'residential', '{"lat":33.4330,"lng":43.2970}', anb, true),
    ('البوعلوان',     'Al-Boualiwan',             'residential', '{"lat":33.4400,"lng":43.2800}', anb, true),
    ('حي الإسكان',   'Al-Iskan District',        'residential', '{"lat":33.4160,"lng":43.3080}', anb, true),
    ('حي الصباح',    'Al-Sabah District',        'residential', '{"lat":33.4245,"lng":43.2860}', anb, true),
    ('حي النداء',    'Al-Nida District',         'residential', '{"lat":33.4260,"lng":43.2980}', anb, true),
    ('حي الكرامة',   'Al-Karama District',       'residential', '{"lat":33.4230,"lng":43.2920}', anb, true),
    ('حي المهندسين', 'Al-Muhandiseen District',  'residential', '{"lat":33.4195,"lng":43.3070}', anb, true);

  -- ═══════════════ شوارع ومعالم رئيسية (مؤكدة من geocoding.ts) ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('تقاطع الزيوت',  'Al-Zuyoot Intersection',  'landmark', '{"lat":33.4240,"lng":43.3000}', anb, true),
    ('شارع المستودع', 'Al-Mustawda Street',       'landmark', '{"lat":33.4200,"lng":43.2950}', anb, true),
    ('الشارع العام',  'Al-Sharai Al-Aam',         'landmark', '{"lat":33.4230,"lng":43.3000}', anb, true),
    ('شارع فلسطين',   'Palestine Street Ramadi',  'landmark', '{"lat":33.4250,"lng":43.2950}', anb, true),
    ('شارع 60 رمادي', 'Street 60 Ramadi',         'landmark', '{"lat":33.4200,"lng":43.2700}', anb, true),
    ('الجسر الحديدي', 'Iron Bridge Ramadi',        'landmark', '{"lat":33.4230,"lng":43.3080}', anb, true),
    ('شارع 17 رمادي', 'Street 17 Ramadi',         'landmark', '{"lat":33.4248,"lng":43.2958}', anb, true),
    ('كورنيش الفرات', 'Euphrates Corniche Ramadi', 'landmark', '{"lat":33.4248,"lng":43.3082}', anb, true),
    ('ملعب الرمادي',  'Ramadi Stadium',            'landmark', '{"lat":33.4300,"lng":43.2900}', anb, true);

  -- ═══════════════ مستشفيات ومراكز صحية ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('دائرة صحة الأنبار',       'Anbar Health Directorate',      'hospital', '{"lat":33.4260,"lng":43.3010}', anb, true),
    ('مستشفى الرمادي العام',     'Ramadi General Hospital',        'hospital', '{"lat":33.4283,"lng":43.2945}', anb, true),
    ('مستشفى الأم والطفل رمادي','Mother and Child Hospital',       'hospital', '{"lat":33.4268,"lng":43.3012}', anb, true),
    ('مستشفى الرمادي للأطفال',  'Ramadi Children Hospital',        'hospital', '{"lat":33.4275,"lng":43.2980}', anb, true),
    ('مركز صحي الرمادي المركزي','Ramadi Central Health Center',    'hospital', '{"lat":33.4220,"lng":43.3045}', anb, true),
    ('مركز صحي التأميم',         'Tameem Health Center',           'hospital', '{"lat":33.4348,"lng":43.3095}', anb, true),
    ('مركز صحي الملعب',          'Malaab Health Center',           'hospital', '{"lat":33.4298,"lng":43.2895}', anb, true);

  -- ═══════════════ مساجد وجوامع ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('الجامع الكبير الرمادي',   'Grand Mosque of Ramadi',        'mosque', '{"lat":33.4235,"lng":43.3065}', anb, true),
    ('جامع الصحابة رمادي',      'Al-Sahaba Mosque Ramadi',       'mosque', '{"lat":33.4245,"lng":43.2998}', anb, true),
    ('جامع النور رمادي',        'Al-Noor Mosque Ramadi',         'mosque', '{"lat":33.4212,"lng":43.3022}', anb, true),
    ('جامع أبو حنيفة رمادي',   'Abu Hanifa Mosque Ramadi',      'mosque', '{"lat":33.4195,"lng":43.3082}', anb, true),
    ('جامع الحسين رمادي',       'Al-Hussain Mosque Ramadi',      'mosque', '{"lat":33.4225,"lng":43.2960}', anb, true),
    ('جامع عمر بن الخطاب',     'Omar Ibn Khattab Mosque',       'mosque', '{"lat":33.4265,"lng":43.3045}', anb, true);

  -- ═══════════════ جامعات وكليات ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('الحرم الجامعي — جامعة الأنبار','Anbar University Main Campus',          'university', '{"lat":33.4350,"lng":43.2650}', anb, true),
    ('كلية الطب — جامعة الأنبار',    'College of Medicine Anbar University',  'university', '{"lat":33.4345,"lng":43.2640}', anb, true),
    ('كلية الهندسة — جامعة الأنبار', 'College of Engineering Anbar Univ',     'university', '{"lat":33.4340,"lng":43.2645}', anb, true),
    ('كلية العلوم — جامعة الأنبار',  'College of Sciences Anbar University',  'university', '{"lat":33.4355,"lng":43.2655}', anb, true),
    ('كلية القانون — جامعة الأنبار', 'College of Law Anbar University',       'university', '{"lat":33.4348,"lng":43.2660}', anb, true),
    ('المعهد التقني الرمادي',         'Ramadi Technical Institute',            'university', '{"lat":33.4150,"lng":43.2985}', anb, true),
    ('كلية التمريض — جامعة الأنبار', 'College of Nursing Anbar University',   'university', '{"lat":33.4352,"lng":43.2648}', anb, true);

  -- ═══════════════ مدارس ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('ثانوية الرمادي الأولى للبنين', 'Ramadi First Boys High School',   'school', '{"lat":33.4245,"lng":43.3005}', anb, true),
    ('ثانوية الرمادي للبنات',        'Ramadi Girls High School',         'school', '{"lat":33.4238,"lng":43.3018}', anb, true),
    ('مدرسة الفاروق الابتدائية',     'Al-Farouk Primary School',         'school', '{"lat":33.4215,"lng":43.2975}', anb, true),
    ('مدرسة الجمهوري الابتدائية',    'Al-Jumhuri Primary School',        'school', '{"lat":33.4212,"lng":43.3055}', anb, true),
    ('ثانوية حي التأميم',            'Tameem District High School',      'school', '{"lat":33.4345,"lng":43.3095}', anb, true);

  -- ═══════════════ دوائر حكومية ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('مديرية شرطة الأنبار',    'Anbar Police Directorate',        'government', '{"lat":33.4228,"lng":43.3014}', anb, true),
    ('مديرية تربية الأنبار',   'Anbar Education Directorate',     'government', '{"lat":33.4198,"lng":43.3058}', anb, true),
    ('دائرة جوازات الرمادي',   'Ramadi Passport Office',          'government', '{"lat":33.4212,"lng":43.3032}', anb, true),
    ('محكمة استئناف الأنبار',  'Anbar Appeals Court',             'government', '{"lat":33.4222,"lng":43.3026}', anb, true),
    ('غرفة تجارة الأنبار',     'Anbar Chamber of Commerce',       'government', '{"lat":33.4218,"lng":43.3042}', anb, true),
    ('مديرية بلدية الرمادي',   'Ramadi Municipality Directorate', 'government', '{"lat":33.4218,"lng":43.3060}', anb, true),
    ('مديرية كهرباء الأنبار',  'Anbar Electricity Directorate',   'government', '{"lat":33.4200,"lng":43.3040}', anb, true),
    ('مديرية نفوس الرمادي',    'Ramadi Civil Registry',           'government', '{"lat":33.4210,"lng":43.3028}', anb, true),
    ('مديرية الزراعة الأنبار', 'Anbar Agriculture Directorate',   'government', '{"lat":33.4195,"lng":43.3020}', anb, true);

  -- ═══════════════ محطات وقود ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('محطة وقود شمال الرمادي', 'North Ramadi Gas Station',  'gas_station', '{"lat":33.4378,"lng":43.3052}', anb, true),
    ('محطة وقود جنوب الرمادي', 'South Ramadi Gas Station',  'gas_station', '{"lat":33.4102,"lng":43.3012}', anb, true),
    ('محطة وقود التأميم',      'Tameem Gas Station',        'gas_station', '{"lat":33.4348,"lng":43.3098}', anb, true),
    ('محطة وقود الضباط',       'Al-Dhubbat Gas Station',    'gas_station', '{"lat":33.4148,"lng":43.2848}', anb, true),
    ('محطة وقود الورار',       'Al-Warar Gas Station',      'gas_station', '{"lat":33.4318,"lng":43.3198}', anb, true);

  -- ═══════════════ فنادق ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('فندق دجلة والفرات', 'Tigris and Euphrates Hotel', 'hotel', '{"lat":33.4237,"lng":43.3057}', anb, true),
    ('فندق الأنبار',      'Al-Anbar Hotel',             'hotel', '{"lat":33.4240,"lng":43.3040}', anb, true);

  -- ═══════════════ أسواق وتجارة ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('السوق المركزي',        'Ramadi Central Market',    'market', '{"lat":33.4235,"lng":43.3020}', anb, true),
    ('سوق السمانة',          'Al-Samana Market',          'market', '{"lat":33.4232,"lng":43.3082}', anb, true),
    ('سوق الخضروات',         'Vegetable Market Ramadi',   'market', '{"lat":33.4218,"lng":43.3096}', anb, true),
    ('السوق الشعبي',         'Popular Market Ramadi',     'market', '{"lat":33.4227,"lng":43.3057}', anb, true),
    ('سوق السيارات رمادي',   'Ramadi Car Market',         'market', '{"lat":33.4120,"lng":43.2900}', anb, true),
    ('كراج بغداد رمادي',     'Baghdad Garage Ramadi',     'station','{"lat":33.4155,"lng":43.3060}', anb, true);

  -- ═══════════════ أقضية ومدن محافظة الأنبار ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('الفلوجة',        'Fallujah City',      'landmark', '{"lat":33.3530,"lng":43.7830}', anb, true),
    ('هيت',            'Hit City',           'landmark', '{"lat":33.6390,"lng":42.8270}', anb, true),
    ('حديثة',          'Haditha City',       'landmark', '{"lat":34.1370,"lng":42.3790}', anb, true),
    ('القائم',         'Al-Qaim City',       'landmark', '{"lat":34.3856,"lng":41.0123}', anb, true),
    ('الخالدية',       'Al-Khalidiya',       'landmark', '{"lat":33.4800,"lng":43.4900}', anb, true),
    ('عامرية الفلوجة', 'Amariya Al-Fallujah','landmark', '{"lat":33.2850,"lng":43.5800}', anb, true),
    ('الكرمة',         'Al-Karma',           'landmark', '{"lat":33.4300,"lng":43.9200}', anb, true),
    ('الرحالية',       'Al-Ruhailiya',       'landmark', '{"lat":33.3900,"lng":43.2400}', anb, true),
    ('الحبانية',       'Al-Habbaniya',       'landmark', '{"lat":33.3600,"lng":43.5700}', anb, true),
    ('البغدادي',       'Al-Baghdadi',        'landmark', '{"lat":34.1700,"lng":42.7300}', anb, true),
    ('عنه',            'Anah City',          'landmark', '{"lat":34.3630,"lng":41.9990}', anb, true),
    ('راوة',           'Rawa City',          'landmark', '{"lat":34.4770,"lng":41.9160}', anb, true),
    ('الرطبة',         'Al-Rutba',           'landmark', '{"lat":33.0400,"lng":40.2830}', anb, true);

  -- ═══════════════ معالم الفلوجة ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('مستشفى الفلوجة التعليمي',    'Fallujah Teaching Hospital',  'hospital',    '{"lat":33.3510,"lng":43.7810}', anb, true),
    ('جامعة الأنبار فرع الفلوجة',  'Anbar University Fallujah',   'university',  '{"lat":33.3468,"lng":43.7860}', anb, true),
    ('بلدية الفلوجة',               'Fallujah Municipality',        'government',  '{"lat":33.3528,"lng":43.7845}', anb, true),
    ('سوق الفلوجة المركزي',         'Fallujah Central Market',      'market',      '{"lat":33.3520,"lng":43.7870}', anb, true),
    ('حي المعلمين فلوجة',           'Teachers District Fallujah',   'residential', '{"lat":33.3495,"lng":43.7820}', anb, true),
    ('حي الشهداء فلوجة',            'Martyrs District Fallujah',    'residential', '{"lat":33.3520,"lng":43.7830}', anb, true),
    ('حي النازل فلوجة',             'Al-Nazel District Fallujah',   'residential', '{"lat":33.3540,"lng":43.7850}', anb, true);

  -- ═══════════════ معالم هيت ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('مستشفى هيت العام',  'Hit General Hospital', 'hospital',   '{"lat":33.6445,"lng":42.8235}', anb, true),
    ('بلدية هيت',          'Hit Municipality',      'government', '{"lat":33.6450,"lng":42.8255}', anb, true),
    ('الجامع الكبير هيت',  'Hit Grand Mosque',      'mosque',     '{"lat":33.6452,"lng":42.8262}', anb, true),
    ('قلعة هيت الأثرية',   'Hit Ancient Citadel',   'landmark',   '{"lat":33.6438,"lng":42.8248}', anb, true);

  -- ═══════════════ معالم حديثة ═══════════════
  INSERT INTO public.landmarks (name_ar, name_en, category, location, governorate_id, is_active) VALUES
    ('سد حديثة',           'Haditha Dam',              'landmark',   '{"lat":34.1460,"lng":42.3650}', anb, true),
    ('مستشفى حديثة العام', 'Haditha General Hospital', 'hospital',   '{"lat":34.1365,"lng":42.3785}', anb, true),
    ('بلدية حديثة',        'Haditha Municipality',     'government', '{"lat":34.1372,"lng":42.3795}', anb, true);

END $$;
