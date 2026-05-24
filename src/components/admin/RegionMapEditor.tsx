import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGoogleMapsApiKey } from '@/hooks/useGoogleMapsApiKey';
import { loadGoogleMaps } from '@/lib/googleMapsLoader';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Save, Plus, Pencil, MousePointer, AlertTriangle, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Region {
  id: string;
  name_ar: string;
  name_en: string | null;
  coordinates: Array<{ lat: number; lng: number }> | null;
  is_active: boolean;
  priority?: number;
}

interface RegionMapEditorProps {
  regions: Region[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string | null) => void;
  onSaveCoordinates: (regionId: string, coordinates: Array<{ lat: number; lng: number }>) => void;
  onDeleteCoordinates: (regionId: string) => void;
}

// Priority-based color scheme - higher priority = warmer/brighter colors
const getPriorityColor = (priority: number): string => {
  if (priority >= 15) return '#ef4444'; // Red - highest (neighborhoods)
  if (priority >= 10) return '#f59e0b'; // Amber - high (cities)
  if (priority >= 5) return '#3b82f6';  // Blue - medium (districts)
  if (priority >= 1) return '#22c55e';  // Green - low (countries/provinces)
  return '#6b7280'; // Gray - undefined
};

const getPriorityLabel = (priority: number): string => {
  if (priority >= 15) return 'حي';
  if (priority >= 10) return 'مدينة';
  if (priority >= 5) return 'منطقة';
  if (priority >= 1) return 'محافظة';
  return 'غير محدد';
};

const PRIORITY_LEGEND = [
  { min: 15, label: 'أحياء', color: '#ef4444' },
  { min: 10, label: 'مدن', color: '#f59e0b' },
  { min: 5, label: 'مناطق', color: '#3b82f6' },
  { min: 1, label: 'محافظات', color: '#22c55e' },
  { min: 0, label: 'غير محدد', color: '#6b7280' },
];

