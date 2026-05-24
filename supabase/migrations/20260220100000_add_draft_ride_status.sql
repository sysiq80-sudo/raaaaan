-- إضافة حالة draft لنوع ride_status
-- الرحلات من تيليغرام تبدأ بحالة draft حتى يؤكدها الراكب
-- السائقون يرون فقط الرحلات بحالة pending
ALTER TYPE ride_status ADD VALUE IF NOT EXISTS 'draft' BEFORE 'pending';
