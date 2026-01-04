// Export utilities for CSV/Excel export

export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  getValue?: (item: T) => string | number;
}

export const exportToCSV = <T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void => {
  if (data.length === 0) {
    throw new Error('لا توجد بيانات للتصدير');
  }

  // Add BOM for Excel to recognize UTF-8
  const BOM = '\uFEFF';
  
  // Create header row
  const headers = columns.map(col => `"${col.header}"`).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value: string | number;
      
      if (col.getValue) {
        value = col.getValue(item);
      } else {
        value = item[col.key as keyof T] as string | number;
      }
      
      // Handle null/undefined
      if (value === null || value === undefined) {
        return '""';
      }
      
      // Convert to string and escape quotes
      const strValue = String(value).replace(/"/g, '""');
      return `"${strValue}"`;
    }).join(',');
  });

  // Combine all rows
  const csvContent = BOM + [headers, ...rows].join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${formatDateForFilename(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatDateForFilename = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Driver export columns
export const getDriverExportColumns = () => [
  { key: 'full_name', header: 'الاسم الكامل' },
  { key: 'phone', header: 'رقم الهاتف' },
  { key: 'email', header: 'البريد الإلكتروني' },
  { 
    key: 'vehicle_type', 
    header: 'نوع السيارة',
    getValue: (d: any) => {
      const types: Record<string, string> = {
        economy: 'اقتصادي',
        comfort: 'مريح',
        premium: 'فاخر',
        women_only: 'نسائي',
      };
      return types[d.vehicle_type] || d.vehicle_type || '';
    }
  },
  { key: 'vehicle_model', header: 'موديل السيارة' },
  { key: 'vehicle_plate', header: 'رقم اللوحة' },
  { key: 'vehicle_color', header: 'لون السيارة' },
  { key: 'license_number', header: 'رقم الرخصة' },
  { 
    key: 'status', 
    header: 'الحالة',
    getValue: (d: any) => {
      const statuses: Record<string, string> = {
        pending: 'بانتظار الموافقة',
        approved: 'معتمد',
        rejected: 'مرفوض',
        suspended: 'موقوف',
      };
      return statuses[d.status] || d.status || '';
    }
  },
  { 
    key: 'is_online', 
    header: 'متصل',
    getValue: (d: any) => d.is_online ? 'نعم' : 'لا'
  },
  { 
    key: 'is_available', 
    header: 'متاح',
    getValue: (d: any) => d.is_available ? 'نعم' : 'لا'
  },
  { key: 'rating', header: 'التقييم' },
  { key: 'total_rides', header: 'عدد الرحلات' },
  { key: 'total_earnings', header: 'إجمالي الأرباح' },
  { 
    key: 'created_at', 
    header: 'تاريخ التسجيل',
    getValue: (d: any) => formatArabicDate(d.created_at)
  },
];

// Ride export columns
export const getRideExportColumns = () => [
  { 
    key: 'id', 
    header: 'رقم الرحلة',
    getValue: (r: any) => r.id?.slice(0, 8) || ''
  },
  { key: 'pickup_address', header: 'نقطة الانطلاق' },
  { key: 'dropoff_address', header: 'الوجهة' },
  { 
    key: 'status', 
    header: 'الحالة',
    getValue: (r: any) => {
      const statuses: Record<string, string> = {
        pending: 'بانتظار سائق',
        accepted: 'تم القبول',
        arrived: 'وصل السائق',
        in_progress: 'جارية',
        completed: 'مكتملة',
        cancelled: 'ملغية',
      };
      return statuses[r.status] || r.status || '';
    }
  },
  { 
    key: 'vehicle_type', 
    header: 'نوع السيارة',
    getValue: (r: any) => {
      const types: Record<string, string> = {
        economy: 'اقتصادي',
        comfort: 'مريح',
        premium: 'فاخر',
        women_only: 'نسائي',
      };
      return types[r.vehicle_type] || r.vehicle_type || '';
    }
  },
  { 
    key: 'distance_km', 
    header: 'المسافة (كم)',
    getValue: (r: any) => r.distance_km ? Number(r.distance_km).toFixed(1) : ''
  },
  { key: 'duration_minutes', header: 'المدة (دقيقة)' },
  { key: 'waiting_minutes', header: 'وقت الانتظار (دقيقة)' },
  { key: 'estimated_fare', header: 'الأجرة المقدرة' },
  { key: 'final_fare', header: 'الأجرة النهائية' },
  { 
    key: 'payment_method', 
    header: 'طريقة الدفع',
    getValue: (r: any) => {
      const methods: Record<string, string> = {
        cash: 'نقدي',
        zain_cash: 'زين كاش',
        asia_hawala: 'آسيا حوالة',
        qi_card: 'كي كارد',
      };
      return methods[r.payment_method] || r.payment_method || '';
    }
  },
  { key: 'cancellation_reason', header: 'سبب الإلغاء' },
  { 
    key: 'created_at', 
    header: 'تاريخ الإنشاء',
    getValue: (r: any) => formatArabicDate(r.created_at)
  },
  { 
    key: 'completed_at', 
    header: 'تاريخ الإكمال',
    getValue: (r: any) => r.completed_at ? formatArabicDate(r.completed_at) : ''
  },
];

const formatArabicDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};
