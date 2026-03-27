import React from 'react';
import { useEditorStore } from '@/stores/editorStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  X,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Palette,
  Box,
  Type,
  Layout,
} from 'lucide-react';

interface PropertiesPanelProps {
  onClose?: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ onClose }) => {
  const {
    components,
    selectedComponentId,
    updateComponent,
    updateComponentStyles,
    updateComponentProps,
    removeComponent,
    duplicateComponent,
  } = useEditorStore();

  const selectedComponent = React.useMemo(
    () => components.find((c) => c.id === selectedComponentId),
    [components, selectedComponentId]
  );

  if (!selectedComponent) {
    return (
      <div className="w-72 bg-card border-r flex flex-col h-full">
        <div className="p-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm">الخصائص</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
          اختر مكوناً من اللوحة لتعديل خصائصه
        </div>
      </div>
    );
  }

  const handleStyleChange = (key: string, value: string | number) => {
    updateComponentStyles(selectedComponent.id, { [key]: value });
  };

  const handlePropChange = (key: string, value: any) => {
    updateComponentProps(selectedComponent.id, { [key]: value });
  };

  return (
    <div className="w-72 bg-card border-r flex flex-col h-full">
      <div className="p-3 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">الخصائص</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Component header */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">اسم المكون</Label>
              <Input
                value={selectedComponent.name}
                onChange={(e) =>
                  updateComponent(selectedComponent.id, { name: e.target.value })
                }
                className="h-8 text-sm mt-1"
              />
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() =>
                  updateComponent(selectedComponent.id, {
                    isVisible: !selectedComponent.isVisible,
                  })
                }
              >
                {selectedComponent.isVisible ? (
                  <>
                    <Eye className="h-3 w-3 ml-1" />
                    ظاهر
                  </>
                ) : (
                  <>
                    <EyeOff className="h-3 w-3 ml-1" />
                    مخفي
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() =>
                  updateComponent(selectedComponent.id, {
                    isLocked: !selectedComponent.isLocked,
                  })
                }
              >
                {selectedComponent.isLocked ? (
                  <>
                    <Lock className="h-3 w-3 ml-1" />
                    مقفل
                  </>
                ) : (
                  <>
                    <Unlock className="h-3 w-3 ml-1" />
                    مفتوح
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => duplicateComponent(selectedComponent.id)}
              >
                <Copy className="h-3 w-3 ml-1" />
                نسخ
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => removeComponent(selectedComponent.id)}
              >
                <Trash2 className="h-3 w-3 ml-1" />
                حذف
              </Button>
            </div>
          </div>

          <Separator />

          {/* Properties accordion */}
          <Accordion type="multiple" defaultValue={['styles', 'layout']} className="space-y-2">
            {/* Styles section */}
            <AccordionItem value="styles" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span>الألوان والمظهر</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div>
                  <Label className="text-xs">لون الخلفية</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={selectedComponent.styles.backgroundColor?.replace(
                        /hsl\(var\(--([^)]+)\)\)/,
                        '#ffffff'
                      ) || '#ffffff'}
                      onChange={(e) =>
                        handleStyleChange('backgroundColor', e.target.value)
                      }
                      className="w-10 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={selectedComponent.styles.backgroundColor || ''}
                      onChange={(e) =>
                        handleStyleChange('backgroundColor', e.target.value)
                      }
                      className="h-8 text-xs flex-1"
                      placeholder="hsl(var(--background))"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">لون النص</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      value={selectedComponent.styles.color?.replace(
                        /hsl\(var\(--([^)]+)\)\)/,
                        '#000000'
                      ) || '#000000'}
                      onChange={(e) => handleStyleChange('color', e.target.value)}
                      className="w-10 h-8 rounded border cursor-pointer"
                    />
                    <Input
                      value={selectedComponent.styles.color || ''}
                      onChange={(e) => handleStyleChange('color', e.target.value)}
                      className="h-8 text-xs flex-1"
                      placeholder="hsl(var(--foreground))"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">الشفافية</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Slider
                      value={[
                        typeof selectedComponent.styles.opacity === 'number'
                          ? selectedComponent.styles.opacity * 100
                          : 100,
                      ]}
                      onValueChange={([value]) =>
                        handleStyleChange('opacity', value / 100)
                      }
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-xs w-10 text-left">
                      {Math.round(
                        (typeof selectedComponent.styles.opacity === 'number'
                          ? selectedComponent.styles.opacity
                          : 1) * 100
                      )}
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">الظل</Label>
                  <Input
                    value={selectedComponent.styles.boxShadow || ''}
                    onChange={(e) =>
                      handleStyleChange('boxShadow', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="0 4px 12px rgba(0,0,0,0.1)"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Layout section */}
            <AccordionItem value="layout" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  <span>التخطيط والأبعاد</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">العرض</Label>
                    <Input
                      value={selectedComponent.styles.width || ''}
                      onChange={(e) =>
                        handleStyleChange('width', e.target.value)
                      }
                      className="h-8 text-xs mt-1"
                      placeholder="auto"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">الارتفاع</Label>
                    <Input
                      value={selectedComponent.styles.height || ''}
                      onChange={(e) =>
                        handleStyleChange('height', e.target.value)
                      }
                      className="h-8 text-xs mt-1"
                      placeholder="auto"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">الحشوة (Padding)</Label>
                  <Input
                    value={selectedComponent.styles.padding || ''}
                    onChange={(e) =>
                      handleStyleChange('padding', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="16px"
                  />
                </div>

                <div>
                  <Label className="text-xs">الهامش (Margin)</Label>
                  <Input
                    value={selectedComponent.styles.margin || ''}
                    onChange={(e) =>
                      handleStyleChange('margin', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label className="text-xs">تدوير الزوايا</Label>
                  <Input
                    value={selectedComponent.styles.borderRadius || ''}
                    onChange={(e) =>
                      handleStyleChange('borderRadius', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="12px"
                  />
                </div>

                <div>
                  <Label className="text-xs">الإطار</Label>
                  <Input
                    value={selectedComponent.styles.border || ''}
                    onChange={(e) =>
                      handleStyleChange('border', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="1px solid hsl(var(--border))"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Typography section */}
            <AccordionItem value="typography" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  <span>الخط والنص</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                <div>
                  <Label className="text-xs">حجم الخط</Label>
                  <Input
                    value={selectedComponent.styles.fontSize || ''}
                    onChange={(e) =>
                      handleStyleChange('fontSize', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="16px"
                  />
                </div>

                <div>
                  <Label className="text-xs">وزن الخط</Label>
                  <Input
                    value={selectedComponent.styles.fontWeight || ''}
                    onChange={(e) =>
                      handleStyleChange('fontWeight', e.target.value)
                    }
                    className="h-8 text-xs mt-1"
                    placeholder="400"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Component-specific props */}
            <AccordionItem value="props" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  <span>خصائص المكون</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 space-y-3">
                {Object.entries(selectedComponent.props || {}).map(
                  ([key, value]) => (
                    <div key={key}>
                      <Label className="text-xs">{key}</Label>
                      {typeof value === 'boolean' ? (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {value ? 'مفعل' : 'معطل'}
                          </span>
                          <Switch
                            checked={value}
                            onCheckedChange={(checked) =>
                              handlePropChange(key, checked)
                            }
                          />
                        </div>
                      ) : (
                        <Input
                          value={String(value)}
                          onChange={(e) => handlePropChange(key, e.target.value)}
                          className="h-8 text-xs mt-1"
                        />
                      )}
                    </div>
                  )
                )}
                {Object.keys(selectedComponent.props || {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    لا توجد خصائص إضافية لهذا المكون
                  </p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  );
};