const RegionMapEditor: React.FC<RegionMapEditorProps> = ({
  regions,
  selectedRegionId,
  onSelectRegion,
  onSaveCoordinates,
  onDeleteCoordinates
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ lat: number; lng: number }>>([]);

  // Google Maps objects refs
  const polygonRefs = useRef<Map<string, { polygon: google.maps.Polygon; label: google.maps.Marker }>>(new Map());
  const drawMarkersRef = useRef<google.maps.Marker[]>([]);
  const previewPolygonRef = useRef<google.maps.Polygon | null>(null);
  const previewPolylineRef = useRef<google.maps.Polyline | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);
  const isDrawingRef = useRef(false);

  const { apiKey, isLoading: isApiKeyLoading } = useGoogleMapsApiKey();

  // Ramadi center
  const ramadiCenter = { lat: 33.4262, lng: 43.2954 };

  // Keep ref in sync with state
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  // Initialize Google Maps
  useEffect(() => {
    if (!mapContainer.current || isApiKeyLoading) return;
    if (!apiKey) {
      setMapError('مفتاح Google Maps غير متاح. تأكد من إعداد VITE_GOOGLE_MAPS_API_KEY');
      setIsLoading(false);
      return;
    }

    loadGoogleMaps(apiKey).then(() => {
      if (!mapContainer.current) return;
      map.current = new google.maps.Map(mapContainer.current, {
        center: ramadiCenter,
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        attributionControl: false,
      } as google.maps.MapOptions);

      setIsLoading(false);

      // Click handler for drawing and selection
      clickListenerRef.current = map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!isDrawingRef.current) return;
        const lat = e.latLng?.lat();
        const lng = e.latLng?.lng();
        if (lat !== undefined && lng !== undefined) {
          setDrawingPoints(prev => [...prev, { lat, lng }]);
        }
      });

      // Change cursor based on drawing mode
      map.current.addListener('mousemove', () => {
        if (map.current) {
          (map.current as any).setOptions({ draggableCursor: isDrawingRef.current ? 'crosshair' : '' });
        }
      });
    }).catch(err => {
      console.error('Google Maps load error:', err);
      setMapError('فشل في تحميل Google Maps');
      setIsLoading(false);
    });

    return () => {
      if (clickListenerRef.current) google.maps.event.removeListener(clickListenerRef.current);
      polygonRefs.current.forEach(({ polygon, label }) => {
        polygon.setMap(null); label.setMap(null);
      });
      polygonRefs.current.clear();
      drawMarkersRef.current.forEach(m => m.setMap(null));
      drawMarkersRef.current = [];
      if (previewPolygonRef.current) previewPolygonRef.current.setMap(null);
      if (previewPolylineRef.current) previewPolylineRef.current.setMap(null);
      map.current = null;
    };
  }, [apiKey, isApiKeyLoading]);

  // Update regions on map with Google Maps Polygons
  const updateRegionsOnMap = useCallback(() => {
    if (!map.current) return;

    // Clear old polygons and labels
    polygonRefs.current.forEach(({ polygon, label }) => {
      polygon.setMap(null);
      label.setMap(null);
    });
    polygonRefs.current.clear();

    // Sort by priority (lower first so higher priority renders on top)
    const sortedRegions = [...regions]
      .filter(r => r.coordinates && r.coordinates.length >= 3)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));

    sortedRegions.forEach(region => {
      const path = region.coordinates!.map(c => ({ lat: c.lat, lng: c.lng }));
      const color = getPriorityColor(region.priority || 0);
      const isSelected = region.id === selectedRegionId;

      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: color,
        strokeWeight: isSelected ? 4 : 2,
        strokeOpacity: 1,
        fillColor: color,
        fillOpacity: isSelected ? 0.5 : 0.25,
        map: map.current!,
        zIndex: region.priority || 0,
      });

      polygon.addListener('click', () => {
        if (!isDrawingRef.current) onSelectRegion(region.id);
      });

      // Label at centroid
      const centLat = region.coordinates!.reduce((s, c) => s + c.lat, 0) / region.coordinates!.length;
      const centLng = region.coordinates!.reduce((s, c) => s + c.lng, 0) / region.coordinates!.length;
      const label = new google.maps.Marker({
        position: { lat: centLat, lng: centLng },
        map: map.current!,
        clickable: false,
        label: { text: region.name_ar, color: '#ffffff', fontWeight: 'bold', fontSize: '12px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
      });

      polygonRefs.current.set(region.id, { polygon, label });
    });
  }, [regions, selectedRegionId, onSelectRegion]);

  // Update regions on map when data changes
  useEffect(() => {
    if (!map.current) return;
    updateRegionsOnMap();

    // Fit to selected region
    if (selectedRegionId) {
      const region = regions.find(r => r.id === selectedRegionId);
      if (region?.coordinates && region.coordinates.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        region.coordinates.forEach(c => bounds.extend({ lat: c.lat, lng: c.lng }));
        map.current.fitBounds(bounds, 100);
      }
    }
  }, [regions, selectedRegionId, updateRegionsOnMap]);

  // Update drawing preview when drawingPoints changes
  useEffect(() => {
    if (!map.current) return;

    // Clear old drawing markers
    drawMarkersRef.current.forEach(m => m.setMap(null));
    drawMarkersRef.current = [];
    if (previewPolygonRef.current) { previewPolygonRef.current.setMap(null); previewPolygonRef.current = null; }
    if (previewPolylineRef.current) { previewPolylineRef.current.setMap(null); previewPolylineRef.current = null; }

    if (drawingPoints.length === 0) return;

    // Add draggable point markers
    drawingPoints.forEach((point, index) => {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map: map.current!,
        draggable: true,
        zIndex: 100,
        label: { text: String(index + 1), color: '#ffffff', fontWeight: 'bold', fontSize: '11px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#00d9a5',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });

      marker.addListener('dragend', () => {
        const pos = marker.getPosition();
        if (pos) {
          setDrawingPoints(prev => {
            const next = [...prev];
            next[index] = { lat: pos.lat(), lng: pos.lng() };
            return next;
          });
        }
      });

      drawMarkersRef.current.push(marker);
    });

    // Show polygon preview if 3+ points
    if (drawingPoints.length >= 3) {
      previewPolygonRef.current = new google.maps.Polygon({
        paths: drawingPoints.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#00d9a5',
        strokeWeight: 3,
        strokeOpacity: 1,
        fillColor: '#00d9a5',
        fillOpacity: 0.4,
        map: map.current!,
        clickable: false,
        zIndex: 50,
      });
    } else if (drawingPoints.length >= 2) {
      previewPolylineRef.current = new google.maps.Polyline({
        path: drawingPoints.map(p => ({ lat: p.lat, lng: p.lng })),
        strokeColor: '#00d9a5',
        strokeWeight: 3,
        strokeOpacity: 1,
        map: map.current!,
        clickable: false,
      });
    }
  }, [drawingPoints]);

  const startDrawing = () => {
    if (!selectedRegionId) return;
    setIsDrawing(true);
    setDrawingPoints([]);
  };

  const loadExistingCoordinates = () => {
    if (!selectedRegionId) return;
    const region = regions.find(r => r.id === selectedRegionId);
    if (region?.coordinates && region.coordinates.length > 0) {
      setDrawingPoints([...region.coordinates]);
      setIsDrawing(true);
    }
  };

  const cancelDrawing = () => {
    setIsDrawing(false);
    setDrawingPoints([]);
    drawMarkersRef.current.forEach(m => m.setMap(null));
    drawMarkersRef.current = [];
    if (previewPolygonRef.current) { previewPolygonRef.current.setMap(null); previewPolygonRef.current = null; }
    if (previewPolylineRef.current) { previewPolylineRef.current.setMap(null); previewPolylineRef.current = null; }
  };

  const saveDrawing = () => {
    if (!selectedRegionId || drawingPoints.length < 3) return;
    onSaveCoordinates(selectedRegionId, drawingPoints);
    cancelDrawing();
  };

  const handleDeleteCoordinates = () => {
    if (!selectedRegionId) return;
    if (confirm('هل تريد حذف حدود هذه المنطقة؟')) {
      onDeleteCoordinates(selectedRegionId);
      cancelDrawing();
    }
  };

  const removeLastPoint = () => {
    if (drawingPoints.length > 0) {
      setDrawingPoints(prev => prev.slice(0, -1));
    }
  };

  const selectedRegion = regions.find(r => r.id === selectedRegionId);

  // Error state
  if (mapError) {
    return (
      <div className="relative h-full rounded-xl overflow-hidden border border-border bg-card">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <h3 className="text-lg font-bold mb-2">خطأ في تحميل الخريطة</h3>
          <p className="text-muted-foreground text-sm mb-4">{mapError}</p>
          <Button onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full rounded-xl overflow-hidden border border-border">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {isLoading && (
        <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
          <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
        </div>
      )}

      {/* Drawing toolbar */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        {!isDrawing ? (
          <>
            {selectedRegionId && (
              <div className="bg-card p-3 rounded-lg shadow-lg border border-border mb-2">
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-4 h-4 rounded-sm border border-white/20" 
                    style={{ backgroundColor: getPriorityColor(selectedRegion?.priority || 0) }}
                  />
                  <p className="font-medium text-sm">{selectedRegion?.name_ar}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>الأولوية: {selectedRegion?.priority || 0}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {getPriorityLabel(selectedRegion?.priority || 0)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedRegion?.coordinates && selectedRegion.coordinates.length >= 3
                    ? `${selectedRegion.coordinates.length} نقطة محددة`
                    : 'لم يتم تحديد الحدود بعد'}
                </p>
              </div>
            )}
            {selectedRegionId && (
              <>
                <Button
                  size="sm"
                  onClick={startDrawing}
                  className="shadow-lg"
                >
                  <Plus className="w-4 h-4 ml-1" />
                  رسم حدود جديدة
                </Button>
                {selectedRegion?.coordinates && selectedRegion.coordinates.length >= 3 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadExistingCoordinates}
                    className="shadow-lg bg-card"
                  >
                    <Pencil className="w-4 h-4 ml-1" />
                    تعديل الحدود
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="bg-card p-3 rounded-lg shadow-lg text-sm border border-primary">
              <div className="flex items-center gap-2 mb-2">
                <MousePointer className="w-4 h-4 text-primary" />
                <p className="font-medium">وضع الرسم</p>
              </div>
              <p className="text-muted-foreground text-xs mb-1">
                انقر على الخريطة لإضافة نقاط
              </p>
              <p className="text-primary font-bold">
                النقاط: {drawingPoints.length}
              </p>
              {drawingPoints.length < 3 && (
                <p className="text-xs text-amber-500 mt-1">
                  أضف {3 - drawingPoints.length} نقاط على الأقل
                </p>
              )}
            </div>
            {drawingPoints.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={removeLastPoint}
                className="shadow-lg bg-card"
              >
                حذف آخر نقطة
              </Button>
            )}
            <Button
              size="sm"
              onClick={saveDrawing}
              disabled={drawingPoints.length < 3}
              className="shadow-lg"
            >
              <Save className="w-4 h-4 ml-1" />
              حفظ الحدود
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={cancelDrawing}
              className="shadow-lg bg-card"
            >
              إلغاء
            </Button>
            {selectedRegion?.coordinates && selectedRegion.coordinates.length >= 3 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeleteCoordinates}
                className="shadow-lg bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-4 h-4 ml-1" />
                حذف الحدود
              </Button>
            )}
          </>
        )}
      </div>

      {/* Priority Legend */}
      <div className="absolute bottom-3 left-3 z-20 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-4 h-4 text-primary" />
          <p className="text-xs font-medium text-muted-foreground">دليل الأولويات</p>
        </div>
        <div className="space-y-1.5">
          {PRIORITY_LEGEND.map((item) => (
            <div key={item.min} className="flex items-center gap-2">
              <div 
                className="w-4 h-3 rounded-sm border border-white/20" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs">{item.label}</span>
              <span className="text-[10px] text-muted-foreground">({item.min}+)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Regions List */}
      <div className="absolute bottom-3 right-3 z-20 bg-card/95 backdrop-blur-sm p-3 rounded-lg shadow-lg max-h-48 overflow-y-auto border border-border">
        <p className="text-xs font-medium mb-2 text-muted-foreground">المناطق ({regions.length})</p>
        <div className="space-y-1">
          {regions
            .slice()
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .map((region) => (
            <button
              key={region.id}
              onClick={() => onSelectRegion(region.id)}
              className={`flex items-center gap-2 w-full text-right px-2 py-1.5 rounded transition-colors ${
                selectedRegionId === region.id 
                  ? 'bg-primary/20 text-primary' 
                  : 'hover:bg-accent'
              }`}
            >
              <div 
                className="w-3 h-3 rounded-sm shrink-0 border border-white/20" 
                style={{ backgroundColor: getPriorityColor(region.priority || 0) }}
              />
              <span className="text-xs truncate flex-1">{region.name_ar}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                {region.priority || 0}
              </Badge>
              {region.coordinates && region.coordinates.length >= 3 ? (
                <span className="text-[10px] text-primary">✓</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">○</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Instructions overlay when no region selected */}
      {!selectedRegionId && !isDrawing && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
          <div className="text-center p-6 bg-card rounded-xl shadow-lg border border-border max-w-xs">
            <MousePointer className="w-10 h-10 text-primary mx-auto mb-3" />
            <p className="text-lg font-medium mb-2">اختر منطقة</p>
            <p className="text-sm text-muted-foreground">
              اختر منطقة من القائمة على اليمين أو انقر على منطقة محددة مسبقاً على الخريطة لبدء التعديل
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionMapEditor;
