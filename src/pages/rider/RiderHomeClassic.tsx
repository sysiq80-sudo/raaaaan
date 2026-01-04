/**
 * صفحة الراكب الكلاسيكية
 * تستخدم شاشة الترحيب التقليدية مع تصميم مختلف
 * متاحة عبر الرابط /rider2
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import WelcomeLocationScreen from "@/components/rider/WelcomeLocationScreen";
import RiderBottomNav from "@/components/rider/RiderBottomNav";
import RiderSideMenu from "@/components/rider/RiderSideMenu";
import { Loader2 } from "lucide-react";

const RiderHomeClassic = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSideMenu, setShowSideMenu] = useState(false);

  // Check auth and fetch profile
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .single();
        
        setProfile(profileData);
      }
      setIsLoading(false);
    };
    
    checkAuth();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/rider/auth');
      } else if (session?.user) {
        setUser(session.user);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Handle destination selection - redirect to main rider page with destination
  const handlePlaceSelect = useCallback((place: { lat: number; lng: number; address: string }) => {
    // Store selected destination and redirect to main booking flow
    sessionStorage.setItem('selectedDestination', JSON.stringify(place));
    navigate('/rider');
  }, [navigate]);

  // Handle search click
  const handleSearchClick = useCallback(() => {
    navigate('/rider');
  }, [navigate]);

  // Handle map picker click
  const handleMapPickerClick = useCallback(() => {
    sessionStorage.setItem('openMapPicker', 'true');
    navigate('/rider');
  }, [navigate]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/');
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Welcome Screen */}
      <WelcomeLocationScreen
        userId={user?.id || null}
        onSearchClick={handleSearchClick}
        onMapPickerClick={handleMapPickerClick}
        onPlaceSelect={handlePlaceSelect}
      />

      {/* Side Menu */}
      <RiderSideMenu
        user={user}
        isOpen={showSideMenu}
        onClose={() => setShowSideMenu(false)}
        onLogout={handleLogout}
      />

      {/* Bottom Navigation */}
      <RiderBottomNav />
    </div>
  );
};

export default RiderHomeClassic;
