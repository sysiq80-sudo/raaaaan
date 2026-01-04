import React from 'react';
import { useEditorStore, EditorComponent } from '@/stores/editorStore';
import { cn } from '@/lib/utils';
import { motion, Reorder } from 'framer-motion';
import { 
  Search, 
  CreditCard, 
  Car, 
  User, 
  Map, 
  Sparkles, 
  Navigation,
  Menu,
  GripVertical,
} from 'lucide-react';

// Component preview renderers
const componentPreviews: Record<string, React.FC<{ component: EditorComponent }>> = {
  search_bar: ({ component }) => (
    <div
      className="flex items-center gap-3 bg-muted/50 rounded-xl p-4"
      style={component.styles as React.CSSProperties}
    >
      <Search className="h-5 w-5 text-muted-foreground" />
      <span className="text-muted-foreground text-sm">
        {component.props.placeholder || 'إلى أين تريد الذهاب؟'}
      </span>
    </div>
  ),
  
  booking_panel: ({ component }) => (
    <div
      className="bg-card rounded-2xl p-4 shadow-lg space-y-3"
      style={component.styles as React.CSSProperties}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <CreditCard className="h-4 w-4" />
        <span>لوحة الحجز</span>
      </div>
      <div className="h-10 bg-muted rounded-lg" />
      <div className="h-10 bg-muted rounded-lg" />
      <div className="h-10 bg-primary/20 rounded-lg" />
    </div>
  ),
  
  vehicle_selector: ({ component }) => (
    <div
      className="flex gap-3 overflow-x-auto py-2"
      style={component.styles as React.CSSProperties}
    >
      {['اقتصادي', 'مريح', 'فاخر'].map((type, i) => (
        <div
          key={type}
          className={cn(
            'flex-shrink-0 p-3 rounded-xl border-2 text-center min-w-[100px]',
            i === 0 ? 'border-primary bg-primary/10' : 'border-border bg-muted/50'
          )}
        >
          <Car className="h-6 w-6 mx-auto mb-1" />
          <span className="text-xs font-medium">{type}</span>
        </div>
      ))}
    </div>
  ),
  
  driver_card: ({ component }) => (
    <div
      className="bg-card rounded-xl p-4 flex items-center gap-3 shadow-sm"
      style={component.styles as React.CSSProperties}
    >
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
        <User className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <div className="h-4 bg-muted rounded w-24 mb-2" />
        <div className="h-3 bg-muted/60 rounded w-16" />
      </div>
      <div className="text-right">
        <div className="text-sm font-bold">⭐ 4.9</div>
        <div className="text-xs text-muted-foreground">150 رحلة</div>
      </div>
    </div>
  ),
  
  map_view: ({ component }) => (
    <div
      className="bg-muted rounded-xl flex items-center justify-center relative overflow-hidden"
      style={{ height: '200px', ...component.styles as React.CSSProperties }}
    >
      <Map className="h-12 w-12 text-muted-foreground/50" />
      <div className="absolute bottom-2 right-2 bg-background/80 rounded-lg px-2 py-1 text-xs">
        معاينة الخريطة
      </div>
    </div>
  ),
  
  promo_banner: ({ component }) => (
    <div
      className="bg-gradient-to-l from-primary/80 to-primary rounded-xl p-4 text-primary-foreground"
      style={component.styles as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        <Sparkles className="h-8 w-8" />
        <div>
          <div className="font-bold">عرض خاص!</div>
          <div className="text-sm opacity-90">خصم 20% على أول رحلة</div>
        </div>
      </div>
    </div>
  ),
  
  quick_places: ({ component }) => (
    <div
      className="flex gap-2 overflow-x-auto py-2"
      style={component.styles as React.CSSProperties}
    >
      {['🏠 المنزل', '🏢 العمل', '🛒 السوق', '🏥 المستشفى'].map((place) => (
        <div
          key={place}
          className="flex-shrink-0 px-3 py-2 bg-muted rounded-full text-xs font-medium"
        >
          {place}
        </div>
      ))}
    </div>
  ),
  
  bottom_nav: ({ component }) => (
    <div
      className="bg-card rounded-t-xl p-3 flex items-center justify-around border-t"
      style={component.styles as React.CSSProperties}
    >
      {[
        { icon: <Navigation className="h-5 w-5" />, label: 'الرئيسية' },
        { icon: <Car className="h-5 w-5" />, label: 'رحلاتي' },
        { icon: <CreditCard className="h-5 w-5" />, label: 'المدفوعات' },
        { icon: <Menu className="h-5 w-5" />, label: 'المزيد' },
      ].map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'flex flex-col items-center gap-1',
            i === 0 ? 'text-primary' : 'text-muted-foreground'
          )}
        >
          {item.icon}
          <span className="text-[10px]">{item.label}</span>
        </div>
      ))}
    </div>
  ),
};

const DefaultPreview: React.FC<{ component: EditorComponent }> = ({ component }) => (
  <div
    className="bg-muted/30 rounded-lg p-4 border-2 border-dashed border-muted-foreground/20 text-center"
    style={component.styles as React.CSSProperties}
  >
    <span className="text-sm text-muted-foreground">{component.name}</span>
  </div>
);

interface EditorCanvasProps {
  className?: string;
}

// Device configurations with realistic dimensions
const deviceConfigs = {
  mobile: {
    width: 375,
    height: 667,
    name: 'iPhone SE',
    notchHeight: 44,
    bottomBar: 34,
  },
  tablet: {
    width: 768,
    height: 1024,
    name: 'iPad',
    notchHeight: 24,
    bottomBar: 20,
  },
  desktop: {
    width: 1280,
    height: 800,
    name: 'Desktop',
    notchHeight: 0,
    bottomBar: 0,
  },
};

