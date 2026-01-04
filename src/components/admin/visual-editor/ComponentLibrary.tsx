import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEditorStore, EditorComponent } from '@/stores/editorStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Type,
  LayoutPanelTop,
  Car,
  User,
  Map,
  Sparkles,
  Navigation,
  Menu,
  X,
} from 'lucide-react';

const categoryIcons: Record<string, React.ReactNode> = {
  input: <Type className="h-4 w-4" />,
  panel: <LayoutPanelTop className="h-4 w-4" />,
  selector: <Car className="h-4 w-4" />,
  card: <User className="h-4 w-4" />,
  map: <Map className="h-4 w-4" />,
  banner: <Sparkles className="h-4 w-4" />,
  navigation: <Navigation className="h-4 w-4" />,
};

interface ComponentLibraryProps {
  onClose?: () => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const { addComponent } = useEditorStore();

  const { data: templates, isLoading } = useQuery({
    queryKey: ['component-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('component_templates')
        .select('*')
        .eq('is_active', true)
        .order('category');

      if (error) throw error;
      return data;
    },
  });

  const filteredTemplates = React.useMemo(() => {
    if (!templates) return [];
    if (!searchQuery.trim()) return templates;

    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.name_ar.includes(searchQuery) ||
        t.category.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const groupedTemplates = React.useMemo(() => {
    const groups: Record<string, typeof filteredTemplates> = {};
    filteredTemplates.forEach((t) => {
      if (!groups[t.category]) {
        groups[t.category] = [];
      }
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTemplates]);

  const handleAddComponent = (template: (typeof templates)[0]) => {
    const newComponent: Omit<EditorComponent, 'id' | 'order'> = {
      type: template.component_type,
      name: template.name_ar,
      props: template.default_props as Record<string, any>,
      styles: template.default_styles as Record<string, any>,
      isVisible: true,
      isLocked: false,
    };
    addComponent(newComponent);
  };

  const categoryNames: Record<string, string> = {
    input: 'حقول الإدخال',
    panel: 'اللوحات',
    selector: 'المحددات',
    card: 'البطاقات',
    map: 'الخرائط',
    banner: 'البانرات',
    navigation: 'التنقل',
    general: 'عام',
  };

  return (
    <div className="w-64 bg-card border-l flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">مكتبة المكونات</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث عن مكون..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 h-9 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {Object.entries(groupedTemplates).map(([category, items]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase">
                  {categoryIcons[category] || <Menu className="h-4 w-4" />}
                  <span>{categoryNames[category] || category}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {items.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleAddComponent(template)}
                      className="p-3 bg-muted/50 rounded-lg border border-transparent hover:border-primary hover:bg-muted transition-all text-center group"
                    >
                      <div className="w-8 h-8 mx-auto mb-2 bg-background rounded-md flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                        {categoryIcons[template.category] || (
                          <Menu className="h-4 w-4" />
                        )}
                      </div>
                      <span className="text-xs font-medium line-clamp-1">
                        {template.name_ar}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                لا توجد مكونات مطابقة للبحث
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
