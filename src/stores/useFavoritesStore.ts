// Store للأماكن المفضلة باستخدام Zustand
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteLocation {
  id: string;
  name: string; // "بيت" أو "عمل" أو "المقهى"
  address: string;
  lat: number;
  lng: number;
  icon?: 'home' | 'work' | 'cafe' | 'gym' | 'diwaniya' | 'carwash' | 'other';
  createdAt: number;
  color?: string; // للتخصيص المستقبلي
}

interface FavoritesStore {
  favorites: FavoriteLocation[];
  addFavorite: (location: FavoriteLocation) => void;
  removeFavorite: (id: string) => void;
  updateFavorite: (id: string, data: Partial<FavoriteLocation>) => void;
  getFavoriteById: (id: string) => FavoriteLocation | undefined;
  getFavoritesByIcon: (icon: string) => FavoriteLocation[];
  isFavorite: (lat: number, lng: number) => boolean;
}

export const useFavoritesStore = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      favorites: [],
      
      addFavorite: (location: FavoriteLocation) => {
        set((state) => ({
          favorites: [...state.favorites, location],
        }));
      },
      
      removeFavorite: (id: string) => {
        set((state) => ({
          favorites: state.favorites.filter((fav) => fav.id !== id),
        }));
      },
      
      updateFavorite: (id: string, data: Partial<FavoriteLocation>) => {
        set((state) => ({
          favorites: state.favorites.map((fav) =>
            fav.id === id ? { ...fav, ...data } : fav
          ),
        }));
      },
      
      getFavoriteById: (id: string) => {
        return get().favorites.find((fav) => fav.id === id);
      },
      
      getFavoritesByIcon: (icon: string) => {
        return get().favorites.filter((fav) => fav.icon === icon);
      },
      
      isFavorite: (lat: number, lng: number) => {
        return get().favorites.some(
          (fav) => Math.abs(fav.lat - lat) < 0.001 && Math.abs(fav.lng - lng) < 0.001
        );
      },
    }),
    {
      name: 'favorites-storage', // اسم key في localStorage
      partialize: (state) => ({ favorites: state.favorites }),
    }
  )
);
