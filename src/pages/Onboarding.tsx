/**
 * ران - صفحة الترحيب الرئيسية
 * تعرض شاشات التعليم للمستخدم الجديد
 */

import OnboardingFlow from "@/components/rider/OnboardingFlow";
import { useAuth } from "@/contexts/AuthContext";
import { capacitorStorageSync } from "@/lib/capacitorStorage";

const Onboarding = () => {
  const { setIsOnboardingComplete } = useAuth();

  const handleOnboardingComplete = () => {
    console.log("[Onboarding] Marking onboarding as complete");
    capacitorStorageSync.setItem("raan_onboarding_completed", "true");
    // ✅ فقط تحديث الحالة - AppRoutes سيتولى التوجيه
    setIsOnboardingComplete(true);
  };

  return (
    <OnboardingFlow onComplete={handleOnboardingComplete} />
  );
};

export default Onboarding;
