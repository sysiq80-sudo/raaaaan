-- ════════════════════════════════════════════════════════════════
-- إصلاح أسماء المعالم العربية المتلفة
-- السبب: خلل في ترميز الإدخال الأصلي — name_ar مخزّن كـ "????"
-- الحل: تحديث name_ar بالأسماء العربية الصحيحة بالاستناد إلى name_en
-- ════════════════════════════════════════════════════════════════

-- ─── معالم بارزة ───────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'برج ساعة أربيل'           WHERE name_en = 'Erbil Clock Tower'             AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'ستاد فرانسو هريري'         WHERE name_en = 'Franso Hariri Stadium'          AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حديقة سامي عبدالرحمن'      WHERE name_en = 'Sami Abdulrahman Park'          AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حديقة شانيدار'              WHERE name_en = 'Shanidar Park'                  AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'قصر هيزار الثقافي'          WHERE name_en = 'Hezhar Cultural Palace'         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'بازار أربيل القديم'          WHERE name_en = 'Old Erbil Bazaar'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'متحف أربيل للحضارة'          WHERE name_en = 'Erbil Civilization Museum'      AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مجمع حكومة إقليم كردستان'   WHERE name_en = 'KRG Complex'                    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مبنى المحافظة'               WHERE name_en = 'Governorate Building'           AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منتجع بازيان السياحي'        WHERE name_en = 'Bazian Tourist Complex'         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منطقة صلاح الدين السياحية'  WHERE name_en = 'Salahaddin Tourist Area'        AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'شلالات شقلاوة'               WHERE name_en = 'Shaqlawa Waterfalls'            AND name_ar LIKE '%?%';

-- ─── جامعات وكليات ─────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'جامعة أربيل التقنية'         WHERE name_en = 'Erbil Technical University'    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'جامعة كويه'                   WHERE name_en = 'Koya University'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'الجامعة الأمريكية في أربيل'  WHERE name_en = 'American University of Erbil'  AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'جامعة ليفان'                  WHERE name_en = 'Livan University'              AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'جامعة المعرفة'                WHERE name_en = 'Knowledge University'          AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'جامعة بحر الغوم'              WHERE name_en = 'Bahr al-Ghoom University'      AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'جامعة كرميان'                 WHERE name_en = 'Karmian University'            AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'المعهد التقني أربيل'          WHERE name_en = 'Technical Institute Erbil'     AND name_ar LIKE '%?%';

-- ─── مستشفيات ───────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'مستشفى روژهلات'              WHERE name_en = 'Rozhalat Hospital'             AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى هيوا للسرطان'         WHERE name_en = 'Hiwa Cancer Hospital'          AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى جنان'                  WHERE name_en = 'Jinan Hospital'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى شاريا'                 WHERE name_en = 'Sharya Hospital'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى ريزكاري التعليمي'     WHERE name_en = 'Rizgary Teaching Hospital'     AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى جنيف'                  WHERE name_en = 'Geneva Hospital'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى رضوان'                 WHERE name_en = 'Rizwan Hospital'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'المستشفى الجمهوري أربيل'     WHERE name_en = 'Republican Hospital Erbil'     AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى كولان'                 WHERE name_en = 'Kolan Hospital'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مستشفى فرياد'                 WHERE name_en = 'Faryad Hospital'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'المركز الطبي المتخصص أربيل'  WHERE name_en = 'Erbil Specialized Medical Center' AND name_ar LIKE '%?%';

-- ─── مساجد ──────────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'جامع نور الإسلام الكبير'    WHERE name_en = 'Nour Al-Islam Grand Mosque'    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مسجد الشهيد خالد'            WHERE name_en = 'Shaheed Khalid Mosque'         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مسجد الرحمن'                  WHERE name_en = 'Al-Rahman Mosque'              AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'جامع عنكاوا الكبير'          WHERE name_en = 'Ankawa Grand Mosque'           AND name_ar LIKE '%?%';

-- ─── مدارس ──────────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'ثانوية كمال أتاتورك'         WHERE name_en = 'Kamal Ataturk High School'     AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مدرسة الرواد التجريبية'      WHERE name_en = 'Al-Rawad Experimental School'  AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مدرسة عنكاوا الابتدائية'     WHERE name_en = 'Ankawa Primary School'         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'ثانوية دراتو'                 WHERE name_en = 'Daratu High School'            AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مدرسة البيان النموذجية'       WHERE name_en = 'Al-Bayan Model School'         AND name_ar LIKE '%?%';

-- ─── محطات وقود ─────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'محطة وقود كهرمانة'           WHERE name_en = 'Kahramana Gas Station'         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'محطة وقود الشمال'             WHERE name_en = 'North Gas Station'             AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'محطة وقود عنكاوا'            WHERE name_en = 'Ankawa Gas Station'            AND name_ar LIKE '%?%';