export const EditorCanvas: React.FC<EditorCanvasProps> = ({ className }) => {
  const {
    components,
    selectedComponentId,
    hoveredComponentId,
    isPreviewMode,
    devicePreview,
    selectComponent,
    setHoveredComponent,
    reorderComponents,
  } = useEditorStore();

  const config = deviceConfigs[devicePreview];
  const sortedComponents = [...components].sort((a, b) => a.order - b.order);

  const handleReorder = (newOrder: EditorComponent[]) => {
    const fromComponent = components.find(
      (c) => !newOrder.find((nc) => nc.id === c.id && nc.order === c.order)
    );
    if (fromComponent) {
      const fromIndex = components.findIndex((c) => c.id === fromComponent.id);
      const toIndex = newOrder.findIndex((c) => c.id === fromComponent.id);
      if (fromIndex !== toIndex) {
        reorderComponents(fromIndex, toIndex);
      }
    }
  };

  const scale = devicePreview === 'desktop' ? 0.7 : 1;

  return (
    <div
      className={cn(
        'flex-1 bg-muted/30 overflow-auto flex flex-col items-center justify-start p-6 gap-3',
        className
      )}
    >
      {/* Device label */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium">{config.name}</span>
        <span className="text-xs bg-muted px-2 py-0.5 rounded">
          {config.width} × {config.height}
        </span>
      </div>

      {/* Device frame container */}
      <div
        className="relative transition-all duration-300"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {/* Device frame */}
        <div
          className={cn(
            'relative bg-background transition-all duration-300',
            devicePreview === 'mobile' && 'rounded-[40px] border-[12px] border-foreground/90 shadow-xl',
            devicePreview === 'tablet' && 'rounded-[24px] border-[14px] border-foreground/80 shadow-xl',
            devicePreview === 'desktop' && 'rounded-lg border border-border shadow-lg'
          )}
          style={{
            width: config.width,
            height: config.height,
          }}
        >
          {/* Mobile notch */}
          {devicePreview === 'mobile' && (
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-foreground/90 rounded-b-2xl z-10" />
          )}

          {/* Desktop browser bar */}
          {devicePreview === 'desktop' && (
            <div className="h-8 bg-muted border-b flex items-center px-3 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-background rounded-md px-3 py-1 text-xs text-muted-foreground max-w-md">
                  app.example.com/rider
                </div>
              </div>
            </div>
          )}

          {/* Tablet camera */}
          {devicePreview === 'tablet' && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground/30 rounded-full z-10" />
          )}

          {/* Canvas content */}
          <div
            className={cn(
              'overflow-y-auto',
              devicePreview === 'mobile' && 'pt-8 pb-8',
              devicePreview === 'tablet' && 'pt-6 pb-4',
              devicePreview === 'desktop' && ''
            )}
            style={{
              height: devicePreview === 'desktop' 
                ? config.height - 32 
                : config.height - config.notchHeight - config.bottomBar,
            }}
          >
            <div className="p-4 space-y-3">
              {sortedComponents.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center py-20">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <Menu className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p>اسحب المكونات من المكتبة هنا</p>
                    <p className="text-xs mt-1">أو اضغط على مكون لإضافته</p>
                  </div>
                </div>
              ) : isPreviewMode ? (
                // Preview mode - no interactions
                sortedComponents.map((component) => {
                  if (!component.isVisible) return null;
                  const PreviewComponent =
                    componentPreviews[component.type] || DefaultPreview;
                  return (
                    <div key={component.id}>
                      <PreviewComponent component={component} />
                    </div>
                  );
                })
              ) : (
                // Edit mode - with selection and reordering
                <Reorder.Group
                  axis="y"
                  values={sortedComponents}
                  onReorder={handleReorder}
                  className="space-y-3"
                >
                  {sortedComponents.map((component) => {
                    if (!component.isVisible) return null;
                    const PreviewComponent =
                      componentPreviews[component.type] || DefaultPreview;
                    const isSelected = selectedComponentId === component.id;
                    const isHovered = hoveredComponentId === component.id;

                    return (
                      <Reorder.Item
                        key={component.id}
                        value={component}
                        className={cn(
                          'relative rounded-lg transition-all cursor-pointer',
                          isSelected && 'ring-2 ring-primary ring-offset-2',
                          isHovered && !isSelected && 'ring-1 ring-primary/50',
                          component.isLocked && 'opacity-70 cursor-not-allowed'
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectComponent(component.id);
                        }}
                        onMouseEnter={() => setHoveredComponent(component.id)}
                        onMouseLeave={() => setHoveredComponent(null)}
                        drag={!component.isLocked}
                        whileDrag={{ scale: 1.02, opacity: 0.8 }}
                      >
                        {/* Drag handle */}
                        {!component.isLocked && (isSelected || isHovered) && (
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 bg-primary text-primary-foreground rounded p-1 cursor-grab active:cursor-grabbing z-10">
                            <GripVertical className="h-3 w-3" />
                          </div>
                        )}

                        {/* Component label */}
                        {isSelected && (
                          <div className="absolute -top-6 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded">
                            {component.name}
                          </div>
                        )}

                        <PreviewComponent component={component} />
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              )}
            </div>
          </div>

          {/* Mobile home indicator */}
          {devicePreview === 'mobile' && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-28 h-1 bg-foreground/30 rounded-full" />
          )}

          {/* Tablet home button */}
          {devicePreview === 'tablet' && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 border-2 border-foreground/20 rounded-full" />
          )}
        </div>
      </div>
    </div>
  );
};
