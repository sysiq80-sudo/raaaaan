/**
 * ران - Types المشتركة (React Native)
 */

export interface Location {
  lat: number;
  lng: number;
}

export type VehicleType = 'economy' | 'comfort' | 'premium' | 'women_only';
export type RideStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
export type DriverStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type PaymentMethod = 'cash' | 'wallet' | 'card';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: 'rider' | 'driver' | 'admin';
}

export interface Driver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_type: VehicleType;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  vehicle_color: string | null;
  status: DriverStatus;
  is_online: boolean;
  is_available: boolean;
  current_lat: number | null;
  current_lng: number | null;
  rating: number;
  total_rides: number;
}

export interface Ride {
  id: string;
  rider_id: string;
  driver_id: string | null;
  status: RideStatus;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string | null;
  vehicle_type: VehicleType;
  payment_method: PaymentMethod;
  estimated_fare: number | null;
  final_fare: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface RideRequest {
  id: string;
  ride_id: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  estimated_fare: number | null;
  distance_km: number | null;
  received_at: string;
}
