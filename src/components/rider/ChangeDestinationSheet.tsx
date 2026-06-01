import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Plus, Navigation, Loader2, Search, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { calculateLocalDistance, isPointOnRoute } from '@/lib/mapUtils';

interface Coordinates {
  lat: number;
  lng: number;
}

interface ChangeDestinationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  rideId: string;
  currentPosition: Coordinates;
  originalDropoff: Coordinates;
  originalDropoffAddress: string;
  currentFare: number;
  perKmFare: number;
  routeCoordinates?: Coordinates[];
  onDestinationChanged: (newDropoff: Coordinates, newAddress: string, newFare: number) => void;
  onStopAdded: (stop: Coordinates, stopAddress: string, addedFare: number) => void;
}

interface SearchResult {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
}

type ChangeType = 'stop' | 'destination' | null;

const ChangeDestinationSheet: React.FC<ChangeDestinationSheetProps> = ({
  isOpen,
  onClose,
  rideId,
  currentPosition,
  originalDropoff,
  originalDropoffAddress,
  currentFare,
  perKmFare,
  routeCoordinates,
  onDestinationChanged,
  onStopAdded
}) => {
  const [changeType, setChangeType] = useState<ChangeType>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<SearchResult | null>(null);
  const [calculatedFare, setCalculatedFare] = useState<{ addedFare: number; totalFare: number; type: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  // Reset state when sheet closes
  useEffect(() => {
    if (!isOpen) {
      setChangeType(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedLocation(null);
      setCalculatedFare(null);
    }
  }, [isOpen]);

  // Calculate fare when location is selected
  useEffect(() => {
    if (selectedLocation && changeType) {
      calculateNewFare(selectedLocation.location, changeType);
    }
  }, [selectedLocation, changeType]);

  const searchPlaces = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // Search using Mapbox geocoding
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/search-places?query=${encodeURIComponent(query)}&lat=${currentPosition.lat}&lng=${currentPosition.lng}`
      );
      const data = await response.json();
      
      if (data.results) {
        setSearchResults(data.results.map((r: any) => ({
          id: r.id,
          name: r.name,
          address: r.address || r.name,
          location: { lat: r.lat, lng: r.lng }
        })));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateNewFare = (newLocation: Coordinates, type: ChangeType) => {
    const WAITING_FARE_PER_MIN = 250; // سعر الانتظار بالدقيقة
    const ESTIMATED_STOP_MINUTES = 5; // وقت التوقف المقدر
    
    // المسافة المتبقية للوجهة الأصلية
    const originalRemainingDistance = calculateLocalDistance(currentPosition, originalDropoff);
    
    if (type === 'stop') {
      // التحقق إذا كانت المحطة على المسار
      const onRoute = routeCoordinates 
        ? isPointOnRoute(newLocation, routeCoordinates, 0.3) // 300 متر tolerance
        : false;
      
      if (onRoute) {
        // محطة على المسار - فقط رسوم انتظار
        const waitingFee = ESTIMATED_STOP_MINUTES * WAITING_FARE_PER_MIN;
        setCalculatedFare({
          addedFare: waitingFee,
          totalFare: currentFare + waitingFee,
          type: 'on_route'
        });
      } else {
        // محطة ليست على المسار - حساب المسافة الإضافية
        const distanceToStop = calculateLocalDistance(currentPosition, newLocation);
        const distanceFromStopToDropoff = calculateLocalDistance(newLocation, originalDropoff);
        const detourDistance = (distanceToStop + distanceFromStopToDropoff) - originalRemainingDistance;
        
        const detourFare = Math.max(0, Math.round(detourDistance * perKmFare));
        const waitingFee = ESTIMATED_STOP_MINUTES * WAITING_FARE_PER_MIN;
        const totalAdded = detourFare + waitingFee;
        
        setCalculatedFare({
          addedFare: totalAdded,
          totalFare: currentFare + totalAdded,
          type: 'detour'
        });
      }
    } else if (type === 'destination') {
      // تغيير الوجهة النهائية
      const newRemainingDistance = calculateLocalDistance(currentPosition, newLocation);
      const distanceDiff = newRemainingDistance - originalRemainingDistance;
      const fareDiff = Math.round(distanceDiff * perKmFare);
      
      setCalculatedFare({
        addedFare: fareDiff,
        totalFare: currentFare + fareDiff,
        type: 'destination_change'
      });
    }
  };

  const handleConfirm = async () => {
    if (!selectedLocation || !calculatedFare) return;
    
    setIsUpdating(true);
    try {
      if (changeType === 'destination') {
        // تحديث الوجهة النهائية
        const { error } = await supabase
          .from('rides')
          .update({
            dropoff_location: selectedLocation.location as any,
            dropoff_address: selectedLocation.address,
            estimated_fare: calculatedFare.totalFare,
            updated_at: new Date().toISOString()
          })
          .eq('id', rideId);
        
        if (error) throw error;
        
        onDestinationChanged(selectedLocation.location, selectedLocation.address, calculatedFare.totalFare);
        toast({
          title: '✅ تم تحديث الوجهة',
          description: `الأجرة الجديدة: ${calculatedFare.totalFare.toLocaleString('en-US')} د.ع`
        });
      } else if (changeType === 'stop') {
        // إضافة محطة توقف - تحديث السعر فقط حالياً
        // ملاحظة: يمكن إضافة عمود intermediate_stops لاحقاً
        const { error } = await supabase
          .from('rides')
          .update({
            estimated_fare: calculatedFare.totalFare,
            updated_at: new Date().toISOString()
          })
          .eq('id', rideId);
        
        if (error) throw error;
        
        onStopAdded(selectedLocation.location, selectedLocation.address, calculatedFare.addedFare);
        toast({
          title: '✅ تم إضافة محطة التوقف',
          description: `السعر الإضافي: +${calculatedFare.addedFare.toLocaleString('en-US')} د.ع`
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating:', error);
      toast({
        title: 'حدث خطأ',
        description: 'لم نتمكن من تحديث الرحلة',
        variant: 'destructive'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-center">
            {!changeType ? 'تغيير الوجهة' : changeType === 'stop' ? 'إضافة محطة توقف' : 'تغيير الوجهة النهائية'}
          </SheetTitle>
        </SheetHeader>

        <div className="py-4 space-y-4 overflow-y-auto h-[calc(100%-80px)]">
          {/* اختيار نوع التغيير */}
          {!changeType && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                ماذا تريد أن تفعل؟
              </p>
              
              <button
                className="w-full p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors flex items-center gap-4"
                onClick={() => setChangeType('stop')}
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-amber-600" />
                </div>
                <div className="text-right flex-1">
                  <p className="font-semibold">إضافة محطة توقف</p>
                  <p className="text-xs text-muted-foreground">لإنزال شخص أو استلام شيء في الطريق</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <button
                className="w-full p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors flex items-center gap-4"
                onClick={() => setChangeType('destination')}
              >
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div className="text-right flex-1">
                  <p className="font-semibold">تغيير الوجهة النهائية</p>
                  <p className="text-xs text-muted-foreground">استبدال الوجهة بمكان آخر</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
              
              {/* عرض الوجهة الحالية */}
              <div className="mt-6 p-4 bg-muted/50 rounded-xl">
                <p className="text-xs text-muted-foreground mb-2">الوجهة الحالية:</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <p className="text-sm font-medium">{originalDropoffAddress || 'غير محدد'}</p>
                </div>
              </div>
            </div>
          )}

          {/* واجهة البحث */}
          {changeType && !selectedLocation && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setChangeType(null)}
              >
                ← رجوع
              </Button>
              
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder={changeType === 'stop' ? 'ابحث عن محطة التوقف...' : 'ابحث عن الوجهة الجديدة...'}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchPlaces(e.target.value);
                  }}
                  className="pr-10 h-12"
                  autoFocus
                />
              </div>
              
              {/* نتائج البحث */}
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      className="w-full p-3 rounded-xl border border-border bg-card hover:bg-accent transition-colors flex items-center gap-3 text-right"
                      onClick={() => setSelectedLocation(result)}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                      </div>
                    </button>
                  ))
                ) : searchQuery.length > 1 ? (
                  <p className="text-center text-muted-foreground py-8">لا توجد نتائج</p>
                ) : null}
              </div>
            </div>
          )}

          {/* تأكيد الاختيار */}
          {selectedLocation && calculatedFare && (
            <div className="space-y-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setSelectedLocation(null);
                  setCalculatedFare(null);
                }}
              >
                ← رجوع
              </Button>
              
              <div className="p-4 bg-card rounded-xl border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      {changeType === 'stop' ? 'محطة التوقف' : 'الوجهة الجديدة'}
                    </p>
                    <p className="font-medium">{selectedLocation.name}</p>
                  </div>
                </div>
                
                {changeType === 'stop' && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      {calculatedFare.type === 'on_route' 
                        ? 'المحطة على المسار - رسوم انتظار فقط'
                        : 'المحطة ليست على المسار - رسوم مسافة إضافية'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* ملخص السعر */}
              <div className="p-4 bg-primary/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">الأجرة الحالية</span>
                  <span className="font-medium">{currentFare.toLocaleString('en-US')} د.ع</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {calculatedFare.addedFare >= 0 ? 'السعر الإضافي' : 'الخصم'}
                  </span>
                  <span className={`font-medium ${calculatedFare.addedFare >= 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {calculatedFare.addedFare >= 0 ? '+' : ''}{calculatedFare.addedFare.toLocaleString('en-US')} د.ع
                  </span>
                </div>
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <span className="font-semibold">السعر الكلي الجديد</span>
                  <span className="text-xl font-bold text-primary">{calculatedFare.totalFare.toLocaleString('en-US')} د.ع</span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                  disabled={isUpdating}
                >
                  إلغاء
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirm}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  ) : null}
                  {changeType === 'stop' ? 'إضافة المحطة' : 'تحديث الوجهة'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ChangeDestinationSheet;
