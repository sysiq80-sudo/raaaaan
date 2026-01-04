import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const themes = [
    { value: 'light' as const, label: 'فاتح', icon: Sun },
    { value: 'dark' as const, label: 'داكن', icon: Moon },
    { value: 'system' as const, label: 'تلقائي', icon: Monitor },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {resolvedTheme === 'dark' ? (
            <Moon className="w-5 h-5 text-primary" />
          ) : (
            <Sun className="w-5 h-5 text-primary" />
          )}
          المظهر
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.value;
            
            return (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : 'bg-secondary/50 hover:bg-secondary text-foreground'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-sm font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          {theme === 'system' 
            ? `الوضع الحالي: ${resolvedTheme === 'dark' ? 'داكن' : 'فاتح'} (حسب إعدادات الجهاز)`
            : `الوضع ${theme === 'dark' ? 'الداكن' : 'الفاتح'} مفعّل`
          }
        </p>
      </CardContent>
    </Card>
  );
};

export default ThemeToggle;
