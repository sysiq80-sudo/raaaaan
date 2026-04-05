/**
 * Web shim for react-native-maps
 * يوفر مكونات بديلة للويب بدل الخرائط الأصلية
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// MapView mock
const MapView = React.forwardRef<View, any>(
  ({ children, style, onPress, onRegionChangeComplete, ...rest }, ref) => {
    return (
      <View ref={ref} style={[styles.map, style]} {...rest}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>🗺️</Text>
          <Text style={styles.placeholderLabel}>الخريطة غير متوفرة على الويب</Text>
          <Text style={styles.placeholderSub}>استخدم التطبيق على الهاتف</Text>
        </View>
        {children}
      </View>
    );
  }
);
MapView.displayName = 'MapView';

// Marker mock
const Marker = ({ children, ...rest }: any) => {
  return <View {...rest}>{children}</View>;
};

// Callout mock
const Callout = ({ children, ...rest }: any) => {
  return <View {...rest}>{children}</View>;
};

// Polyline mock
const Polyline = (_props: any) => null;

// Circle mock
const Circle = (_props: any) => null;

// Polygon mock
const Polygon = (_props: any) => null;

// Overlay mock
const Overlay = (_props: any) => null;

// Heatmap mock
const Heatmap = (_props: any) => null;

// Constants
const PROVIDER_GOOGLE = 'google';
const PROVIDER_DEFAULT = null;

// AnimatedRegion mock
class AnimatedRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;

  constructor(region: any = {}) {
    this.latitude = region.latitude || 0;
    this.longitude = region.longitude || 0;
    this.latitudeDelta = region.latitudeDelta || 0.01;
    this.longitudeDelta = region.longitudeDelta || 0.01;
  }
  timing() { return { start: () => {} }; }
  spring() { return { start: () => {} }; }
  setValue() {}
}

const styles = StyleSheet.create({
  map: {
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderLabel: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholderSub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
});

export default MapView;
export {
  Marker,
  Callout,
  Polyline,
  Circle,
  Polygon,
  Overlay,
  Heatmap,
  AnimatedRegion,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  MapView,
};
