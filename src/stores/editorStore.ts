import { create } from 'zustand';

// Types for the visual editor
export interface ComponentStyles {
  backgroundColor?: string;
  color?: string;
  borderRadius?: string;
  padding?: string;
  margin?: string;
  fontSize?: string;
  fontWeight?: string;
  width?: string;
  height?: string;
  opacity?: number;
  boxShadow?: string;
  border?: string;
  gap?: string;
  [key: string]: string | number | undefined;
}

export interface ComponentProps {
  [key: string]: any;
}

export interface EditorComponent {
  id: string;
  type: string;
  name: string;
  props: ComponentProps;
  styles: ComponentStyles;
  children?: EditorComponent[];
  isVisible: boolean;
  isLocked: boolean;
  order: number;
}

export interface HistoryEntry {
  components: EditorComponent[];
  timestamp: number;
  action: string;
}

export interface EditorState {
  // Page being edited
  pageId: string | null;
  pageName: string;
  
  // Components on the canvas
  components: EditorComponent[];
  
  // Selection
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  
  // Editor mode
  isEditing: boolean;
  isPreviewMode: boolean;
  devicePreview: 'mobile' | 'tablet' | 'desktop';
  
  // History for undo/redo
  history: HistoryEntry[];
  historyIndex: number;
  
  // Panels visibility
  showComponentLibrary: boolean;
  showPropertiesPanel: boolean;
  showLayersPanel: boolean;
  
  // Drag state
  isDragging: boolean;
  draggedComponentId: string | null;
  
  // Loading/saving state
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
}

interface EditorActions {
  // Initialize
  initEditor: (pageId: string, pageName: string, components: EditorComponent[]) => void;
  resetEditor: () => void;
  
  // Component management
  addComponent: (component: Omit<EditorComponent, 'id' | 'order'>) => void;
  updateComponent: (id: string, updates: Partial<EditorComponent>) => void;
  updateComponentStyles: (id: string, styles: Partial<ComponentStyles>) => void;
  updateComponentProps: (id: string, props: Partial<ComponentProps>) => void;
  removeComponent: (id: string) => void;
  duplicateComponent: (id: string) => void;
  reorderComponents: (fromIndex: number, toIndex: number) => void;
  
  // Selection
  selectComponent: (id: string | null) => void;
  setHoveredComponent: (id: string | null) => void;
  
  // Editor mode
  setEditMode: (editing: boolean) => void;
  setPreviewMode: (preview: boolean) => void;
  setDevicePreview: (device: 'mobile' | 'tablet' | 'desktop') => void;
  
  // Panels
  toggleComponentLibrary: () => void;
  togglePropertiesPanel: () => void;
  toggleLayersPanel: () => void;
  
  // Drag and drop
  setDragging: (isDragging: boolean, componentId?: string | null) => void;
  
  // History
  undo: () => void;
  redo: () => void;
  saveToHistory: (action: string) => void;
  
  // Saving
  setSaving: (saving: boolean) => void;
  markAsSaved: () => void;
  markAsUnsaved: () => void;
  
  // Get current state for saving
  getPageConfig: () => { components: EditorComponent[] };
}

