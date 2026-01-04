import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Undo2,
  Redo2,
  Save,
  Eye,
  EyeOff,
  Smartphone,
  Tablet,
  Monitor,
  Layers,
  LayoutGrid,
  Settings2,
  ArrowLeft,
} from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useNavigate } from 'react-router-dom';

interface EditorToolbarProps {
  onSave: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({ onSave }) => {
  const navigate = useNavigate();
  const {
    pageName,
    isPreviewMode,
    devicePreview,
    showComponentLibrary,
    showPropertiesPanel,
    showLayersPanel,
    hasUnsavedChanges,
    isSaving,
    historyIndex,
    history,
    setPreviewMode,
    setDevicePreview,
    toggleComponentLibrary,
    togglePropertiesPanel,
    toggleLayersPanel,
    undo,
    redo,
  } = useEditorStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="h-14 bg-card border-b flex items-center justify-between px-4 gap-4">
      {/* Left section */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/rider-pages')}
        >
          <ArrowLeft className="h-4 w-4 ml-2" />
          رجوع
        </Button>
        
        <Separator orientation="vertical" className="h-6" />
        
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{pageName}</span>
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-xs">
              غير محفوظ
            </Badge>
          )}
        </div>
      </div>

      {/* Center section - Device preview */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          variant={devicePreview === 'mobile' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setDevicePreview('mobile')}
          title="موبايل"
        >
          <Smartphone className="h-4 w-4" />
        </Button>
        <Button
          variant={devicePreview === 'tablet' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setDevicePreview('tablet')}
          title="تابلت"
        >
          <Tablet className="h-4 w-4" />
        </Button>
        <Button
          variant={devicePreview === 'desktop' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setDevicePreview('desktop')}
          title="سطح المكتب"
        >
          <Monitor className="h-4 w-4" />
        </Button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={undo}
            disabled={!canUndo}
            title="تراجع (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={redo}
            disabled={!canRedo}
            title="إعادة (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Panel toggles */}
        <div className="flex items-center gap-1">
          <Button
            variant={showComponentLibrary ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={toggleComponentLibrary}
            title="مكتبة المكونات"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={showLayersPanel ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={toggleLayersPanel}
            title="الطبقات"
          >
            <Layers className="h-4 w-4" />
          </Button>
          <Button
            variant={showPropertiesPanel ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={togglePropertiesPanel}
            title="الخصائص"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Preview toggle */}
        <Button
          variant={isPreviewMode ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setPreviewMode(!isPreviewMode)}
        >
          {isPreviewMode ? (
            <>
              <EyeOff className="h-4 w-4 ml-2" />
              إنهاء المعاينة
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 ml-2" />
              معاينة
            </>
          )}
        </Button>

        {/* Save button */}
        <Button
          onClick={onSave}
          disabled={isSaving || !hasUnsavedChanges}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'جارٍ الحفظ...' : 'حفظ'}
        </Button>
      </div>
    </div>
  );
};
