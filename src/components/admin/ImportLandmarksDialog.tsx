import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileSpreadsheet, 
  Download,
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  FileText
} from "lucide-react";
import { landmarkCategories } from "@/pages/admin/AdminLandmarks";

interface Region {
  id: string;
  name_ar: string;
}

interface ParsedLandmark {
  name_ar: string;
  name_en?: string;
  category?: string;
  region_name?: string;
  lat?: number;
  lng?: number;
  isValid: boolean;
  errors: string[];
}

interface ImportLandmarksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  regions: Region[];
  onSuccess: () => void;
}

export const ImportLandmarksDialog = ({ open, onOpenChange, regions, onSuccess }: ImportLandmarksDialogProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload');
  const [parsedData, setParsedData] = useState<ParsedLandmark[]>([]);
  const [importResults, setImportResults] = useState({ success: 0, failed: 0 });
  const [fileName, setFileName] = useState("");

  const resetDialog = () => {
    setStep('upload');
    setParsedData([]);
    setImportResults({ success: 0, failed: 0 });
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
  };

  const parseCSV = (content: string): ParsedLandmark[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const data: ParsedLandmark[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: Record<string, string> = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx] || '';
      });

      const errors: string[] = [];
      const name_ar = row['name_ar'] || row['الاسم'] || row['اسم المعلم'] || '';
      const lat = parseFloat(row['lat'] || row['خط العرض'] || '0');
      const lng = parseFloat(row['lng'] || row['خط الطول'] || '0');

      if (!name_ar) errors.push('الاسم العربي مطلوب');
      if (!lat || lat < -90 || lat > 90) errors.push('خط العرض غير صالح');
      if (!lng || lng < -180 || lng > 180) errors.push('خط الطول غير صالح');

      data.push({
        name_ar,
        name_en: row['name_en'] || row['الاسم الإنجليزي'] || '',
        category: row['category'] || row['التصنيف'] || 'landmark',
        region_name: row['region'] || row['المنطقة'] || '',
        lat: lat || 0,
        lng: lng || 0,
        isValid: errors.length === 0,
        errors
      });
    }

    return data;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      setParsedData(parsed);
      setStep('preview');
    };
    reader.readAsText(file);
  };

  const findRegionId = (regionName: string): string | null => {
    if (!regionName) return null;
    const found = regions.find(r => 
      r.name_ar.includes(regionName) || regionName.includes(r.name_ar)
    );
    return found?.id || null;
  };

  const mapCategory = (category: string): string => {
    const normalized = category.toLowerCase().trim();
    if (Object.keys(landmarkCategories).includes(normalized)) {
      return normalized;
    }
    // Try to match Arabic labels
    const found = Object.entries(landmarkCategories).find(([_, config]) => 
      config.label.includes(category) || category.includes(config.label)
    );
    return found?.[0] || 'landmark';
  };

  const handleImport = async () => {
    setStep('importing');
    let success = 0;
    let failed = 0;

    const validItems = parsedData.filter(item => item.isValid);

    for (const item of validItems) {
      const { error } = await supabase.from("landmarks").insert({
        name_ar: item.name_ar,
        name_en: item.name_en || null,
        category: mapCategory(item.category || 'landmark'),
        region_id: findRegionId(item.region_name || ''),
        location: { lat: item.lat, lng: item.lng },
        is_active: true
      });

      if (error) {
        failed++;
        console.error('Import error:', error);
      } else {
        success++;
      }
    }

    setImportResults({ success, failed });
    setStep('done');
    
    if (success > 0) {
      onSuccess();
    }
  };

  const downloadTemplate = () => {
    const template = `name_ar,name_en,category,region,lat,lng
جامعة الأنبار,University of Anbar,university,مركز الرمادي,33.4235,43.3074
مستشفى الرمادي,Ramadi Hospital,hospital,مركز الرمادي,33.4280,43.3120
سوق الرمادي المركزي,Ramadi Central Market,market,مركز الرمادي,33.4250,43.3100`;

    const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'landmarks_template.csv';
    link.click();
  };

  const validCount = parsedData.filter(p => p.isValid).length;
  const invalidCount = parsedData.filter(p => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            استيراد المعالم من ملف
          </DialogTitle>
          <DialogDescription>
            استيراد عدة معالم دفعة واحدة من ملف CSV أو Excel
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            {/* Upload Area */}
            <div 
              className="border-2 border-dashed rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer bg-muted/20"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">اضغط هنا أو اسحب الملف</h3>
              <p className="text-sm text-muted-foreground mb-4">
                ملفات CSV فقط (حد أقصى 1000 معلم)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Template Download */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-1">
                    نموذج الملف
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    حمّل النموذج واملأه ببيانات المعالم، ثم ارفعه هنا
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
                    <Download className="w-4 h-4" />
                    تحميل النموذج CSV
                  </Button>
                </div>
              </div>
            </div>

            {/* Format Guide */}
            <div className="space-y-2">
              <h4 className="font-medium">الأعمدة المطلوبة:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <Badge variant="outline" className="justify-start">name_ar (مطلوب)</Badge>
                <Badge variant="outline" className="justify-start">lat (مطلوب)</Badge>
                <Badge variant="outline" className="justify-start">lng (مطلوب)</Badge>
                <Badge variant="secondary" className="justify-start">name_en (اختياري)</Badge>
                <Badge variant="secondary" className="justify-start">category (اختياري)</Badge>
                <Badge variant="secondary" className="justify-start">region (اختياري)</Badge>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <FileSpreadsheet className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-medium">{fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {parsedData.length} معلم تم قراءته
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-500 gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {validCount} صالح
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    {invalidCount} غير صالح
                  </Badge>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>الاسم العربي</TableHead>
                    <TableHead>الاسم الإنجليزي</TableHead>
                    <TableHead>التصنيف</TableHead>
                    <TableHead>المنطقة</TableHead>
                    <TableHead>الإحداثيات</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.map((item, idx) => (
                    <TableRow key={idx} className={!item.isValid ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{item.name_ar || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.name_en || '-'}</TableCell>
                      <TableCell>{landmarkCategories[item.category as keyof typeof landmarkCategories]?.label || item.category}</TableCell>
                      <TableCell>{item.region_name || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.lat?.toFixed(4)}, {item.lng?.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {item.isValid ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                            <span className="text-xs text-destructive">{item.errors[0]}</span>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {invalidCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="w-4 h-4" />
                سيتم تخطي {invalidCount} معلم غير صالح
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary mb-4" />
            <h3 className="font-medium text-lg mb-2">جاري الاستيراد...</h3>
            <p className="text-muted-foreground">
              يتم إضافة {validCount} معلم إلى قاعدة البيانات
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-medium text-lg mb-2">تم الاستيراد بنجاح!</h3>
            <div className="flex items-center justify-center gap-4 mb-4">
              <Badge variant="default" className="bg-green-500 text-lg py-1 px-3">
                {importResults.success} تم إضافتهم
              </Badge>
              {importResults.failed > 0 && (
                <Badge variant="destructive" className="text-lg py-1 px-3">
                  {importResults.failed} فشل
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              يمكنك الآن رؤية المعالم المضافة في القائمة
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>إلغاء</Button>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetDialog}>اختيار ملف آخر</Button>
              <Button onClick={handleImport} disabled={validCount === 0} className="gap-2">
                <Upload className="w-4 h-4" />
                استيراد {validCount} معلم
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>إغلاق</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
