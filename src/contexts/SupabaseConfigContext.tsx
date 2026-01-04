import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import {
  SupabaseProject,
  getActiveProject,
  setActiveProject as setActiveProjectConfig,
  getSupabaseConfig,
  addProject,
  updateProject,
  deleteProject,
  testConnection,
} from '@/lib/supabaseConfig';
import { toast } from 'sonner';

interface SupabaseConfigContextType {
  // المشروع النشط
  activeProject: SupabaseProject;
  // جميع المشاريع
  projects: SupabaseProject[];
  // عميل Supabase الحالي
  supabaseClient: SupabaseClient<Database>;
  // تبديل المشروع
  switchProject: (projectId: string) => Promise<boolean>;
  // إضافة مشروع جديد
  addNewProject: (project: Omit<SupabaseProject, 'id' | 'createdAt'>) => SupabaseProject;
  // تحديث مشروع
  updateExistingProject: (id: string, updates: Partial<SupabaseProject>) => boolean;
  // حذف مشروع
  removeProject: (id: string) => boolean;
  // اختبار الاتصال
  testProjectConnection: (url: string, anonKey: string) => Promise<{ success: boolean; error?: string }>;
  // إعادة تحميل المشاريع
  refreshProjects: () => void;
}

const SupabaseConfigContext = createContext<SupabaseConfigContextType | undefined>(undefined);

// إنشاء عميل Supabase
const createSupabaseClient = (url: string, anonKey: string): SupabaseClient<Database> => {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
};

export const SupabaseConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeProject, setActiveProject] = useState<SupabaseProject>(getActiveProject);
  const [projects, setProjects] = useState<SupabaseProject[]>(getSupabaseConfig().projects);
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient<Database>>(
    () => createSupabaseClient(activeProject.url, activeProject.anonKey)
  );

  // تحديث قائمة المشاريع
  const refreshProjects = useCallback(() => {
    const config = getSupabaseConfig();
    setProjects(config.projects);
    setActiveProject(getActiveProject());
  }, []);

  // تبديل المشروع النشط
  const switchProject = useCallback(async (projectId: string): Promise<boolean> => {
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      toast.error('المشروع غير موجود');
      return false;
    }

    // اختبار الاتصال أولاً
    const connectionTest = await testConnection(project.url, project.anonKey);
    if (!connectionTest.success) {
      toast.error(`فشل الاتصال بالمشروع: ${connectionTest.error}`);
      return false;
    }

    // تسجيل الخروج من المشروع الحالي
    try {
      await supabaseClient.auth.signOut();
    } catch (error) {
      console.warn('Error signing out:', error);
    }

    // تحديث الإعدادات
    setActiveProjectConfig(projectId);
    setActiveProject(project);
    
    // إنشاء عميل جديد
    const newClient = createSupabaseClient(project.url, project.anonKey);
    setSupabaseClient(newClient);

    toast.success(`تم التبديل إلى: ${project.name}`);
    
    // إعادة تحميل الصفحة لتطبيق التغييرات
    setTimeout(() => {
      window.location.href = '/admin/login';
    }, 1000);

    return true;
  }, [projects, supabaseClient]);

  // إضافة مشروع جديد
  const addNewProject = useCallback((project: Omit<SupabaseProject, 'id' | 'createdAt'>): SupabaseProject => {
    const newProject = addProject(project);
    refreshProjects();
    toast.success(`تمت إضافة المشروع: ${newProject.name}`);
    return newProject;
  }, [refreshProjects]);

  // تحديث مشروع
  const updateExistingProject = useCallback((id: string, updates: Partial<SupabaseProject>): boolean => {
    const success = updateProject(id, updates);
    if (success) {
      refreshProjects();
      toast.success('تم تحديث المشروع');
    } else {
      toast.error('فشل تحديث المشروع');
    }
    return success;
  }, [refreshProjects]);

  // حذف مشروع
  const removeProject = useCallback((id: string): boolean => {
    const project = projects.find(p => p.id === id);
    if (!project) return false;
    
    if (project.isDefault) {
      toast.error('لا يمكن حذف المشروع الافتراضي');
      return false;
    }

    const success = deleteProject(id);
    if (success) {
      refreshProjects();
      toast.success('تم حذف المشروع');
    } else {
      toast.error('فشل حذف المشروع');
    }
    return success;
  }, [projects, refreshProjects]);

  // اختبار الاتصال
  const testProjectConnection = useCallback(async (url: string, anonKey: string) => {
    return await testConnection(url, anonKey);
  }, []);

  // الاستماع لتغييرات localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'supabase_config') {
        refreshProjects();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshProjects]);

  return (
    <SupabaseConfigContext.Provider
      value={{
        activeProject,
        projects,
        supabaseClient,
        switchProject,
        addNewProject,
        updateExistingProject,
        removeProject,
        testProjectConnection,
        refreshProjects,
      }}
    >
      {children}
    </SupabaseConfigContext.Provider>
  );
};

export const useSupabaseConfig = (): SupabaseConfigContextType => {
  const context = useContext(SupabaseConfigContext);
  if (!context) {
    throw new Error('useSupabaseConfig must be used within a SupabaseConfigProvider');
  }
  return context;
};
