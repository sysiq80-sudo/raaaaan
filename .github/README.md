# 🛡️ نظام حماية تطبيق ران RAAN

هذا المجلد يحتوي على ملفات الحماية والتكوين للمشروع.

## 📁 محتويات المجلد

### 📄 الملفات الأساسية

1. **`copilot-instructions.md`** 🤖
   - تعليمات شاملة لـ GitHub Copilot و AI agents
   - قواعد التطوير والأنماط المتبعة
   - محظورات وموافقات مطلوبة
   - **يجب** قراءته من قبل جميع المساهمين

2. **`PROTECTION_RULES.md`** 🔒
   - قواعد حماية المستودع
   - إعدادات Branch Protection
   - قوائم التحقق (Checklists)
   - أمثلة على السيناريوهات المسموحة والممنوعة

3. **`CODEOWNERS`** 👥
   - تحديد ملاك الكود
   - الملفات التي تحتاج مراجعة إلزامية
   - المراجعين المطلوبين لكل قسم

### 🔄 Workflows

4. **`workflows/protection.yml`** ⚙️
   - GitHub Actions للفحص الآلي
   - فحص ملفات migrations
   - فحص عمليات الحذف
   - فحص الملفات الحساسة
   - فحص credentials المكشوفة

## 🚀 كيفية الاستخدام

### للمطورين الجدد:
1. اقرأ `copilot-instructions.md` **أولاً**
2. راجع `PROTECTION_RULES.md` لفهم القواعد
3. تأكد من فهم الـ Workflows

### للمساهمين:
1. اتبع القواعد في `copilot-instructions.md`
2. تأكد من تمرير جميع فحوصات الـ GitHub Actions
3. انتظر الموافقة على الـ Pull Requests للملفات الحساسة

### لـ AI Agents:
1. **يجب** قراءة `copilot-instructions.md` قبل أي عملية
2. **لا تتجاوز** القواعد الموضحة
3. **اطلب الموافقة** قبل:
   - أي git push أو commit
   - أي عملية delete من قاعدة البيانات
   - تعديل الملفات الحساسة

## ⚠️ تحذيرات مهمة

### 🚫 ممنوع منعاً باتاً:
- ❌ Push مباشر لـ `main` بدون PR
- ❌ تعديل `supabase/migrations/` بدون موافقة
- ❌ حذف بيانات من قاعدة البيانات بدون موافقة
- ❌ تعطيل RLS على أي جدول
- ❌ نشر credentials في الكود

### ✅ مسموح بعد الموافقة:
- ✔️ إضافة migrations جديدة
- ✔️ تعديل Edge Functions
- ✔️ تغيير قواعد التسعير
- ✔️ Soft Delete للبيانات

## 🔧 الإعداد المطلوب

### 1. تفعيل Branch Protection:
```
Repository → Settings → Branches → Add rule
Pattern: main
✅ Require pull request reviews
✅ Require status checks
✅ Require conversation resolution
```

### 2. تفعيل GitHub Actions:
```
Repository → Settings → Actions → General
✅ Allow all actions and reusable workflows
```

### 3. إضافة مراجعين (اختياري):
عدّل `CODEOWNERS` وأضف usernames المراجعين

## 📊 الفحوصات الآلية

عند كل Pull Request، سيتم تشغيل:

1. ✅ **فحص migrations**: كشف التعديلات على قاعدة البيانات
2. ✅ **فحص الحذف**: كشف عمليات delete()
3. ✅ **فحص الملفات الحساسة**: مراقبة التعديلات المهمة
4. ✅ **فحص credentials**: منع تسريب API keys

## 🤝 التواصل

عند الحاجة للموافقة على عملية حساسة:
1. اشرح العملية المطلوبة بوضوح
2. وضح التأثير والبدائل
3. انتظر الموافقة الصريحة

## 📚 مراجع إضافية

- [AI_MASTER_REFERENCE.md](../AI_MASTER_REFERENCE.md) - المرجع الشامل للمشروع
- [RIDER_FLOW_DOCUMENTATION.md](../RIDER_FLOW_DOCUMENTATION.md) - توثيق تدفق الراكب
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**تم إنشاء هذا النظام في**: 2026-01-10  
**الإصدار**: 1.0.0  
**المطور**: @engkhalidmaster

**والحمد لله رب العالمين** 🤲
