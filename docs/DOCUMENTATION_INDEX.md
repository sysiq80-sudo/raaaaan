# فهرس التوثيق
> تاريخ التحديث: 2026-05-31 (تحديث شامل — الجلسة الثالثة)

## التوثيق النشط (Active)

| الملف | النوع | الحالة | الوصف |
|---|---|---|---|
| [PROJECT_SCAN_REPORT.md](PROJECT_SCAN_REPORT.md) | تقرير تقني | ✅ نشط | فحص شامل للتقنيات والهيكل |
| [ACTUAL_SYSTEM_STATUS.md](ACTUAL_SYSTEM_STATUS.md) | تقرير تقني | ✅ نشط | حالة كل ميزة مبنية على الكود الفعلي |
| [ARCHITECTURE.md](ARCHITECTURE.md) | توثيق تقني | ✅ نشط | بنية النظام وطبقاته |
| [DATABASE.md](DATABASE.md) | توثيق تقني | ✅ نشط | جداول قاعدة البيانات + migrations |
| [AUTH_AND_PERMISSIONS.md](AUTH_AND_PERMISSIONS.md) | توثيق تقني | ✅ نشط | المصادقة والأدوار والصلاحيات |
| [API_REFERENCE.md](API_REFERENCE.md) | مرجع تقني | ✅ نشط | 55 Edge Function + RPCs |
| [UI_UX_MAP.md](UI_UX_MAP.md) | خريطة | ✅ نشط | كل الصفحات والمكونات |
| [SECURITY_AUDIT.md](SECURITY_AUDIT.md) | تدقيق | ✅ نشط | تدقيق أمني شامل |
| [TESTING_AND_QA.md](TESTING_AND_QA.md) | تقرير | ✅ نشط | الاختبارات والجودة |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | دليل | ✅ نشط | دليل التشغيل المحلي |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | دليل | ✅ نشط | دليل النشر |
| [HANDOFF_CHECKLIST.md](HANDOFF_CHECKLIST.md) | قائمة فحص | ✅ نشط | قائمة فحص التسليم |
| [FINAL_HANDOFF_REPORT.md](FINAL_HANDOFF_REPORT.md) | تقرير | ✅ نشط | تقرير التسليم النهائي + درجة الجاهزية |
| [DISPATCH_V2.md](DISPATCH_V2.md) | توثيق تقني | ✅ نشط | نظام التوزيع v2 + ETA ذكي |
| [EDGE_FUNCTION_SECURITY.md](EDGE_FUNCTION_SECURITY.md) | توثيق أمني | ✅ نشط | أمان Edge Functions |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | دليل | ✅ نشط | حلول المشاكل الشائعة |
| [MAPS_STRATEGY.md](MAPS_STRATEGY.md) | استراتيجية | ✅ نشط | تسعير Google Maps + تحليل Baly + خطة التوفير |

## التوثيق المطلوب مراجعته

| الملف | النوع | الحالة | ملاحظات |
|---|---|---|---|
| [FUTURE_FEATURES.md](FUTURE_FEATURES.md) | خطة | 🟡 يحتاج مراجعة | قد تكون بعض الميزات نُفذت — يحتاج مقارنة بالكود |
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | تقرير | 🟡 يحتاج مراجعة | 27KB — قد يتضارب مع `ACTUAL_SYSTEM_STATUS.md` |

## التوثيق المتعلق بالتحديثات

| الملف | النوع | الحالة | ملاحظات |
|---|---|---|---|
| `UPDATES_2026-05-23.md` | ملاحظات تطوير | 📋 مرجعي | تحديثات 23 مايو 2026 |
| `UPDATES_2026-05-26.md` | ملاحظات تطوير | 📋 مرجعي | تحديثات 26 مايو 2026 |
| `UPDATES_2026-05-27.md` | ملاحظات تطوير | 📋 مرجعي | تحديثات 27 مايو 2026 |
| *(جلسة 2026-05-29/31)* | Financial Audit | 📋 موثق في FINAL_HANDOFF_REPORT | Financial DR Audit + Watchdog E2E PASS=11 |
| *(جلسة 2026-05-31 مساء)* | Maps + ETA + Fare | 📋 موثق في FINAL_HANDOFF_REPORT | OSRM ETA + Leaflet fallback + routeDuration end-to-end + server sanity bounds |

## التوثيق المفقود (Missing)

| الملف المطلوب | الأهمية | ملاحظات |
|---|---|---|
| `docs/CHANGELOG.md` | 🟡 مهمة | لا يوجد سجل تغييرات رسمي — ملفات `UPDATES_*.md` موزعة بالجذر |
| `docs/CONTRIBUTING.md` | 🟢 ثانوية | لا يوجد دليل للمساهمة |
| `docs/ENV_VARIABLES.md` | 🔴 حرجة | `.env.example` جيد لكن يحتاج شرح أوسع لكل متغير |

## أسئلة معلقة
- هل `PROJECT_STATUS.md` و `ACTUAL_SYSTEM_STATUS.md` مكررين أم لكل منهما غرض مختلف؟
