/**
 * ران - الأماكن المحفوظة
 */

import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/hooks/useAuth';
import { supabase } from '../../src/lib/supabase';
import { useRiderStore } from '../../src/stores/riderStore';

interface SavedPlace {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  place_type: string | null;
}

const PLACE_ICONS: Record<string, string> = {
  home: '🏠',
  work: '💼',
  favorite: '⭐',
};

export default function SavedPlaces() {
  const { user } = useAuth();
  const store = useRiderStore();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlaces = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('saved_places')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setPlaces(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const handleSelectPlace = (place: SavedPlace) => {
    store.setDropoff({ lat: place.lat, lng: place.lng }, place.address || place.label);
    router.push('/(rider)/(tabs)/home');
  };

  const handleDeletePlace = (place: SavedPlace) => {
    Alert.alert('حذف', `حذف "${place.label}"؟`, [
      { text: 'لا', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_places').delete().eq('id', place.id);
          setPlaces((prev) => prev.filter((p) => p.id !== place.id));
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: SavedPlace }) => (
    <TouchableOpacity
      style={styles.placeCard}
      onPress={() => handleSelectPlace(item)}
      onLongPress={() => handleDeletePlace(item)}
    >
      <Text style={styles.placeIcon}>
        {PLACE_ICONS[item.place_type || ''] || '📍'}
      </Text>
      <View style={styles.placeInfo}>
        <Text style={styles.placeLabel}>{item.label}</Text>
        <Text style={styles.placeAddress} numberOfLines={1}>
          {item.address}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00d9a5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>الأماكن المحفوظة</Text>

      {places.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyText}>لا توجد أماكن محفوظة</Text>
          <Text style={styles.emptyHint}>
            اضغط مطولاً على أي وجهة لحفظها
          </Text>
        </View>
      ) : (
        <FlatList
          data={places}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 20,
  },
  list: {
    gap: 12,
    paddingBottom: 40,
  },
  placeCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  placeIcon: {
    fontSize: 28,
  },
  placeInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  placeLabel: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '600',
  },
  placeAddress: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 18,
  },
  emptyHint: {
    color: '#64748b',
    fontSize: 14,
  },
});
