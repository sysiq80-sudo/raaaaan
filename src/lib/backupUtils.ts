import { supabase } from '@/integrations/supabase/client';

export interface BackupData {
  version: string;
  createdAt: string;
  appSettings: any[];
  regions: any[];
  driverIncentives: any[];
  landmarks: any[];
}

export interface BackupMetadata {
  id: string;
  name: string;
  createdAt: string;
  size: number;
  tables: string[];
}

const BACKUP_STORAGE_KEY = 'app_backups';
const AUTO_BACKUP_KEY = 'auto_backup_settings';

export interface AutoBackupSettings {
  enabled: boolean;
  intervalHours: number;
  maxBackups: number;
  lastBackupAt: string | null;
}

export const getAutoBackupSettings = (): AutoBackupSettings => {
  const stored = localStorage.getItem(AUTO_BACKUP_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    enabled: false,
    intervalHours: 24,
    maxBackups: 5,
    lastBackupAt: null
  };
};

export const saveAutoBackupSettings = (settings: AutoBackupSettings): void => {
  localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(settings));
};

export const getStoredBackups = (): BackupMetadata[] => {
  const stored = localStorage.getItem(BACKUP_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
};

const saveBackupMetadata = (metadata: BackupMetadata[]): void => {
  localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(metadata));
};

export const createBackup = async (name?: string): Promise<{ success: boolean; error?: string; backup?: BackupData }> => {
  try {
    // Fetch all important data
    const [settingsRes, regionsRes, incentivesRes, landmarksRes] = await Promise.all([
      supabase.from('app_settings').select('*'),
      supabase.from('regions').select('*'),
      supabase.from('driver_incentives').select('*'),
      supabase.from('landmarks').select('*')
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (regionsRes.error) throw regionsRes.error;
    if (incentivesRes.error) throw incentivesRes.error;
    if (landmarksRes.error) throw landmarksRes.error;

    const backup: BackupData = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      appSettings: settingsRes.data || [],
      regions: regionsRes.data || [],
      driverIncentives: incentivesRes.data || [],
      landmarks: landmarksRes.data || []
    };

    // Save to localStorage
    const backupString = JSON.stringify(backup);
    const backupId = `backup_${Date.now()}`;
    const backupName = name || `نسخة احتياطية - ${new Date().toLocaleDateString('ar-IQ')}`;
    
    localStorage.setItem(backupId, backupString);

    // Update metadata
    const metadata = getStoredBackups();
    const newMetadata: BackupMetadata = {
      id: backupId,
      name: backupName,
      createdAt: backup.createdAt,
      size: backupString.length,
      tables: ['app_settings', 'regions', 'driver_incentives', 'landmarks']
    };
    
    metadata.unshift(newMetadata);
    
    // Limit stored backups
    const settings = getAutoBackupSettings();
    while (metadata.length > settings.maxBackups) {
      const removed = metadata.pop();
      if (removed) {
        localStorage.removeItem(removed.id);
      }
    }
    
    saveBackupMetadata(metadata);

    // Update last backup time
    settings.lastBackupAt = backup.createdAt;
    saveAutoBackupSettings(settings);

    return { success: true, backup };
  } catch (error: any) {
    console.error('Backup error:', error);
    return { success: false, error: error.message };
  }
};

export const restoreBackup = async (backupId: string): Promise<{ success: boolean; error?: string; restored?: string[] }> => {
  try {
    const backupString = localStorage.getItem(backupId);
    if (!backupString) {
      return { success: false, error: 'النسخة الاحتياطية غير موجودة' };
    }

    const backup: BackupData = JSON.parse(backupString);
    const restored: string[] = [];

    // Restore app_settings
    if (backup.appSettings && backup.appSettings.length > 0) {
      for (const setting of backup.appSettings) {
        const { error } = await supabase
          .from('app_settings')
          .upsert(setting, { onConflict: 'key' });
        if (error) console.error('Error restoring setting:', error);
      }
      restored.push('app_settings');
    }

    // Restore regions
    if (backup.regions && backup.regions.length > 0) {
      for (const region of backup.regions) {
        const { error } = await supabase
          .from('regions')
          .upsert(region, { onConflict: 'id' });
        if (error) console.error('Error restoring region:', error);
      }
      restored.push('regions');
    }

    // Restore driver_incentives
    if (backup.driverIncentives && backup.driverIncentives.length > 0) {
      for (const incentive of backup.driverIncentives) {
        const { error } = await supabase
          .from('driver_incentives')
          .upsert(incentive, { onConflict: 'id' });
        if (error) console.error('Error restoring incentive:', error);
      }
      restored.push('driver_incentives');
    }

    // Restore landmarks
    if (backup.landmarks && backup.landmarks.length > 0) {
      for (const landmark of backup.landmarks) {
        const { error } = await supabase
          .from('landmarks')
          .upsert(landmark, { onConflict: 'id' });
        if (error) console.error('Error restoring landmark:', error);
      }
      restored.push('landmarks');
    }

    return { success: true, restored };
  } catch (error: any) {
    console.error('Restore error:', error);
    return { success: false, error: error.message };
  }
};

export const deleteBackup = (backupId: string): boolean => {
  try {
    localStorage.removeItem(backupId);
    const metadata = getStoredBackups().filter(b => b.id !== backupId);
    saveBackupMetadata(metadata);
    return true;
  } catch {
    return false;
  }
};

export const exportBackupToFile = (backupId: string): boolean => {
  try {
    const backupString = localStorage.getItem(backupId);
    if (!backupString) return false;

    const blob = new Blob([backupString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};

export const importBackupFromFile = (file: File): Promise<{ success: boolean; error?: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup: BackupData = JSON.parse(content);
        
        // Validate backup structure
        if (!backup.version || !backup.createdAt) {
          resolve({ success: false, error: 'ملف النسخة الاحتياطية غير صالح' });
          return;
        }

        const backupId = `backup_imported_${Date.now()}`;
        localStorage.setItem(backupId, content);

        const metadata = getStoredBackups();
        metadata.unshift({
          id: backupId,
          name: `نسخة مستوردة - ${new Date().toLocaleDateString('ar-IQ')}`,
          createdAt: backup.createdAt,
          size: content.length,
          tables: ['app_settings', 'regions', 'driver_incentives', 'landmarks']
        });
        saveBackupMetadata(metadata);

        resolve({ success: true });
      } catch (error: any) {
        resolve({ success: false, error: 'فشل في قراءة الملف' });
      }
    };
    reader.onerror = () => resolve({ success: false, error: 'فشل في قراءة الملف' });
    reader.readAsText(file);
  });
};

export const checkAutoBackup = async (): Promise<boolean> => {
  const settings = getAutoBackupSettings();
  if (!settings.enabled) return false;

  const now = new Date();
  const lastBackup = settings.lastBackupAt ? new Date(settings.lastBackupAt) : null;
  
  if (!lastBackup) {
    await createBackup('نسخة تلقائية');
    return true;
  }

  const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceLastBackup >= settings.intervalHours) {
    await createBackup('نسخة تلقائية');
    return true;
  }

  return false;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
