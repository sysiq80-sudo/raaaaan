import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEditorStore, EditorComponent } from '@/stores/editorStore';
import { EditorToolbar } from '@/components/admin/visual-editor/EditorToolbar';
import { EditorCanvas } from '@/components/admin/visual-editor/EditorCanvas';
import { ComponentLibrary } from '@/components/admin/visual-editor/ComponentLibrary';
import { PropertiesPanel } from '@/components/admin/visual-editor/PropertiesPanel';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const AdminPageEditor: React.FC = () => {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    initEditor,
    resetEditor,
    showComponentLibrary,
    showPropertiesPanel,
    getPageConfig,
    setSaving,
    markAsSaved,
    selectComponent,
  } = useEditorStore();

  // Fetch page data
  const { data: page, isLoading } = useQuery({
    queryKey: ['rider-page-layout', pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const { data, error } = await supabase
        .from('rider_page_layouts')
        .select('*')
        .eq('id', pageId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!pageId,
  });

  // Initialize editor when page data is loaded
  useEffect(() => {
    if (page) {
      const settings = page.settings as { components?: EditorComponent[] } | null;
      const components = settings?.components || [];
      initEditor(page.id, page.display_name, components);
    }

    return () => {
      resetEditor();
    };
  }, [page, initEditor, resetEditor]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!pageId) return;
      
      const config = getPageConfig();
      
      const { error } = await supabase
        .from('rider_page_layouts')
        .update({
          settings: config as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pageId);

      if (error) throw error;
    },
    onMutate: () => {
      setSaving(true);
    },
    onSuccess: () => {
      markAsSaved();
      toast.success('تم حفظ التغييرات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['rider-page-layout', pageId] });
    },
    onError: (error: Error) => {
      toast.error('فشل في حفظ التغييرات: ' + error.message);
    },
    onSettled: () => {
      setSaving(false);
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveMutation.mutate();
      }
      
      // Ctrl/Cmd + Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
      }
      
      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z to redo
      if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
      
      // Escape to deselect
      if (e.key === 'Escape') {
        selectComponent(null);
      }
      
      // Delete to remove selected component
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selectedComponentId, removeComponent } = useEditorStore.getState();
        if (selectedComponentId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
          e.preventDefault();
          removeComponent(selectedComponentId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveMutation, selectComponent]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">جارٍ تحميل المحرر...</p>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-medium">الصفحة غير موجودة</p>
          <button
            onClick={() => navigate('/admin/rider-pages')}
            className="mt-2 text-primary hover:underline"
          >
            العودة لإدارة الصفحات
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* Toolbar */}
      <EditorToolbar onSave={() => saveMutation.mutate()} />

      {/* Main editor area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar - Component Library */}
        {showComponentLibrary && (
          <ComponentLibrary 
            onClose={() => useEditorStore.getState().toggleComponentLibrary()} 
          />
        )}

        {/* Canvas */}
        <EditorCanvas />

        {/* Right sidebar - Properties Panel */}
        {showPropertiesPanel && (
          <PropertiesPanel 
            onClose={() => useEditorStore.getState().togglePropertiesPanel()} 
          />
        )}
      </div>
    </div>
  );
};

export default AdminPageEditor;
