import React, { useEffect, useRef, useMemo } from 'react';
import { useFavoritesStore } from '@/stores/useFavoritesStore';

interface FavoriteMarkersLayerProps {
  map: google.maps.Map | null;
  onMarkerClick?: (id: string, lat: number, lng: number, address: string) => void;
}

interface MarkerWithWindow extends google.maps.Marker {
  infoWindow?: google.maps.InfoWindow;
}

export default function FavoriteMarkersLayer({
  map,
  onMarkerClick,
}: FavoriteMarkersLayerProps) {
  const markers = useRef<Map<string, MarkerWithWindow>>(new Map());
  const { favorites } = useFavoritesStore();

  // الأيقونات المخصصة (تحويل SVG إلى Data URL)
  const getMarkerSVG = (icon: string) => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <path d="M12 2C7.03 2 3 6.03 3 11c0 5.25 9 13 9 13s9-7.75 9-13c0-4.97-4.03-9-9-9z"/>
      <circle cx="12" cy="11" r="3" fill="white"/>
      ${icon === 'home' ? '<path d="M12 13v3" stroke="white" fill="none"/>' : ''}
      ${icon === 'work' ? '<rect x="10" y="13" width="4" height="3" fill="white"/>' : ''}
    </svg>`;

    const encodedSVG = btoa(svgContent);
    return `data:image/svg+xml;base64,${encodedSVG}`;
  };

  // نفس الرموز التعبيرية المستخدمة في SaveLocationModal
  const getEmojiForIcon = (icon?: string) => {
    const emojiMap: Record<string, string> = {
      home: '🏠',
      work: '💼',
      cafe: '☕',
      gym: '💪',
      diwaniya: '🏛️',
      carwash: '🚗',
      other: '📍',
    };
    return emojiMap[icon || 'other'] || '📍';
  };

  // مفتاح مميز لكل Marker
  const markerKey = useMemo(
    () => favorites.map((fav) => `${fav.lat}-${fav.lng}-${fav.id}`).join(','),
    [favorites]
  );

  useEffect(() => {
    if (!map || !window.google) return;

    // حذف الـ Markers القديمة التي لم تعد موجودة
    const currentKeys = new Set(
      favorites.map((fav) => `${fav.lat}-${fav.lng}`)
    );
    
    markers.current.forEach((marker, key) => {
      if (!currentKeys.has(key)) {
        marker.setMap(null);
        markers.current.delete(key);
      }
    });

    // إضافة Markers الجديدة
    favorites.forEach((favorite) => {
      const markerKey = `${favorite.lat}-${favorite.lng}`;
      
      // تحقق من وجود Marker مسبقاً
      if (markers.current.has(markerKey)) {
        return; // تخطي إذا كان موجوداً
      }

      // Create custom marker with HTML
      const infoWindowContent = `
        <div style="background: white; padding: 8px 12px; border-radius: 8px; max-width: 200px; text-align: center; font-family: Cairo, sans-serif; direction: rtl;">
          <div style="font-size: 24px; margin-bottom: 4px;">${getEmojiForIcon(favorite.icon)}</div>
          <div style="font-weight: bold; color: #1f2937; font-size: 14px; margin-bottom: 2px;">${favorite.name}</div>
          <div style="color: #6b7280; font-size: 12px;">${favorite.address}</div>
        </div>
      `;

      const marker = new google.maps.Marker({
        position: { lat: favorite.lat, lng: favorite.lng },
        map,
        title: favorite.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#22c55e', // green-600
          fillOpacity: 0.9,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        zIndex: 10,
      });

      // Add text label with emoji
      const label = document.createElement('div');
      label.style.position = 'absolute';
      label.style.fontSize = '16px';
      label.style.pointerEvents = 'none';
      label.style.textAlign = 'center';
      label.style.lineHeight = '20px';
      label.textContent = getEmojiForIcon(favorite.icon);

      // استخدم OverlayView لوضع النص على الـ marker
      class EmojiOverlay extends google.maps.OverlayView {
        private div?: HTMLElement;
        
        onAdd() {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.fontSize = '16px';
          div.style.pointerEvents = 'none';
          div.style.textAlign = 'center';
          div.style.lineHeight = '20px';
          div.style.zIndex = '11';
          div.textContent = getEmojiForIcon(favorite.icon);
          
          this.div = div;
          const panes = this.getPanes();
          if (panes) {
            panes.overlayLayer.appendChild(div);
          }
        }

        draw() {
          if (!this.div) return;
          
          const projection = this.getProjection();
          if (!projection) return;
          
          const position = projection.fromLatLngToDivPixel(
            new google.maps.LatLng(favorite.lat, favorite.lng)
          );
          
          if (position) {
            this.div.style.left = (position.x - 8) + 'px';
            this.div.style.top = (position.y - 12) + 'px';
          }
        }

        onRemove() {
          if (this.div && this.div.parentNode) {
            this.div.parentNode.removeChild(this.div);
          }
        }
      }

      const overlay = new EmojiOverlay();
      overlay.setMap(map);

      // InfoWindow
      const infoWindow = new google.maps.InfoWindow({
        content: infoWindowContent,
        maxWidth: 250,
      });

      marker.addListener('click', () => {
        // أغلق جميع InfoWindows الأخرى
        markers.current.forEach((m: MarkerWithWindow, key: string) => {
          if (key !== markerKey && m.infoWindow) {
            m.infoWindow.close();
          }
        });

        infoWindow.open(map, marker);
        
        // تنفيذ callback عند الضغط على الـ marker
        if (onMarkerClick) {
          onMarkerClick(favorite.id, favorite.lat, favorite.lng, favorite.address);
        }
      });

      (marker as MarkerWithWindow).infoWindow = infoWindow;

      markers.current.set(markerKey, marker);
    });
  }, [map, markerKey, favorites, onMarkerClick]);

  // تنظيف عند الـ unmount
  useEffect(() => {
    const currentMarkers = new Map(markers.current);
    
    return () => {
      currentMarkers.forEach((marker: MarkerWithWindow) => {
        marker.setMap(null);
      });
      currentMarkers.clear();
    };
  }, []);

  return null; // هذا المكون لا يعرض HTML، فقط يدير الـ markers
}
