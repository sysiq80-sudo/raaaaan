-- تعيين صفحة rider11 كصفحة افتراضية
UPDATE rider_page_layouts SET is_default = false WHERE is_default = true;
UPDATE rider_page_layouts SET is_default = true WHERE route_path = '/rider11';