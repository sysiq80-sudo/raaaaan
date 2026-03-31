import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Gift, Menu, X, Bell } from "lucide-react";
import logo from "@/assets/logo.png";
import DriverSideMenu from "@/components/driver/DriverSideMenu";
import { RewardsSidePanel } from "@/components/driver/RewardsSidePanel";
import { NotificationsBell } from "@/components/driver/NotificationsBell";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface DriverPageHeaderProps {
  title: string;
  backTo?: string; // مسار الرجوع — افتراضي /driver
}

const DriverPageHeader = ({ title, backTo = "/driver" }: DriverPageHeaderProps) => {
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // بيانات السائق المطلوبة للقائمة الجانبية
  const [driverData, setDriverData] = useState({
    id: null as string | null,
    name: null as string | null,
    phone: null as string | null,
    profileImage: null as string | null,
    status: null as string | null,
    vehicleType: null as string | null,
    rating: 5.0,
    isProfileComplete: false,
    isAdminActivated: true,
    driverStatus: null as string | null,
  });
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);

      const { data: driver } = await supabase
        .from("drivers")
        .select("id, full_name, phone, profile_image_url, status, vehicle_type, rating, vehicle_image_url, license_image_url, vehicle_model, vehicle_plate, admin_activated")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (driver) {
        setDriverData({
          id: driver.id,
          name: driver.full_name,
          phone: driver.phone,
          profileImage: driver.profile_image_url,
          status: driver.status,
          vehicleType: driver.vehicle_type,
          rating: driver.rating || 5.0,
          isProfileComplete: !!(driver.vehicle_image_url && driver.license_image_url && driver.profile_image_url && driver.vehicle_model && driver.vehicle_plate),
          isAdminActivated: driver.admin_activated !== false,
          driverStatus: driver.status,
        });
      }
    };
    fetchData();
  }, []);

  const handleLogout = async () => {
    if (driverData.id) {
      await supabase.from("drivers").update({ is_online: false, is_available: false }).eq("id", driverData.id);
    }
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const hasAlerts = !driverData.isProfileComplete || !driverData.isAdminActivated || driverData.driverStatus === "pending";

  return (
    <>
      {/* ── الشريط العلوي ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/60 pt-[env(safe-area-inset-top)]"
      >
        <div className="flex items-center justify-between h-14 px-4">

          {/* يسار: إشعارات + مكافآت */}
          <div className="flex items-center gap-2.5">
            <NotificationsBell
              driverId={driverData.id}
              isOpen={notificationsOpen}
              onToggle={() => { setNotificationsOpen(!notificationsOpen); setRewardsOpen(false); setMenuOpen(false); }}
            />
            <button
              onClick={() => { setRewardsOpen(!rewardsOpen); setNotificationsOpen(false); setMenuOpen(false); }}
              className="driver-geometric-outline relative p-2.5 active:scale-95 transition-transform"
              aria-label="المكافآت"
            >
              <Gift className="w-5 h-5 text-amber-400" />
              {hasAlerts && (
                <span className="absolute -top-1 -left-1 w-[18px] h-[18px] min-w-[18px] bg-amber-500 text-black font-bold rounded-full text-[10px] flex items-center justify-center border-2 border-black">!</span>
              )}
            </button>
          </div>

          {/* وسط: عنوان + شعار */}
          <div className="flex items-center gap-2">
            <img src={logo} alt="RAAN" className="w-6 h-6 rounded-md" />
            <span className="font-bold text-foreground text-sm">{title}</span>
          </div>

          {/* يمين: زر الرجوع + زر القائمة */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(backTo)}
              className="driver-geometric-outline p-1.5 hover:bg-accent/20 active:scale-90 transition-all"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => { setMenuOpen(!menuOpen); setNotificationsOpen(false); setRewardsOpen(false); }}
              className="driver-geometric-outline p-2.5 active:scale-95 transition-transform"
              aria-label="القائمة"
            >
              {menuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>
          </div>
        </div>
      </header>

      {/* ── القائمة الجانبية ── */}
      {menuOpen && (
        <DriverSideMenu
          user={user}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          onLogout={handleLogout}
          driverName={driverData.name}
          driverPhone={driverData.phone}
          driverProfileImage={driverData.profileImage}
          driverStatus={driverData.status}
          vehicleType={driverData.vehicleType}
          rating={driverData.rating}
          driverId={driverData.id}
        />
      )}

      {/* ── لوحة المكافآت ── */}
      <RewardsSidePanel
        isOpen={rewardsOpen}
        onClose={() => setRewardsOpen(false)}
        driverId={driverData.id}
      />
    </>
  );
};

export default DriverPageHeader;
