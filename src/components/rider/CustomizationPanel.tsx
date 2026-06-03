import React, { useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Layout, Hand, Save, RotateCcw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ThemeOption {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  preview: string;
}

interface LayoutOption {
  id: string;
  name: string;
  description: string;
  preview: React.ReactNode;
}

interface GestureOption {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

interface CustomizationSettings {
  theme: string;
  layout: string;
  gestures: Record<string, boolean>;
  animations: boolean;
  sound: boolean;
  haptic: boolean;
  language: string;
}

interface CustomizationContextType {
  settings: CustomizationSettings;
  updateSettings: (newSettings: Partial<CustomizationSettings>) => void;
  resetToDefaults: () => void;
}

const CustomizationContext = createContext<CustomizationContextType | undefined>(undefined);

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization must be used within CustomizationProvider');
  }
  return context;
};

const defaultSettings: CustomizationSettings = {
  theme: 'default',
  layout: 'classic',
  gestures: {
    swipe_book: true,
    double_tap_emergency: true,
    long_press_menu: true,
    pinch_zoom: true
  },
  animations: true,
  sound: true,
  haptic: true,
  language: 'ar'
};

interface CustomizationProviderProps {
  children: React.ReactNode;
}

export const CustomizationProvider: React.FC<CustomizationProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<CustomizationSettings>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('rider_customization');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  const updateSettings = (newSettings: Partial<CustomizationSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('rider_customization', JSON.stringify(updated));
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('rider_customization');
  };

  return (
    <CustomizationContext.Provider value={{ settings, updateSettings, resetToDefaults }}>
      {children}
    </CustomizationContext.Provider>
  );
};