-- ─── دوائر حكومية ───────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'مديرية مرور أربيل'            WHERE name_en = 'Erbil Traffic Directorate'     AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'محكمة استئناف أربيل'          WHERE name_en = 'Erbil Appeals Court'           AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مديرية جوازات أربيل'          WHERE name_en = 'Erbil Passport Directorate'    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'تسجيل العقارات أربيل'         WHERE name_en = 'Erbil Real Estate Registration' AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'غرفة تجارة أربيل'             WHERE name_en = 'Erbil Chamber of Commerce'     AND name_ar LIKE '%?%';

-- ─── مولات وأسواق ───────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'مول أربيل'                    WHERE name_en = 'Erbil Mall'                    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'ماجيك مول'                    WHERE name_en = 'Magic Mall'                    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'مول دريم سيتي'                WHERE name_en = 'Dream City Mall'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'لانكاوي مول'                  WHERE name_en = 'Langkawi Mall'                 AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'امباير مول'                    WHERE name_en = 'Empire Mall'                   AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'سوق شارع 60'                  WHERE name_en = 'Street 60 Market'              AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'سوق كهرمانة'                  WHERE name_en = 'Kahramana Market'              AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'فالكون مول'                   WHERE name_en = 'Falcon Mall'                   AND name_ar LIKE '%?%';

-- ─── فنادق ──────────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'فندق ديفان أربيل'             WHERE name_en = 'Divan Erbil Hotel'             AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'فندق روتانا أربيل'            WHERE name_en = 'Rotana Erbil Hotel'            AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'فندق كمبينسكي أربيل'          WHERE name_en = 'Kempinski Hotel Erbil'         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'فندق كلاريدج أربيل'           WHERE name_en = 'Claridge Hotel Erbil'          AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'فندق كراون بلازا أربيل'       WHERE name_en = 'Crowne Plaza Erbil'            AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'فندق حياة'                    WHERE name_en = 'Hayat Hotel'                   AND name_ar LIKE '%?%';

-- ─── أحياء سكنية ────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'حي آزادي'                     WHERE name_en = 'Azadi District'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي باغجه جوي'                 WHERE name_en = 'Bakhchajoy District'           AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي كاوه'                      WHERE name_en = 'Kawa District'                 AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي كوردان'                    WHERE name_en = 'Gurdan District'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي عنكاوا'                    WHERE name_en = 'Ankawa District'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'عينكاوا'                      WHERE name_en = 'Ainkawa'                       AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي عرفة'                      WHERE name_en = 'Arafa District'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي هولير'                     WHERE name_en = 'Hewler District'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي كونه ماسي'                 WHERE name_en = 'Kona Masi'                     AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'دراتو'                        WHERE name_en = 'Daratu'                        AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'باردارو'                      WHERE name_en = 'Bardaro'                       AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'بريمكه'                       WHERE name_en = 'Brimke'                        AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منطقة شارع 30'                WHERE name_en = 'Street 30 Area'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منطقة شارع 60'                WHERE name_en = 'Street 60 Area'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منطقة شارع 100'               WHERE name_en = 'Street 100 Area'               AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منطقة زاغروس'                 WHERE name_en = 'Zagros Area'                   AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'باشتابيا'                     WHERE name_en = 'Bashtabia'                     AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'منطقة كردستان'                WHERE name_en = 'Kurdistan Area'                AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'حي شقلاوة'                    WHERE name_en = 'Shaqlawa District'             AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'رستم آغا'                     WHERE name_en = 'Rustem Agha'                   AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'سانيا'                        WHERE name_en = 'Sania'                         AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'خورمالة'                      WHERE name_en = 'Khormala'                      AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'البلدية 1'                    WHERE name_en = 'Baladiya 1'                    AND name_ar LIKE '%?%';
UPDATE landmarks SET name_ar = 'البلدية 3'                    WHERE name_en = 'Baladiya 3'                    AND name_ar LIKE '%?%';

-- ─── شوارع ──────────────────────────────────────────────────────
UPDATE landmarks SET name_ar = 'شارع المئة متر'               WHERE name_en = '100m Street'                   AND name_ar LIKE '%?%';

-- ─── حذف المكررات التي صار لها نسخة عربية صحيحة ────────────────
-- (نفس الموقع + نفس الاسم الإنجليزي لكن name_ar مختلف)
-- نحافظ على النسخة صاحبة الاسم العربي الأطول (الأكثر وصفاً)
DELETE FROM landmarks a
USING landmarks b
WHERE a.name_en = b.name_en
  AND a.id <> b.id
  AND a.name_ar NOT LIKE '%?%'
  AND b.name_ar NOT LIKE '%?%'
  AND length(a.name_ar) < length(b.name_ar);

-- ─── تحقق نهائي — عرض ما تبقى متلفاً (يجب أن يكون صفراً) ────────
-- SELECT name_en, name_ar FROM landmarks WHERE name_ar LIKE '%?%';
