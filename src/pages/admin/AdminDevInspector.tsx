import AdminLayout from "@/components/admin/AdminLayout";
import DevInspectorSettingsManager from "@/components/settings/DevInspectorSettingsManager";

const AdminDevInspector = () => {
  return (
    <AdminLayout
      title="خريطة المكونات"
      subtitle="استيراد نظام خريطة المكونات المرئية بأحدث نسخة من W PRO"
    >
      <div className="max-w-3xl" dir="rtl">
        <DevInspectorSettingsManager />
      </div>
    </AdminLayout>
  );
};

export default AdminDevInspector;