const initialState: EditorState = {
  pageId: null,
  pageName: '',
  components: [],
  selectedComponentId: null,
  hoveredComponentId: null,
  isEditing: false,
  isPreviewMode: false,
  devicePreview: 'mobile',
  history: [],
  historyIndex: -1,
  showComponentLibrary: true,
  showPropertiesPanel: true,
  showLayersPanel: false,
  isDragging: false,
  draggedComponentId: null,
  isSaving: false,
  hasUnsavedChanges: false,
  lastSavedAt: null,
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  ...initialState,

  initEditor: (pageId, pageName, components) => {
    set({
      pageId,
      pageName,
      components,
      isEditing: true,
      history: [{
        components: JSON.parse(JSON.stringify(components)),
        timestamp: Date.now(),
        action: 'init'
      }],
      historyIndex: 0,
      hasUnsavedChanges: false,
    });
  },

  resetEditor: () => set(initialState),

  addComponent: (component) => {
    const id = crypto.randomUUID();
    const order = get().components.length;
    const newComponent: EditorComponent = {
      ...component,
      id,
      order,
    };
    
    set((state) => ({
      components: [...state.components, newComponent],
      selectedComponentId: id,
      hasUnsavedChanges: true,
    }));
    
    get().saveToHistory(`Added ${component.name}`);
  },

  updateComponent: (id, updates) => {
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
      hasUnsavedChanges: true,
    }));
  },

  updateComponentStyles: (id, styles) => {
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, styles: { ...c.styles, ...styles } } : c
      ),
      hasUnsavedChanges: true,
    }));
  },

  updateComponentProps: (id, props) => {
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, props: { ...c.props, ...props } } : c
      ),
      hasUnsavedChanges: true,
    }));
  },

  removeComponent: (id) => {
    const component = get().components.find((c) => c.id === id);
    set((state) => ({
      components: state.components.filter((c) => c.id !== id),
      selectedComponentId: state.selectedComponentId === id ? null : state.selectedComponentId,
      hasUnsavedChanges: true,
    }));
    if (component) {
      get().saveToHistory(`Removed ${component.name}`);
    }
  },

  duplicateComponent: (id) => {
    const component = get().components.find((c) => c.id === id);
    if (component) {
      const newId = crypto.randomUUID();
      const newComponent: EditorComponent = {
        ...JSON.parse(JSON.stringify(component)),
        id: newId,
        name: `${component.name} (نسخة)`,
        order: get().components.length,
      };
      
      set((state) => ({
        components: [...state.components, newComponent],
        selectedComponentId: newId,
        hasUnsavedChanges: true,
      }));
      
      get().saveToHistory(`Duplicated ${component.name}`);
    }
  },

  reorderComponents: (fromIndex, toIndex) => {
    set((state) => {
      const newComponents = [...state.components];
      const [moved] = newComponents.splice(fromIndex, 1);
      newComponents.splice(toIndex, 0, moved);
      
      return {
        components: newComponents.map((c, i) => ({ ...c, order: i })),
        hasUnsavedChanges: true,
      };
    });
    
    get().saveToHistory('Reordered components');
  },

  selectComponent: (id) => set({ selectedComponentId: id }),
  
  setHoveredComponent: (id) => set({ hoveredComponentId: id }),

  setEditMode: (editing) => set({ isEditing: editing }),
  
  setPreviewMode: (preview) => set({ 
    isPreviewMode: preview,
    selectedComponentId: preview ? null : get().selectedComponentId,
  }),
  
  setDevicePreview: (device) => set({ devicePreview: device }),

  toggleComponentLibrary: () => set((state) => ({ 
    showComponentLibrary: !state.showComponentLibrary 
  })),
  
  togglePropertiesPanel: () => set((state) => ({ 
    showPropertiesPanel: !state.showPropertiesPanel 
  })),
  
  toggleLayersPanel: () => set((state) => ({ 
    showLayersPanel: !state.showLayersPanel 
  })),

  setDragging: (isDragging, componentId = null) => set({ 
    isDragging, 
    draggedComponentId: componentId 
  }),

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      set({
        components: JSON.parse(JSON.stringify(history[newIndex].components)),
        historyIndex: newIndex,
        hasUnsavedChanges: true,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      set({
        components: JSON.parse(JSON.stringify(history[newIndex].components)),
        historyIndex: newIndex,
        hasUnsavedChanges: true,
      });
    }
  },

  saveToHistory: (action) => {
    const { components, history, historyIndex } = get();
    const newEntry: HistoryEntry = {
      components: JSON.parse(JSON.stringify(components)),
      timestamp: Date.now(),
      action,
    };
    
    // Remove any future history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newEntry);
    
    // Keep only last 50 entries
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setSaving: (saving) => set({ isSaving: saving }),
  
  markAsSaved: () => set({ 
    hasUnsavedChanges: false, 
    lastSavedAt: new Date() 
  }),
  
  markAsUnsaved: () => set({ hasUnsavedChanges: true }),

  getPageConfig: () => ({
    components: get().components,
  }),
}));
