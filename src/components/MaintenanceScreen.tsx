/**
 * شاشة وضع الصيانة
 * تظهر عندما يكون التطبيق في وضع الصيانة
 */

import React from "react";
import { Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MaintenanceScreen: React.FC = () => {
  return (
    <div className="flex flex-col h-[100dvh] items-center justify-center bg-background p-6 text-center" dir="rtl">
      <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mb-6">
        <Wrench className="w-10 h-10 text-amber-500" />
      </div>
      
      <h1 className="text-2xl font-bold mb-3">التطبيق تحت الصيانة</h1>
      
      <p className="text-muted-foreground max-w-sm mb-2">
        نعمل على تحسين الخدمة. سيعود التطبيق للعمل قريباً إن شاء الله.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        نعتذر عن أي إزعاج
      </p>

      <Button
        variant="outline"
        onClick={() => window.location.reload()}
        className="gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        إعادة المحاولة
      </Button>
    </div>
  );
};

export default MaintenanceScreen;
