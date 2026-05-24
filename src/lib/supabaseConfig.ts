// Supabase Configuration Manager
// يتيح التبديل بين مشاريع Supabase المختلفة

export interface SupabaseProject {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  isDefault?: boolean;
  createdAt: string;
}

export interface SupabaseConfig {
  activeProjectId: string;
  projects: SupabaseProject[];
}

// الإعدادات الافتراضية للمشروع الحالي — تقرأ من متغيرات البيئة فقط
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Supabase] متغيرات البيئة مفقودة: VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY مطلوبة في ملف .env'
  );
}

const DEFAULT_PROJECT: SupabaseProject = {
  id: 'default',
  name: 'المشروع الرئيسي',
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  isDefault: true,
  createdAt: new Date().toISOString(),
};

const STORAGE_KEY = 'supabase_config';

// الحصول على الإعدادات من localStorage
export const getSupabaseConfig = (): SupabaseConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored) as SupabaseConfig;
      // التأكد من وجود المشروع الافتراضي
      const hasDefault = config.projects.some(p => p.id === 'default');
      if (!hasDefault) {
        config.projects.unshift(DEFAULT_PROJECT);
      }
      return config;
    }
  } catch (error) {
    console.error('Error reading Supabase config:', error);
  }
  
  return {
    activeProjectId: 'default',
    projects: [DEFAULT_PROJECT],
  };
};

// حفظ الإعدادات في localStorage
export const saveSupabaseConfig = (config: SupabaseConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving Supabase config:', error);
  }
};

// الحصول على المشروع النشط
export const getActiveProject = (): SupabaseProject => {
  const config = getSupabaseConfig();
  const activeProject = config.projects.find(p => p.id === config.activeProjectId);
  return activeProject || DEFAULT_PROJECT;
};

// الحصول على URL المشروع النشط
export const getSupabaseUrl = (): string => {
  return getActiveProject().url;
};

// الحصول على Anon Key للمشروع النشط
export const getSupabaseAnonKey = (): string => {
  return getActiveProject().anonKey;
};

// إضافة مشروع جديد
export const addProject = (project: Omit<SupabaseProject, 'id' | 'createdAt'>): SupabaseProject => {
  const config = getSupabaseConfig();
  const newProject: SupabaseProject = {
    ...project,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  
  config.projects.push(newProject);
  saveSupabaseConfig(config);
  
  return newProject;
};

// تحديث مشروع
export const updateProject = (id: string, updates: Partial<SupabaseProject>): boolean => {
  const config = getSupabaseConfig();
  const projectIndex = config.projects.findIndex(p => p.id === id);
  
  if (projectIndex === -1) return false;
  
  // لا يمكن تعديل المشروع الافتراضي
  if (id === 'default' && (updates.url || updates.anonKey)) {
    return false;
  }
  
  config.projects[projectIndex] = { ...config.projects[projectIndex], ...updates };
  saveSupabaseConfig(config);
  
  return true;
};

// حذف مشروع
export const deleteProject = (id: string): boolean => {
  if (id === 'default') return false; // لا يمكن حذف المشروع الافتراضي
  
  const config = getSupabaseConfig();
  config.projects = config.projects.filter(p => p.id !== id);
  
  // إذا كان المشروع المحذوف هو النشط، العودة للافتراضي
  if (config.activeProjectId === id) {
    config.activeProjectId = 'default';
  }
  
  saveSupabaseConfig(config);
  return true;
};

// تبديل المشروع النشط
export const setActiveProject = (projectId: string): boolean => {
  const config = getSupabaseConfig();
  const projectExists = config.projects.some(p => p.id === projectId);
  
  if (!projectExists) return false;
  
  config.activeProjectId = projectId;
  saveSupabaseConfig(config);
  
  return true;
};

// اختبار الاتصال بمشروع Supabase
export const testConnection = async (url: string, anonKey: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // محاولة الاتصال بقاعدة البيانات
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });
    
    if (response.ok || response.status === 200) {
      return { success: true };
    }
    
    return { 
      success: false, 
      error: `فشل الاتصال: ${response.status} ${response.statusText}` 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'خطأ غير معروف' 
    };
  }
};

// الحصول على المشروع الافتراضي
export const getDefaultProject = (): SupabaseProject => {
  return DEFAULT_PROJECT;
};
