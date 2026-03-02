import React, { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Eye, Battery } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AmbientLightData {
  level: number; // 0-100
  isDark: boolean;
}

interface SmartDarkModeContextType {
  isDarkMode: boolean;
  ambientLight: AmbientLightData;
  batteryLevel: number;
  isPowerSaving: boolean;
  toggleDarkMode: () => void;
  setAmbientLight: (light: AmbientLightData) => void;
}

const SmartDarkModeContext = createContext<SmartDarkModeContextType | undefined>(undefined);

export const useSmartDarkMode = () => {
  const context = useContext(SmartDarkModeContext);
  if (!context) {
    throw new Error('useSmartDarkMode must be used within SmartDarkModeProvider');
  }
  return context;
};

interface SmartDarkModeProviderProps {
  children: React.ReactNode;
}

export const SmartDarkModeProvider: React.FC<SmartDarkModeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [ambientLight, setAmbientLight] = useState<AmbientLightData>({ level: 50, isDark: false });
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isPowerSaving, setIsPowerSaving] = useState(false);

  // Detect ambient light
  useEffect(() => {
    const detectAmbientLight = () => {
      if ('ambientLight' in navigator) {
        // @ts-expect-error - Ambient Light API
        navigator.ambientLight.addEventListener('reading', (event) => {
          // @ts-expect-error — Ambient Light reading event non-standard
          const isDark = illuminance < 10;
          setAmbientLight({ level: Math.min(illuminance, 100), isDark });
        });
      } else {
        // Fallback: use time-based detection
        const hour = new Date().getHours();
        const isNightTime = hour < 6 || hour > 18;
        setAmbientLight({ level: isNightTime ? 5 : 80, isDark: isNightTime });
      }
    };

    detectAmbientLight();
    const interval = setInterval(detectAmbientLight, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Detect battery level
  useEffect(() => {
    const detectBattery = async () => {
      if ('getBattery' in navigator) {
        try {
          // @ts-expect-error - Battery API
          const battery = await navigator.getBattery();
          setBatteryLevel(battery.level * 100);
          setIsPowerSaving(battery.level < 0.2); // Less than 20%

          battery.addEventListener('levelchange', () => {
            setBatteryLevel(battery.level * 100);
            setIsPowerSaving(battery.level < 0.2);
          });
        } catch (error) {
          console.log('Battery API not supported');
        }
      }
    };

    detectBattery();
  }, []);

  // Auto-switch dark mode based on ambient light and time
  useEffect(() => {
    const shouldBeDark = ambientLight.isDark || isPowerSaving;
    setIsDarkMode(shouldBeDark);
  }, [ambientLight.isDark, isPowerSaving]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const value: SmartDarkModeContextType = {
    isDarkMode,
    ambientLight,
    batteryLevel,
    isPowerSaving,
    toggleDarkMode,
    setAmbientLight
  };

  return (
    <SmartDarkModeContext.Provider value={value}>
      {children}
    </SmartDarkModeContext.Provider>
  );
};

interface SmartDarkModeIndicatorProps {
  className?: string;
}

export const SmartDarkModeIndicator: React.FC<SmartDarkModeIndicatorProps> = ({ className }) => {
  const { isDarkMode, ambientLight, batteryLevel, isPowerSaving, toggleDarkMode } = useSmartDarkMode();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn("fixed top-4 left-4 z-50", className)}
    >
      <div className="bg-black/20 backdrop-blur-lg rounded-full p-2 flex items-center gap-2">
        {/* Dark Mode Toggle */}
        <motion.div
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDarkMode}
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors p-0",
              isDarkMode ? "bg-yellow-400 text-gray-900 hover:bg-yellow-500" : "bg-gray-700 text-white hover:bg-gray-600"
            )}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </motion.div>

        {/* Ambient Light Indicator */}
        <div className="flex items-center gap-1 px-2">
          <Eye className="w-4 h-4 text-white/70" />
          <div className="w-8 h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white/70 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${ambientLight.level}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Battery Indicator */}
        <div className="flex items-center gap-1 px-2">
          <Battery className={cn(
            "w-4 h-4",
            batteryLevel > 50 ? "text-green-400" :
            batteryLevel > 20 ? "text-yellow-400" : "text-red-400"
          )} />
          <span className="text-xs text-white/70 font-medium">
            {Math.round(batteryLevel)}%
          </span>
        </div>

        {/* Power Saving Indicator */}
        <AnimatePresence>
          {isPowerSaving && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="w-2 h-2 bg-red-500 rounded-full animate-pulse"
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

interface SmartDarkModeOverlayProps {
  children: React.ReactNode;
}

export const SmartDarkModeOverlay: React.FC<SmartDarkModeOverlayProps> = ({ children }) => {
  const { isDarkMode, ambientLight, isPowerSaving } = useSmartDarkMode();

  return (
    <div className={cn(
      "transition-all duration-500",
      isDarkMode && "dark"
    )}>
      {/* Dark overlay for low light */}
      <AnimatePresence>
        {isDarkMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: ambientLight.level < 20 ? 0.3 : 0.1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      {/* Power saving overlay */}
      <AnimatePresence>
        {isPowerSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.2 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-blue-900/20 pointer-events-none z-0"
          />
        )}
      </AnimatePresence>

      {children}
    </div>
  );
};

export default SmartDarkModeProvider;