import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Car, CheckCircle2, Upload, Camera, Image, FileText, User, ArrowRight, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DocumentFile {
  file: File;
  preview: string;
}

const DriverCompleteRegistration = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Step 1: Vehicle info
  const [vehicleType, setVehicleType] = useState('economy');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  
  // Step 2: Documents
  const [vehicleImage, setVehicleImage] = useState<DocumentFile | null>(null);
  const [licenseFront, setLicenseFront] = useState<DocumentFile | null>(null);
  const [licenseBack, setLicenseBack] = useState<DocumentFile | null>(null);
  const [idFront, setIdFront] = useState<DocumentFile | null>(null);
  const [idBack, setIdBack] = useState<DocumentFile | null>(null);
  const [residencyCard, setResidencyCard] = useState<DocumentFile | null>(null);
  const [guarantorId, setGuarantorId] = useState<DocumentFile | null>(null);
  
  // Step 3: Personal photo
  const [personalPhoto, setPersonalPhoto] = useState<DocumentFile | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('يرجى تسجيل الدخول أولاً');
        navigate('/driver/auth');
        return;
      }

      // Get driver data
      const { data: driverData, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error || !driverData) {
        toast.error('لم يتم العثور على بيانات السائق، يرجى التسجيل أولاً');
        navigate('/driver/register');
        return;
      }

      // Check if profile is already complete - redirect to status page
      const isProfileComplete = driverData.vehicle_image_url && 
        driverData.license_image_url && 
        driverData.profile_image_url &&
        driverData.vehicle_model &&
        driverData.vehicle_plate;

      if (isProfileComplete) {
        toast.info('بياناتك مكتملة، يمكنك متابعة حالة طلبك');
        navigate('/driver/application-status');
        return;
      }

      setDriver(driverData);
      
      // Pre-fill existing data
      if (driverData.vehicle_type) setVehicleType(driverData.vehicle_type);
      if (driverData.vehicle_model) setVehicleModel(driverData.vehicle_model);
      if (driverData.vehicle_color) setVehicleColor(driverData.vehicle_color);
      if (driverData.vehicle_plate) setVehiclePlate(driverData.vehicle_plate);
      
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/driver/auth');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<DocumentFile | null>>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار صورة فقط');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الملف يجب أن يكون أقل من 5 ميجابايت');
      return;
    }
    
    const preview = URL.createObjectURL(file);
    setter({ file, preview });
  };

  const uploadFile = async (file: File, path: string): Promise<string | null> => {
    try {
      const { error: uploadError } = await supabase.storage
        .from('driver-documents')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('driver-documents')
        .getPublicUrl(path);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleVehicleInfoSubmit = async () => {
    if (!vehicleModel.trim()) {
      toast.error('يرجى إدخال موديل السيارة');
      return;
    }
    if (!vehicleColor.trim()) {
      toast.error('يرجى إدخال لون السيارة');
      return;
    }
    if (!vehiclePlate.trim()) {
      toast.error('يرجى إدخال رقم اللوحة');
      return;
    }

    setCurrentStep(2);
  };

  const handleDocumentsSubmit = async () => {
    if (!vehicleImage) {
      toast.error('يرجى رفع صورة السيارة');
      return;
    }
    if (!licenseFront || !licenseBack) {
      toast.error('يرجى رفع صورتي إجازة السوق (الوجهين)');
      return;
    }
    if (!idFront || !idBack) {
      toast.error('يرجى رفع صورتي البطاقة الموحدة (الوجهين)');
      return;
    }
    if (!residencyCard || !guarantorId) {
      toast.error('يرجى رفع بطاقة السكن وهوية الكفيل (متطلبات قانونية)');
      return;
    }

    setCurrentStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!personalPhoto) {
      toast.error('يرجى رفع صورتك الشخصية');
      return;
    }

    setIsLoading(true);

    try {
      const driverId = driver.id;
      const folderPath = driver.user_id;

      // Upload all files
      const [
        vehicleImageUrl,
        licenseFrontUrl,
        licenseBackUrl,
        idFrontUrl,
        idBackUrl,
        residencyCardUrl,
        guarantorIdUrl,
        personalPhotoUrl
      ] = await Promise.all([
        uploadFile(vehicleImage!.file, `${folderPath}/vehicle.jpg`),
        uploadFile(licenseFront!.file, `${folderPath}/license_front.jpg`),
        uploadFile(licenseBack!.file, `${folderPath}/license_back.jpg`),
        uploadFile(idFront!.file, `${folderPath}/id_front.jpg`),
        uploadFile(idBack!.file, `${folderPath}/id_back.jpg`),
        uploadFile(residencyCard!.file, `${folderPath}/residency.jpg`),
        uploadFile(guarantorId!.file, `${folderPath}/guarantor.jpg`),
        uploadFile(personalPhoto!.file, `${folderPath}/profile.jpg`)
      ]);

      // Update driver record
      const { error } = await supabase
        .from('drivers')
        .update({
          vehicle_type: vehicleType as any,
          vehicle_model: vehicleModel,
          vehicle_color: vehicleColor,
          vehicle_plate: vehiclePlate,
          vehicle_image_url: vehicleImageUrl,
          license_image_url: licenseFrontUrl,
          license_image_back_url: licenseBackUrl,
          id_image_url: idFrontUrl,
          id_image_back_url: idBackUrl,
          residency_image_url: residencyCardUrl,
          guarantor_image_url: guarantorIdUrl,
          profile_image_url: personalPhotoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId);

      if (error) throw error;

      setCurrentStep(4); // Success step
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(error.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  const DocumentUploadBox = ({ 
    label, 
    file, 
    onSelect,
    onRemove,
    description = ''
  }: {
    label: string;
    file: DocumentFile | null;
    onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemove: () => void;
    description?: string;
  }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {file ? (
        <div className="relative rounded-lg overflow-hidden border-2 border-primary bg-muted">
          <img src={file.preview} alt={label} className="w-full h-32 object-cover" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 left-2 p-1 bg-destructive text-destructive-foreground rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">اضغط للرفع</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onSelect}
          />
        </label>
      )}
    </div>
  );

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-4" dir="rtl">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link to="/driver" className="p-2 hover:bg-muted rounded-full">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">إكمال بيانات التسجيل</h1>
            <p className="text-sm text-muted-foreground">مرحباً {driver?.full_name}</p>
          </div>
        </div>

        {/* Step Indicator */}
        {currentStep <= 3 && (
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    currentStep >= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step ? <CheckCircle2 className="w-5 h-5" /> : step}
                </div>
                {step < 3 && (
                  <div
                    className={`w-8 h-1 mx-1 rounded ${
                      currentStep > step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step 1: Vehicle Info */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="w-5 h-5" />
                معلومات السيارة
              </CardTitle>
              <CardDescription>أدخل بيانات سيارتك بدقة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                <p className="text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  تأكد من مطابقة البيانات للسيارة الفعلية - أي اختلاف سيؤدي لإغلاق الحساب
                </p>
              </div>

              <div className="space-y-2">
                <Label>نوع السيارة</Label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="economy">اقتصادي</SelectItem>
                    <SelectItem value="comfort">مريح</SelectItem>
                    <SelectItem value="premium">فاخر</SelectItem>
                    <SelectItem value="women_only">تكسي نسائي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleModel">موديل السيارة *</Label>
                <Input
                  id="vehicleModel"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="مثال: تويوتا كورولا 2020"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleColor">لون السيارة *</Label>
                <Input
                  id="vehicleColor"
                  value={vehicleColor}
                  onChange={(e) => setVehicleColor(e.target.value)}
                  placeholder="مثال: أبيض"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehiclePlate">رقم اللوحة *</Label>
                <Input
                  id="vehiclePlate"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="مثال: 12345 أ ب ج"
                  dir="ltr"
                />
              </div>

              <Button onClick={handleVehicleInfoSubmit} className="w-full">
                التالي
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Documents */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                رفع المستندات
              </CardTitle>
              <CardDescription>ارفع صور المستندات المطلوبة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <DocumentUploadBox
                label="صورة السيارة"
                description="صورة جانبية كاملة للسيارة تُظهر جميع التفاصيل"
                file={vehicleImage}
                onSelect={(e) => handleFileSelect(e, setVehicleImage)}
                onRemove={() => setVehicleImage(null)}
              />

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  إجازة السوق (الوجهين)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <DocumentUploadBox
                    label="الوجه الأمامي"
                    file={licenseFront}
                    onSelect={(e) => handleFileSelect(e, setLicenseFront)}
                    onRemove={() => setLicenseFront(null)}
                  />
                  <DocumentUploadBox
                    label="الوجه الخلفي"
                    file={licenseBack}
                    onSelect={(e) => handleFileSelect(e, setLicenseBack)}
                    onRemove={() => setLicenseBack(null)}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  البطاقة الموحدة (الوجهين)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <DocumentUploadBox
                    label="الوجه الأمامي"
                    file={idFront}
                    onSelect={(e) => handleFileSelect(e, setIdFront)}
                    onRemove={() => setIdFront(null)}
                  />
                  <DocumentUploadBox
                    label="الوجه الخلفي"
                    file={idBack}
                    onSelect={(e) => handleFileSelect(e, setIdBack)}
                    onRemove={() => setIdBack(null)}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  المستمسكات القانونية الإضافية
                </h4>
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg mb-4">
                  <p className="text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    لأغراض أمنية وقانونية وفق تعليمات دائرة المرور يجب إرفاق بطاقة السكن وهوية تخص الكفيل.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DocumentUploadBox
                    label="بطاقة السكن (الأمام)"
                    file={residencyCard}
                    onSelect={(e) => handleFileSelect(e, setResidencyCard)}
                    onRemove={() => setResidencyCard(null)}
                  />
                  <DocumentUploadBox
                    label="هوية الكفيل (الأمام)"
                    file={guarantorId}
                    onSelect={(e) => handleFileSelect(e, setGuarantorId)}
                    onRemove={() => setGuarantorId(null)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                  رجوع
                </Button>
                <Button onClick={handleDocumentsSubmit} className="flex-1">
                  التالي
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Personal Photo */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                الصورة الشخصية
              </CardTitle>
              <CardDescription>ارفع صورتك الشخصية الواضحة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg space-y-2">
                <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  شروط الصورة الشخصية:
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                  <li>صورة واضحة تُظهر ملامح وجهك بدقة</li>
                  <li>قريبة من الوجه</li>
                  <li>بدون نظارات شمسية</li>
                  <li>بدون تغطية للوجه</li>
                  <li>ليست صورة طبيعة أو سيارة أو أي شيء آخر</li>
                </ul>
              </div>

              {personalPhoto ? (
                <div className="relative">
                  <div className="w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-primary">
                    <img src={personalPhoto.preview} alt="صورة شخصية" className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => setPersonalPhoto(null)}
                    className="absolute top-0 right-1/2 translate-x-1/2 p-1 bg-destructive text-destructive-foreground rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">التقط صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, setPersonalPhoto)}
                    />
                  </label>
                  <label className="flex-1 flex flex-col items-center justify-center h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Image className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">اختر صورة</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e, setPersonalPhoto)}
                    />
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                  رجوع
                </Button>
                <Button onClick={handleFinalSubmit} className="flex-1" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    'إرسال الطلب'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Success */}
        {currentStep === 4 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-8 text-center space-y-6">
              <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-primary">تم إرسال بياناتك! 🎉</h2>
                <p className="text-muted-foreground">
                  شكراً لك على إكمال البيانات
                </p>
              </div>

              <div className="bg-background p-4 rounded-lg border text-sm space-y-3 text-right">
                <p className="font-semibold text-foreground">📢 ماذا الآن؟</p>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• سيقوم فريق الإدارة بمراجعة طلبك والمستندات</li>
                  <li>• <strong>تابع الإشعارات</strong> في التطبيق لمعرفة حالة الموافقة</li>
                  <li>• تابع <strong>قناة التليغرام الرسمية</strong> للإعلان عن قبول السائقين الجدد</li>
                  <li>• عند الموافقة، ستتمكن من استلام الطلبات فوراً</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => navigate('/driver/application-status')} size="lg" className="flex-1">
                  متابعة حالة الطلب
                </Button>
                <Button onClick={() => navigate('/driver')} variant="outline" size="lg" className="flex-1">
                  الصفحة الرئيسية
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DriverCompleteRegistration;
