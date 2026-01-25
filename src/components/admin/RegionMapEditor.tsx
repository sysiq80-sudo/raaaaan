import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
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
  const map = useRef<mapboxgl.Map | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const isDrawingRef = useRef(false);
  
  // Ramadi center
  const ramadiCenter: [number, number] = [43.2954, 33.4262];

  // Keep ref in sync with state
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);

  // Fetch token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(
          `https://wgolkcztdrwdphwjvqxt.supabase.co/functions/v1/mapbox-proxy?action=token`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch token');
        }
        
        const data = await response.json();
        if (data.token) {
          setMapToken(data.token);
          setMapError(null);
        } else {
          throw new Error('No token in response');
        }
      } catch (error) {
        console.error('Error fetching token:', error);
        setMapError('فشل في تحميل الخريطة. تأكد من إعداد MAPBOX_PUBLIC_TOKEN');
        setIsLoading(false);
      }
    };
    fetchToken();
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    try {
      mapboxgl.accessToken = mapToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: ramadiCenter,
        zoom: 10,
        attributionControl: false
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');
      map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

      map.current.on('load', () => {
        setIsLoading(false);
        
        // Add source for all regions
        map.current?.addSource('regions', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        // Fill layer
        map.current?.addLayer({
          id: 'regions-fill',
          type: 'fill',
          source: 'regions',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': ['case', ['get', 'selected'], 0.5, 0.25]
          }
        });

        // Outline layer
        map.current?.addLayer({
          id: 'regions-outline',
          type: 'line',
          source: 'regions',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'selected'], 4, 2],
            'line-opacity': 1
          }
        });

        // Labels layer
        map.current?.addLayer({
          id: 'regions-labels',
          type: 'symbol',
          source: 'regions',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 14,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 2
          }
        });

        // Drawing source
        map.current?.addSource('drawing', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });

        map.current?.addLayer({
          id: 'drawing-fill',
          type: 'fill',
          source: 'drawing',
          paint: {
            'fill-color': '#00d9a5',
            'fill-opacity': 0.4
          }
        });

        map.current?.addLayer({
          id: 'drawing-line',
          type: 'line',
          source: 'drawing',
          paint: {
            'line-color': '#00d9a5',
            'line-width': 3,
            'line-dasharray': [2, 2]
          }
        });

        // Update regions immediately after load
        updateRegionsOnMap();
      });

      // Click handler for drawing - use ref to check current drawing state
      map.current.on('click', (e) => {
        if (!isDrawingRef.current) {
          // Check if clicked on a region
          const features = map.current?.queryRenderedFeatures(e.point, { layers: ['regions-fill'] });
          if (features && features.length > 0) {
            onSelectRegion(features[0].properties?.id || null);
          }
          return;
        }

        const newPoint = { lat: e.lngLat.lat, lng: e.lngLat.lng };
        setDrawingPoints(prev => [...prev, newPoint]);
      });

      // Change cursor in drawing mode
      map.current.on('mousemove', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = isDrawingRef.current ? 'crosshair' : 'pointer';
        }
      });

    } catch (error) {
      console.error('Map initialization error:', error);
      setMapError('فشل في تهيئة الخريطة');
      setIsLoading(false);
    }

    return () => {
      map.current?.remove();
    };
  }, [mapToken, onSelectRegion]);

  // Function to update regions on map with priority-based colors
  const updateRegionsOnMap = useCallback(() => {
    if (!map.current?.isStyleLoaded()) return;

    // Sort regions by priority (lower priority renders first, so higher priority appears on top)
    const sortedRegions = [...regions]
      .filter(r => r.coordinates && r.coordinates.length >= 3)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));

    const features = sortedRegions.map((region) => ({
      type: 'Feature' as const,
      properties: {
        id: region.id,
        name: region.name_ar,
        priority: region.priority || 0,
        color: getPriorityColor(region.priority || 0),
        selected: region.id === selectedRegionId
      },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[
          ...region.coordinates!.map(c => [c.lng, c.lat]),
          [region.coordinates![0].lng, region.coordinates![0].lat]
        ]]
      }
    }));

    const source = map.current?.getSource('regions') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features });
    }
  }, [regions, selectedRegionId]);

  // Update regions on map when data changes
  useEffect(() => {
    updateRegionsOnMap();

    // Fit to selected region
    if (selectedRegionId && map.current) {
      const region = regions.find(r => r.id === selectedRegionId);
      if (region?.coordinates && region.coordinates.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        region.coordinates.forEach(c => bounds.extend([c.lng, c.lat]));
        map.current.fitBounds(bounds, { padding: 100, duration: 1000 });
      }
    }
  }, [regions, selectedRegionId, updateRegionsOnMap]);

  // Update drawing preview
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const source = map.current?.getSource('drawing') as mapboxgl.GeoJSONSource;
    if (!source) return;

    if (drawingPoints.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Add markers for each point
    drawingPoints.forEach((point, index) => {
      const el = document.createElement('div');
      el.className = 'flex items-center justify-center w-6 h-6 bg-primary rounded-full border-2 border-white shadow-lg cursor-move';
      el.style.background = '#00d9a5';
      el.innerHTML = `<span class="text-xs font-bold text-white">${index + 1}</span>`;
      
      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat([point.lng, point.lat])
        .addTo(map.current!);
      
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setDrawingPoints(prev => {
          const newPoints = [...prev];
          newPoints[index] = { lat: lngLat.lat, lng: lngLat.lng };
          return newPoints;
        });
      });

      markersRef.current.push(marker);
    });

    // Update polygon preview
    if (drawingPoints.length >= 3) {
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[
              ...drawingPoints.map(p => [p.lng, p.lat]),
              [drawingPoints[0].lng, drawingPoints[0].lat]
            ]]
          }
        }]
      });
    } else if (drawingPoints.length >= 2) {
      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: drawingPoints.map(p => [p.lng, p.lat])
          }
        }]
      });
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
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
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    
    // Clear drawing source
    const source = map.current?.getSource('drawing') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
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
