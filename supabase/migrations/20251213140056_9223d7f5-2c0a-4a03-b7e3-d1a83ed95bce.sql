-- Insert famous Baghdad landmarks
INSERT INTO public.landmarks (name_ar, name_en, category, location, is_active) VALUES
-- مناطق تجارية ومولات
('مول بغداد', 'Baghdad Mall', 'مول', '{"lat": 33.3128, "lng": 44.3615}', true),
('المنصور مول', 'Mansour Mall', 'مول', '{"lat": 33.3089, "lng": 44.3456}', true),
('مول الزوراء', 'Al-Zawraa Mall', 'مول', '{"lat": 33.3245, "lng": 44.3789}', true),
('أسواق الكرادة', 'Karrada Markets', 'سوق', '{"lat": 33.2945, "lng": 44.4123}', true),

-- جامعات ومؤسسات تعليمية
('جامعة بغداد', 'University of Baghdad', 'جامعة', '{"lat": 33.2678, "lng": 44.3834}', true),
('الجامعة المستنصرية', 'Al-Mustansiriya University', 'جامعة', '{"lat": 33.3512, "lng": 44.3956}', true),
('جامعة التكنولوجيا', 'University of Technology', 'جامعة', '{"lat": 33.3145, "lng": 44.4267}', true),
('كلية الطب بغداد', 'Baghdad Medical College', 'كلية', '{"lat": 33.3234, "lng": 44.4012}', true),

-- مستشفيات
('مستشفى ابن سينا', 'Ibn Sina Hospital', 'مستشفى', '{"lat": 33.3156, "lng": 44.4089}', true),
('مستشفى اليرموك', 'Yarmouk Hospital', 'مستشفى', '{"lat": 33.3067, "lng": 44.3512}', true),
('مستشفى الكاظمية', 'Kadhimiya Hospital', 'مستشفى', '{"lat": 33.3789, "lng": 44.3534}', true),
('مدينة الطب', 'Medical City', 'مستشفى', '{"lat": 33.3145, "lng": 44.4189}', true),

-- معالم تاريخية وسياحية
('ساحة الفردوس', 'Firdos Square', 'ميدان', '{"lat": 33.3123, "lng": 44.3789}', true),
('ساحة التحرير', 'Tahrir Square', 'ميدان', '{"lat": 33.3256, "lng": 44.3912}', true),
('نصب الحرية', 'Freedom Monument', 'نصب', '{"lat": 33.3256, "lng": 44.3912}', true),
('برج بغداد', 'Baghdad Tower', 'برج', '{"lat": 33.3189, "lng": 44.3867}', true),

-- مراكز دينية
('مرقد الكاظمين', 'Kadhimiya Shrine', 'مزار', '{"lat": 33.3812, "lng": 44.3423}', true),
('جامع أم القرى', 'Umm al-Qura Mosque', 'مسجد', '{"lat": 33.3034, "lng": 44.3678}', true),
('جامع أبو حنيفة', 'Abu Hanifa Mosque', 'مسجد', '{"lat": 33.3567, "lng": 44.3789}', true),

-- نقاط نقل ومواصلات
('مطار بغداد الدولي', 'Baghdad International Airport', 'مطار', '{"lat": 33.2625, "lng": 44.2346}', true),
('الكراج العام', 'Main Bus Station', 'محطة', '{"lat": 33.3345, "lng": 44.4023}', true),
('موقف العلاوي', 'Alawi Bus Stop', 'محطة', '{"lat": 33.3412, "lng": 44.3756}', true),

-- فنادق معروفة
('فندق فلسطين', 'Palestine Hotel', 'فندق', '{"lat": 33.3145, "lng": 44.3823}', true),
('فندق بابل', 'Babylon Hotel', 'فندق', '{"lat": 33.3078, "lng": 44.3912}', true),
('فندق المنصور ميليا', 'Mansour Melia Hotel', 'فندق', '{"lat": 33.3098, "lng": 44.3489}', true),

-- مناطق ترفيهية
('متنزه الزوراء', 'Al-Zawraa Park', 'متنزه', '{"lat": 33.3234, "lng": 44.3756}', true),
('جزيرة بغداد السياحية', 'Baghdad Island', 'متنزه', '{"lat": 33.3567, "lng": 44.3623}', true),

-- أحياء رئيسية
('شارع المتنبي', 'Mutanabbi Street', 'شارع', '{"lat": 33.3234, "lng": 44.3912}', true),
('شارع السعدون', 'Saadoun Street', 'شارع', '{"lat": 33.3156, "lng": 44.3956}', true),
('شارع فلسطين', 'Palestine Street', 'شارع', '{"lat": 33.3312, "lng": 44.4123}', true);