interface CustomizationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomizationPanel: React.FC<CustomizationPanelProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetToDefaults } = useCustomization();
  const [activeTab, setActiveTab] = useState<'theme' | 'layout' | 'gestures' | 'preferences'>('theme');

  const themes: ThemeOption[] = [
    {
      id: 'default',
      name: 'افتراضي',
      colors: { primary: '#3b82f6', secondary: '#64748b', accent: '#f59e0b', background: '#ffffff' },
      preview: '🎨'
    },
    {
      id: 'dark',
      name: 'داكن',
      colors: { primary: '#1e40af', secondary: '#374151', accent: '#d97706', background: '#111827' },
      preview: '🌙'
    },
    {
      id: 'nature',
      name: 'طبيعي',
      colors: { primary: '#059669', secondary: '#065f46', accent: '#84cc16', background: '#f0fdf4' },
      preview: '🌿'
    },
    {
      id: 'sunset',
      name: 'غروب',
      colors: { primary: '#dc2626', secondary: '#7c2d12', accent: '#ea580c', background: '#fef2f2' },
      preview: '🌅'
    },
    {
      id: 'ocean',
      name: 'محيط',
      colors: { primary: '#0891b2', secondary: '#164e63', accent: '#06b6d4', background: '#ecfeff' },
      preview: '🌊'
    }
  ];

  const layouts: LayoutOption[] = [
    {
      id: 'classic',
      name: 'كلاسيكي',
      description: 'التخطيط التقليدي المريح',
      preview: <div className="w-full h-16 bg-gray-200 rounded flex items-center justify-center text-xs">📱</div>
    },
    {
      id: 'modern',
      name: 'حديث',
      description: 'تصميم عصري مع مساحات واسعة',
      preview: <div className="w-full h-16 bg-blue-100 rounded flex items-center justify-center text-xs">🚀</div>
    },
    {
      id: 'compact',
      name: 'مضغوط',
      description: 'توفير مساحة للهواتف الصغيرة',
      preview: <div className="w-full h-12 bg-green-100 rounded flex items-center justify-center text-xs">📏</div>
    },
    {
      id: 'split',
      name: 'منقسم',
      description: 'خريطة وأدوات في نفس الوقت',
      preview: <div className="w-full h-16 bg-purple-100 rounded flex items-center justify-center text-xs">🔄</div>
    }
  ];

  const gestureOptions: GestureOption[] = [
    {
      id: 'swipe_book',
      name: 'سحب للحجز',
      description: 'اسحب لأعلى للحجز السريع',
      enabled: settings.gestures.swipe_book
    },
    {
      id: 'double_tap_emergency',
      name: 'ضغطة مزدوجة للطوارئ',
      description: 'اضغط مرتين للاتصال بالطوارئ',
      enabled: settings.gestures.double_tap_emergency
    },
    {
      id: 'long_press_menu',
      name: 'ضغطة طويلة للقائمة',
      description: 'اضغط مطولاً لفتح القائمة',
      enabled: settings.gestures.long_press_menu
    },
    {
      id: 'pinch_zoom',
      name: 'قرص للتكبير',
      description: 'قرص لتكبير/تصغير الخريطة',
      enabled: settings.gestures.pinch_zoom
    }
  ];

  const tabs = [
    { id: 'theme' as const, label: 'السمات', icon: <Palette className="w-4 h-4" /> },
    { id: 'layout' as const, label: 'التخطيط', icon: <Layout className="w-4 h-4" /> },
    { id: 'gestures' as const, label: 'الإيماءات', icon: <Hand className="w-4 h-4" /> },
    { id: 'preferences' as const, label: 'التفضيلات', icon: <Settings className="w-4 h-4" /> }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">تخصيص التطبيق</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                ✕
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors rounded-none",
                    activeTab === tab.id
                      ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              <AnimatePresence mode="sync">
                {activeTab === 'theme' && (
                  <motion.div
                    key="theme"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="font-semibold text-gray-800">اختر السمة المفضلة</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {themes.map((theme) => (
                        <Button
                          key={theme.id}
                          variant="outline"
                          onClick={() => updateSettings({ theme: theme.id })}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all h-auto",
                            settings.theme === theme.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="text-2xl mb-2">{theme.preview}</div>
                          <div className="text-sm font-medium">{theme.name}</div>
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'layout' && (
                  <motion.div
                    key="layout"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="font-semibold text-gray-800">اختر تخطيط الشاشة</h3>
                    <div className="space-y-3">
                      {layouts.map((layout) => (
                        <Button
                          key={layout.id}
                          variant="outline"
                          onClick={() => updateSettings({ layout: layout.id })}
                          className={cn(
                            "w-full p-4 rounded-xl border-2 transition-all h-auto text-right",
                            settings.layout === layout.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {layout.preview}
                            <div>
                              <div className="font-medium">{layout.name}</div>
                              <div className="text-sm text-gray-500">{layout.description}</div>
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'gestures' && (
                  <motion.div
                    key="gestures"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="font-semibold text-gray-800">تخصيص الإيماءات</h3>
                    <div className="space-y-3">
                      {gestureOptions.map((gesture) => (
                        <div key={gesture.id} className="flex items-center justify-between">
                          <div className="text-right">
                            <div className="font-medium">{gesture.name}</div>
                            <div className="text-sm text-gray-500">{gesture.description}</div>
                          </div>
                          <Button
                            variant={gesture.enabled ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateSettings({
                              gestures: {
                                ...settings.gestures,
                                [gesture.id]: !gesture.enabled
                              }
                            })}
                          >
                            {gesture.enabled ? 'مفعل' : 'معطل'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === 'preferences' && (
                  <motion.div
                    key="preferences"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="font-semibold text-gray-800">التفضيلات العامة</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>الرسوم المتحركة</span>
                        <Button
                          variant={settings.animations ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSettings({ animations: !settings.animations })}
                        >
                          {settings.animations ? 'مفعلة' : 'معطلة'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>الأصوات</span>
                        <Button
                          variant={settings.sound ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSettings({ sound: !settings.sound })}
                        >
                          {settings.sound ? 'مفعلة' : 'معطلة'}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>الاهتزاز</span>
                        <Button
                          variant={settings.haptic ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateSettings({ haptic: !settings.haptic })}
                        >
                          {settings.haptic ? 'مفعل' : 'معطل'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t bg-gray-50">
              <Button variant="outline" onClick={resetToDefaults} className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                إعادة تعيين
              </Button>
              <Button onClick={onClose} className="flex items-center gap-2">
                <Save className="w-4 h-4" />
                حفظ
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CustomizationProvider;
