export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          api_type: string
          created_at: string | null
          date: string | null
          endpoint: string | null
          estimated_cost: number | null
          id: string
          metadata: Json | null
          request_count: number | null
        }
        Insert: {
          api_type: string
          created_at?: string | null
          date?: string | null
          endpoint?: string | null
          estimated_cost?: number | null
          id?: string
          metadata?: Json | null
          request_count?: number | null
        }
        Update: {
          api_type?: string
          created_at?: string | null
          date?: string | null
          endpoint?: string | null
          estimated_cost?: number | null
          id?: string
          metadata?: Json | null
          request_count?: number | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      banned_names: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          reason: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          reason?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          reason?: string | null
        }
        Relationships: []
      }
      blocked_phones: {
        Row: {
          blocked_by: string | null
          blocked_until: string | null
          created_at: string | null
          failure_count: number | null
          id: string
          is_permanent: boolean | null
          phone: string
          reason: string | null
          updated_at: string | null
        }
        Insert: {
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          is_permanent?: boolean | null
          phone: string
          reason?: string | null
          updated_at?: string | null
        }
        Update: {
          blocked_by?: string | null
          blocked_until?: string | null
          created_at?: string | null
          failure_count?: number | null
          id?: string
          is_permanent?: boolean | null
          phone?: string
          reason?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      commission_tiers: {
        Row: {
          badge_color: string | null
          badge_icon: string | null
          commission_discount: number
          created_at: string | null
          id: string
          is_active: boolean | null
          min_rating: number | null
          min_rides_monthly: number | null
          name_ar: string
          name_en: string | null
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          badge_color?: string | null
          badge_icon?: string | null
          commission_discount?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_rating?: number | null
          min_rides_monthly?: number | null
          name_ar: string
          name_en?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          badge_color?: string | null
          badge_icon?: string | null
          commission_discount?: number
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_rating?: number | null
          min_rides_monthly?: number | null
          name_ar?: string
          name_en?: string | null
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_earnings: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          date: string
          driver_id: string | null
          driver_share: number
          id: string
          ride_id: string | null
          total_fare: number
        }
        Insert: {
          commission_amount: number
          commission_rate?: number
          created_at?: string
          date?: string
          driver_id?: string | null
          driver_share: number
          id?: string
          ride_id?: string | null
          total_fare: number
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          date?: string
          driver_id?: string | null
          driver_share?: number
          id?: string
          ride_id?: string | null
          total_fare?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_earnings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_earnings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "company_earnings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      component_templates: {
        Row: {
          category: string
          component_type: string
          created_at: string
          default_props: Json
          default_styles: Json
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          name_ar: string
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          component_type: string
          created_at?: string
          default_props?: Json
          default_styles?: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          name_ar: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          component_type?: string
          created_at?: string
          default_props?: Json
          default_styles?: Json
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_ar?: string
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_edit_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          current_value: string | null
          driver_id: string
          field_name: string
          id: string
          reason: string | null
          requested_value: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          current_value?: string | null
          driver_id: string
          field_name: string
          id?: string
          reason?: string | null
          requested_value: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          current_value?: string | null
          driver_id?: string
          field_name?: string
          id?: string
          reason?: string | null
          requested_value?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_edit_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_edit_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_edit_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_incentive_claims: {
        Row: {
          bonus_earned: number
          claimed_at: string | null
          driver_id: string
          id: string
          incentive_id: string
          period_end: string
          period_start: string
          rides_completed: number
        }
        Insert: {
          bonus_earned: number
          claimed_at?: string | null
          driver_id: string
          id?: string
          incentive_id: string
          period_end: string
          period_start: string
          rides_completed: number
        }
        Update: {
          bonus_earned?: number
          claimed_at?: string | null
          driver_id?: string
          id?: string
          incentive_id?: string
          period_end?: string
          period_start?: string
          rides_completed?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_incentive_claims_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incentive_claims_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incentive_claims_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_incentive_claims_incentive_id_fkey"
            columns: ["incentive_id"]
            isOneToOne: false
            referencedRelation: "driver_incentives"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_incentives: {
        Row: {
          bonus_amount: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          period: string
          rides_required: number
          updated_at: string | null
        }
        Insert: {
          bonus_amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          period?: string
          rides_required: number
          updated_at?: string | null
        }
        Update: {
          bonus_amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          period?: string
          rides_required?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      driver_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          driver_id: string
          id: string
          is_read: boolean | null
          title: string
          type: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          driver_id: string
          id?: string
          is_read?: boolean | null
          title: string
          type?: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          driver_id?: string
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_registration_settings: {
        Row: {
          countdown_text: string
          created_at: string
          days_text: string
          enable_promo: boolean
          id: string
          paid_activation_fee: number
          paid_button_text: string
          paid_challenge_bonus: number
          paid_challenge_rides: number
          paid_challenge_text: string
          paid_subtitle: string
          paid_summary_text: string
          paid_title: string
          paid_wallet_bonus: number
          paid_wallet_bonus_text: string
          paid_warning_text: string
          promo_activation_fee: number
          promo_activation_fee_text: string
          promo_bonus_amount: number
          promo_bonus_text: string
          promo_button_text: string
          promo_end_date: string
          promo_subtitle: string
          promo_title: string
          promo_urgency_text: string
          terms_text: string
          updated_at: string
        }
        Insert: {
          countdown_text?: string
          created_at?: string
          days_text?: string
          enable_promo?: boolean
          id?: string
          paid_activation_fee?: number
          paid_button_text?: string
          paid_challenge_bonus?: number
          paid_challenge_rides?: number
          paid_challenge_text?: string
          paid_subtitle?: string
          paid_summary_text?: string
          paid_title?: string
          paid_wallet_bonus?: number
          paid_wallet_bonus_text?: string
          paid_warning_text?: string
          promo_activation_fee?: number
          promo_activation_fee_text?: string
          promo_bonus_amount?: number
          promo_bonus_text?: string
          promo_button_text?: string
          promo_end_date?: string
          promo_subtitle?: string
          promo_title?: string
          promo_urgency_text?: string
          terms_text?: string
          updated_at?: string
        }
        Update: {
          countdown_text?: string
          created_at?: string
          days_text?: string
          enable_promo?: boolean
          id?: string
          paid_activation_fee?: number
          paid_button_text?: string
          paid_challenge_bonus?: number
          paid_challenge_rides?: number
          paid_challenge_text?: string
          paid_subtitle?: string
          paid_summary_text?: string
          paid_title?: string
          paid_wallet_bonus?: number
          paid_wallet_bonus_text?: string
          paid_warning_text?: string
          promo_activation_fee?: number
          promo_activation_fee_text?: string
          promo_bonus_amount?: number
          promo_bonus_text?: string
          promo_button_text?: string
          promo_end_date?: string
          promo_subtitle?: string
          promo_title?: string
          promo_urgency_text?: string
          terms_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      driver_subscriptions: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          driver_id: string
          expires_at: string
          id: string
          payment_method: string | null
          plan_id: string
          starts_at: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          driver_id: string
          expires_at: string
          id?: string
          payment_method?: string | null
          plan_id: string
          starts_at?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          driver_id?: string
          expires_at?: string
          id?: string
          payment_method?: string | null
          plan_id?: string
          starts_at?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          driver_id: string
          id: string
          ride_id: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          ride_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          ride_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          admin_activated: boolean | null
          admin_controlled: boolean | null
          commission_balance: number | null
          created_at: string
          current_location: Json | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          id_image_back_url: string | null
          id_image_url: string | null
          is_available: boolean | null
          is_online: boolean | null
          license_image_back_url: string | null
          license_image_url: string | null
          license_number: string | null
          max_pickup_radius: number | null
          phone: string
          profile_image_url: string | null
          rating: number | null
          status: Database["public"]["Enums"]["driver_status"] | null
          total_earnings: number | null
          total_rides: number | null
          updated_at: string
          user_id: string
          vehicle_color: string | null
          vehicle_image_url: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance: number | null
          working_region_id: string | null
        }
        Insert: {
          admin_activated?: boolean | null
          admin_controlled?: boolean | null
          commission_balance?: number | null
          created_at?: string
          current_location?: Json | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          id_image_back_url?: string | null
          id_image_url?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          license_image_back_url?: string | null
          license_image_url?: string | null
          license_number?: string | null
          max_pickup_radius?: number | null
          phone: string
          profile_image_url?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          total_earnings?: number | null
          total_rides?: number | null
          updated_at?: string
          user_id: string
          vehicle_color?: string | null
          vehicle_image_url?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance?: number | null
          working_region_id?: string | null
        }
        Update: {
          admin_activated?: boolean | null
          admin_controlled?: boolean | null
          commission_balance?: number | null
          created_at?: string
          current_location?: Json | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          id_image_back_url?: string | null
          id_image_url?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          license_image_back_url?: string | null
          license_image_url?: string | null
          license_number?: string | null
          max_pickup_radius?: number | null
          phone?: string
          profile_image_url?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          total_earnings?: number | null
          total_rides?: number | null
          updated_at?: string
          user_id?: string
          vehicle_color?: string | null
          vehicle_image_url?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          wallet_balance?: number | null
          working_region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_working_region_id_fkey"
            columns: ["working_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_alerts: {
        Row: {
          created_at: string | null
          id: string
          location: Json
          resolved_at: string | null
          ride_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location: Json
          resolved_at?: string | null
          ride_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: Json
          resolved_at?: string | null
          ride_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "emergency_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          phone: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          user_id?: string
        }
        Relationships: []
      }
      fake_drivers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          location: Json
          name: string
          rating: number | null
          updated_at: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location: Json
          name?: string
          rating?: number | null
          updated_at?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: Json
          name?: string
          rating?: number | null
          updated_at?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
        }
        Relationships: []
      }
      governorates: {
        Row: {
          area_km2: number | null
          capital_city: string | null
          code: string
          coordinates: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string
          name_ku: string | null
          population: number | null
          updated_at: string
        }
        Insert: {
          area_km2?: number | null
          capital_city?: string | null
          code: string
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en: string
          name_ku?: string | null
          population?: number | null
          updated_at?: string
        }
        Update: {
          area_km2?: number | null
          capital_city?: string | null
          code?: string
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          name_ku?: string | null
          population?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ip_rate_limits: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          ip_address: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          ip_address: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          ip_address?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      landmarks: {
        Row: {
          category: string | null
          created_at: string
          governorate_id: string | null
          id: string
          is_active: boolean | null
          location: Json
          name_ar: string
          name_en: string | null
          region_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          governorate_id?: string | null
          id?: string
          is_active?: boolean | null
          location: Json
          name_ar: string
          name_en?: string | null
          region_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          governorate_id?: string | null
          id?: string
          is_active?: boolean | null
          location?: Json
          name_ar?: string
          name_en?: string | null
          region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landmarks_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landmarks_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_analytics: {
        Row: {
          avg_delivery_delay_ms: number | null
          created_at: string | null
          date: string
          id: string
          notification_type: string
          total_delivered: number | null
          total_failed: number | null
          total_opened: number | null
          total_sent: number | null
          updated_at: string | null
        }
        Insert: {
          avg_delivery_delay_ms?: number | null
          created_at?: string | null
          date: string
          id?: string
          notification_type: string
          total_delivered?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_delivery_delay_ms?: number | null
          created_at?: string | null
          date?: string
          id?: string
          notification_type?: string
          total_delivered?: number | null
          total_failed?: number | null
          total_opened?: number | null
          total_sent?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_topics: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string
          is_active: boolean | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_active?: boolean | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          is_active?: boolean | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_topics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_topics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_topics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          delivered_at: string | null
          delivery_delay_ms: number | null
          driver_id: string | null
          error_message: string | null
          id: string
          notification_id: string | null
          notification_type: string
          opened_at: string | null
          retry_count: number | null
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          delivery_delay_ms?: number | null
          driver_id?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          notification_type: string
          opened_at?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          delivery_delay_ms?: number | null
          driver_id?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          notification_type?: string
          opened_at?: string | null
          retry_count?: number | null
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_verifications: {
        Row: {
          attempts: number | null
          code: string
          code_hash: string | null
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          phone: string
          purpose: string
          used_at: string | null
          user_agent: string | null
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          code_hash?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          phone: string
          purpose: string
          used_at?: string | null
          user_agent?: string | null
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          code_hash?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          phone?: string
          purpose?: string
          used_at?: string | null
          user_agent?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          account_holder: string | null
          account_name: string
          account_number: string
          api_config: Json | null
          api_enabled: boolean | null
          api_provider: string | null
          created_at: string | null
          display_order: number | null
          id: string
          instructions: string | null
          is_active: boolean | null
          payment_method: string
          updated_at: string | null
        }
        Insert: {
          account_holder?: string | null
          account_name: string
          account_number: string
          api_config?: Json | null
          api_enabled?: boolean | null
          api_provider?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          payment_method: string
          updated_at?: string | null
        }
        Update: {
          account_holder?: string | null
          account_name?: string
          account_number?: string
          api_config?: Json | null
          api_enabled?: boolean | null
          api_provider?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          payment_method?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_integrations: {
        Row: {
          api_base_url: string | null
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          provider_code: string
          provider_name: string
          supported_currencies: string[] | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_base_url?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_code: string
          provider_name: string
          supported_currencies?: string[] | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_base_url?: string | null
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          provider_code?: string
          provider_name?: string
          supported_currencies?: string[] | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_location: Json | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          status: string | null
          updated_at: string
          user_id: string
          wallet_balance: number | null
          wallet_enabled: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_location?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          wallet_balance?: number | null
          wallet_enabled?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_location?: Json | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          wallet_balance?: number | null
          wallet_enabled?: boolean | null
        }
        Relationships: []
      }
      promo_banners: {
        Row: {
          button_text: string | null
          created_at: string | null
          discount_label: string | null
          discount_value: string | null
          display_order: number | null
          gradient_from: string | null
          gradient_to: string | null
          gradient_via: string | null
          icon_type: string | null
          id: string
          is_active: boolean | null
          link_url: string | null
          region_id: string | null
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          button_text?: string | null
          created_at?: string | null
          discount_label?: string | null
          discount_value?: string | null
          display_order?: number | null
          gradient_from?: string | null
          gradient_to?: string | null
          gradient_via?: string | null
          icon_type?: string | null
          id?: string
          is_active?: boolean | null
          link_url?: string | null
          region_id?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          button_text?: string | null
          created_at?: string | null
          discount_label?: string | null
          discount_value?: string | null
          display_order?: number | null
          gradient_from?: string | null
          gradient_to?: string | null
          gradient_via?: string | null
          icon_type?: string | null
          id?: string
          is_active?: boolean | null
          link_url?: string | null
          region_id?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_banners_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          driver_id: string | null
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          driver_id?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          driver_id?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_type: string | null
          id: string
          is_active: boolean | null
          last_used_at: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          max_uses: number | null
          reward_amount: number | null
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          reward_amount?: number | null
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          reward_amount?: number | null
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referred_paid: boolean | null
          referred_reward: number | null
          referrer_id: string | null
          referrer_paid: boolean | null
          referrer_reward: number | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referred_paid?: boolean | null
          referred_reward?: number | null
          referrer_id?: string | null
          referrer_paid?: boolean | null
          referrer_reward?: number | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referred_paid?: boolean | null
          referred_reward?: number | null
          referrer_id?: string | null
          referrer_paid?: boolean | null
          referrer_reward?: number | null
          status?: string | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          base_fare: number
          coordinates: Json | null
          created_at: string
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          name_ku: string | null
          per_km_fare: number
          priority: number | null
          updated_at: string
          wait_timeout_minutes: number | null
          waiting_fare_per_min: number
          weekend_wait_timeout_minutes: number | null
        }
        Insert: {
          base_fare?: number
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          name_ku?: string | null
          per_km_fare?: number
          priority?: number | null
          updated_at?: string
          wait_timeout_minutes?: number | null
          waiting_fare_per_min?: number
          weekend_wait_timeout_minutes?: number | null
        }
        Update: {
          base_fare?: number
          coordinates?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          name_ku?: string | null
          per_km_fare?: number
          priority?: number | null
          updated_at?: string
          wait_timeout_minutes?: number | null
          waiting_fare_per_min?: number
          weekend_wait_timeout_minutes?: number | null
        }
        Relationships: []
      }
      review_tags: {
        Row: {
          applies_to: string
          created_at: string
          icon: string | null
          id: string
          is_active: boolean | null
          tag_ar: string
          tag_en: string | null
          tag_type: string
          usage_count: number | null
        }
        Insert: {
          applies_to: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          tag_ar: string
          tag_en?: string | null
          tag_type: string
          usage_count?: number | null
        }
        Update: {
          applies_to?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean | null
          tag_ar?: string
          tag_en?: string | null
          tag_type?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      ride_matching_log: {
        Row: {
          created_at: string
          distance_km: number | null
          driver_id: string | null
          id: string
          notified_at: string
          priority_score: number | null
          responded_at: string | null
          response: string | null
          ride_id: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          id?: string
          notified_at?: string
          priority_score?: number | null
          responded_at?: string | null
          response?: string | null
          ride_id: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          id?: string
          notified_at?: string
          priority_score?: number | null
          responded_at?: string | null
          response?: string | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_matching_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_matching_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_matching_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_matching_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_matching_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_messages: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          ride_id: string
          sender_id: string
          sender_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          ride_id: string
          sender_id: string
          sender_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          ride_id?: string
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_messages_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          driver_id: string | null
          id: string
          rating: number
          ride_id: string | null
          rider_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          rating: number
          ride_id?: string | null
          rider_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          driver_id?: string | null
          id?: string
          rating?: number
          ride_id?: string | null
          rider_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ride_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_ratings_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_reviews: {
        Row: {
          admin_response: string | null
          cleanliness_rating: number | null
          comment: string | null
          communication_rating: number | null
          created_at: string
          driving_rating: number | null
          id: string
          is_anonymous: boolean | null
          is_public: boolean | null
          overall_rating: number
          punctuality_rating: number | null
          reviewer_id: string | null
          reviewer_type: string
          ride_id: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          cleanliness_rating?: number | null
          comment?: string | null
          communication_rating?: number | null
          created_at?: string
          driving_rating?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_public?: boolean | null
          overall_rating: number
          punctuality_rating?: number | null
          reviewer_id?: string | null
          reviewer_type: string
          ride_id: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          cleanliness_rating?: number | null
          comment?: string | null
          communication_rating?: number | null
          created_at?: string
          driving_rating?: number | null
          id?: string
          is_anonymous?: boolean | null
          is_public?: boolean | null
          overall_rating?: number
          punctuality_rating?: number | null
          reviewer_id?: string | null
          reviewer_type?: string
          ride_id?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_reviews_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_reviews_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      ride_share_links: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ride_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ride_id: string
          token?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ride_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "ride_share_links_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_share_links_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_notification_preferences: {
        Row: {
          created_at: string | null
          driver_arrival: boolean | null
          id: string
          promo_offers: boolean | null
          push_enabled: boolean | null
          ride_updates: boolean | null
          scheduled_reminders: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          driver_arrival?: boolean | null
          id?: string
          promo_offers?: boolean | null
          push_enabled?: boolean | null
          ride_updates?: boolean | null
          scheduled_reminders?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          driver_arrival?: boolean | null
          id?: string
          promo_offers?: boolean | null
          push_enabled?: boolean | null
          ride_updates?: boolean | null
          scheduled_reminders?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rider_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      rider_page_layouts: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          layout_type: string
          name: string
          route_path: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_type?: string
          name: string
          route_path: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          layout_type?: string
          name?: string
          route_path?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rider_wait_settings: {
        Row: {
          auto_cancel_enabled: boolean
          auto_cancel_message: string
          created_at: string
          id: string
          max_wait_minutes: number
          search_messages: Json
          updated_at: string
          updated_by: string | null
          warning_message: string
          warning_threshold: number
        }
        Insert: {
          auto_cancel_enabled?: boolean
          auto_cancel_message?: string
          created_at?: string
          id?: string
          max_wait_minutes?: number
          search_messages?: Json
          updated_at?: string
          updated_by?: string | null
          warning_message?: string
          warning_threshold?: number
        }
        Update: {
          auto_cancel_enabled?: boolean
          auto_cancel_message?: string
          created_at?: string
          id?: string
          max_wait_minutes?: number
          search_messages?: Json
          updated_at?: string
          updated_by?: string | null
          warning_message?: string
          warning_threshold?: number
        }
        Relationships: []
      }
      rider_wallet_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          payment_method: string | null
          reference_id: string | null
          ride_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          ride_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          payment_method?: string | null
          reference_id?: string | null
          ride_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rider_wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "rider_wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      rides: {
        Row: {
          cancellation_fee: number | null
          cancellation_fee_paid: boolean | null
          cancellation_reason: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_location: Json
          duration_minutes: number | null
          estimated_fare: number | null
          final_fare: number | null
          id: string
          matched_at: string | null
          matching_attempts: number | null
          notified_drivers: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_address: string | null
          pickup_location: Json
          region_id: string | null
          rider_id: string | null
          rider_rating: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"] | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_minutes: number | null
        }
        Insert: {
          cancellation_fee?: number | null
          cancellation_fee_paid?: boolean | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          dropoff_address?: string | null
          dropoff_location: Json
          duration_minutes?: number | null
          estimated_fare?: number | null
          final_fare?: number | null
          id?: string
          matched_at?: string | null
          matching_attempts?: number | null
          notified_drivers?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location: Json
          region_id?: string | null
          rider_id?: string | null
          rider_rating?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"] | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_minutes?: number | null
        }
        Update: {
          cancellation_fee?: number | null
          cancellation_fee_paid?: boolean | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          dropoff_address?: string | null
          dropoff_location?: Json
          duration_minutes?: number | null
          estimated_fare?: number | null
          final_fare?: number | null
          id?: string
          matched_at?: string | null
          matching_attempts?: number | null
          notified_drivers?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location?: Json
          region_id?: string | null
          rider_id?: string | null
          rider_rating?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"] | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_places: {
        Row: {
          address: string
          created_at: string
          icon: string | null
          id: string
          label: string
          lat: number
          lng: number
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          created_at?: string
          icon?: string | null
          id?: string
          label: string
          lat: number
          lng: number
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          created_at?: string
          icon?: string | null
          id?: string
          label?: string
          lat?: number
          lng?: number
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_rides: {
        Row: {
          created_at: string | null
          dropoff_address: string | null
          dropoff_location: Json
          estimated_fare: number | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_address: string | null
          pickup_location: Json
          reminder_sent: boolean | null
          ride_id: string | null
          rider_id: string
          scheduled_at: string
          status: string | null
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          created_at?: string | null
          dropoff_address?: string | null
          dropoff_location: Json
          estimated_fare?: number | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location: Json
          reminder_sent?: boolean | null
          ride_id?: string | null
          rider_id: string
          scheduled_at: string
          status?: string | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          created_at?: string | null
          dropoff_address?: string | null
          dropoff_location?: Json
          estimated_fare?: number | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location?: Json
          reminder_sent?: boolean | null
          ride_id?: string | null
          rider_id?: string
          scheduled_at?: string
          status?: string | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_rides_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "scheduled_rides_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          cost: number | null
          created_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          ip_address: string | null
          message_type: string
          phone: string
          provider: string | null
          purpose: string | null
          status: string
          user_agent: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          ip_address?: string | null
          message_type: string
          phone: string
          provider?: string | null
          purpose?: string | null
          status?: string
          user_agent?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          ip_address?: string | null
          message_type?: string
          phone?: string
          provider?: string | null
          purpose?: string | null
          status?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          commission_discount: number
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          duration_days: number
          id: string
          is_active: boolean | null
          max_commission_rate: number | null
          name_ar: string
          name_en: string | null
          price: number
          priority_rides: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          commission_discount?: number
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          max_commission_rate?: number | null
          name_ar: string
          name_en?: string | null
          price: number
          priority_rides?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_discount?: number
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          max_commission_rate?: number | null
          name_ar?: string
          name_en?: string | null
          price?: number
          priority_rides?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      surge_pricing_rules: {
        Row: {
          commission_bonus: number | null
          created_at: string | null
          day_of_week: number[]
          end_time: string
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string | null
          priority: number | null
          region_id: string | null
          start_time: string
          surge_multiplier: number
          updated_at: string | null
        }
        Insert: {
          commission_bonus?: number | null
          created_at?: string | null
          day_of_week?: number[]
          end_time: string
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en?: string | null
          priority?: number | null
          region_id?: string | null
          start_time: string
          surge_multiplier?: number
          updated_at?: string | null
        }
        Update: {
          commission_bonus?: number | null
          created_at?: string | null
          day_of_week?: number[]
          end_time?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string | null
          priority?: number | null
          region_id?: string | null
          start_time?: string
          surge_multiplier?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "surge_pricing_rules_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_types: {
        Row: {
          commission_rate: number
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          icon: string
          id: string
          is_active: boolean | null
          min_fare: number
          multiplier: number
          name_ar: string
          name_en: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          icon?: string
          id: string
          is_active?: boolean | null
          min_fare?: number
          multiplier?: number
          name_ar: string
          name_en: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          icon?: string
          id?: string
          is_active?: boolean | null
          min_fare?: number
          multiplier?: number
          name_ar?: string
          name_en?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      wallet_topup_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string | null
          id: string
          payment_account: string | null
          payment_method: string
          reference_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
          user_type: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string | null
          id?: string
          payment_account?: string | null
          payment_method: string
          reference_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
          user_type: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string | null
          id?: string
          payment_account?: string | null
          payment_method?: string
          reference_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      api_usage_daily_stats: {
        Row: {
          api_type: string | null
          date: string | null
          total_cost: number | null
          total_requests: number | null
        }
        Relationships: []
      }
      available_drivers_safe: {
        Row: {
          current_location: Json | null
          id: string | null
          is_available: boolean | null
          is_online: boolean | null
          rating: number | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          working_region_id: string | null
        }
        Insert: {
          current_location?: Json | null
          id?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          rating?: number | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          working_region_id?: string | null
        }
        Update: {
          current_location?: Json | null
          id?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          rating?: number | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          working_region_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_working_region_id_fkey"
            columns: ["working_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      company_earnings_daily_stats: {
        Row: {
          avg_commission_rate: number | null
          date: string | null
          total_commission: number | null
          total_driver_share: number | null
          total_fares: number | null
          total_rides: number | null
        }
        Relationships: []
      }
      drivers_with_email: {
        Row: {
          admin_activated: boolean | null
          admin_controlled: boolean | null
          created_at: string | null
          current_location: Json | null
          full_name: string | null
          id: string | null
          id_image_url: string | null
          is_available: boolean | null
          is_online: boolean | null
          license_image_url: string | null
          license_number: string | null
          max_pickup_radius: number | null
          phone: string | null
          rating: number | null
          status: Database["public"]["Enums"]["driver_status"] | null
          total_earnings: number | null
          total_rides: number | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          working_region_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_working_region_id_fkey"
            columns: ["working_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_stats: {
        Row: {
          code: string | null
          completed_referrals: number | null
          pending_referrals: number | null
          total_earned: number | null
          total_referrals: number | null
          user_id: string | null
        }
        Relationships: []
      }
      ride_matching_stats: {
        Row: {
          created_at: string | null
          drivers_accepted: number | null
          drivers_notified: number | null
          drivers_rejected: number | null
          matched_at: string | null
          matching_duration_seconds: number | null
          ride_id: string | null
          status: Database["public"]["Enums"]["ride_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_ride_safely: {
        Args: { p_driver_id: string; p_ride_id: string }
        Returns: Json
      }
      admin_toggle_driver_activation: {
        Args: {
          p_admin_user_id: string
          p_driver_id: string
          p_is_active: boolean
        }
        Returns: boolean
      }
      apply_referral: {
        Args: { p_code: string; p_referred_user_id: string }
        Returns: Json
      }
      approve_topup_request: {
        Args: { p_admin_notes?: string; p_request_id: string }
        Returns: Json
      }
      auto_block_phone: {
        Args: { p_phone: string; p_reason?: string }
        Returns: undefined
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      check_and_grant_incentives: {
        Args: { p_driver_id: string }
        Returns: undefined
      }
      check_ip_rate_limit: {
        Args: {
          p_action: string
          p_ip: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_old_push_tokens: { Args: never; Returns: number }
      create_rider_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      deduct_driver_commission: {
        Args: { p_amount: number; p_driver_id: string; p_ride_id?: string }
        Returns: Json
      }
      delete_ride_cascade: { Args: { ride_id_param: string }; Returns: Json }
      driver_has_active_ride_with_rider: {
        Args: { rider_user_id: string }
        Returns: boolean
      }
      ensure_all_users_have_profiles: { Args: never; Returns: number }
      find_driver_by_phone: {
        Args: { p_phone: string }
        Returns: {
          full_name: string
          id: string
          phone: string
          status: Database["public"]["Enums"]["driver_status"]
          user_id: string
        }[]
      }
      generate_referral_code: { Args: { p_user_id: string }; Returns: string }
      get_active_driver_subscription: {
        Args: { p_driver_id: string }
        Returns: {
          commission_discount: number
          expires_at: string
          plan_name_ar: string
          priority_rides: boolean
          subscription_id: string
        }[]
      }
      get_current_surge_multiplier: {
        Args: { p_region_id?: string }
        Returns: {
          commission_bonus: number
          rule_name_ar: string
          surge_multiplier: number
        }[]
      }
      get_driver_commission_tier: {
        Args: { p_driver_id: string }
        Returns: {
          badge_color: string
          badge_icon: string
          commission_discount: number
          tier_id: string
          tier_name_ar: string
        }[]
      }
      get_driver_incentive_progress: {
        Args: { p_driver_id: string }
        Returns: {
          bonus_amount: number
          description: string
          incentive_id: string
          is_claimed: boolean
          name: string
          period: string
          period_end: string
          period_start: string
          rides_completed: number
          rides_required: number
        }[]
      }
      get_driver_wallet_balance: {
        Args: { p_driver_id: string }
        Returns: number
      }
      get_nearby_pending_rides: {
        Args: {
          driver_lat: number
          driver_lng: number
          driver_vehicle_type?: Database["public"]["Enums"]["vehicle_type"]
          max_radius_km?: number
        }
        Returns: {
          cancellation_fee: number | null
          cancellation_fee_paid: boolean | null
          cancellation_reason: string | null
          cancelled_by: string | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_location: Json
          duration_minutes: number | null
          estimated_fare: number | null
          final_fare: number | null
          id: string
          matched_at: string | null
          matching_attempts: number | null
          notified_drivers: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_address: string | null
          pickup_location: Json
          region_id: string | null
          rider_id: string | null
          rider_rating: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"] | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_minutes: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_ride_by_share_token: { Args: { p_token: string }; Returns: Json }
      get_rider_wallet_balance: { Args: { p_user_id: string }; Returns: number }
      get_sms_stats: {
        Args: { p_days?: number }
        Returns: {
          sms_count: number
          total_cost: number
          total_delivered: number
          total_failed: number
          total_sent: number
          whatsapp_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_name_banned: { Args: { p_name: string }; Returns: boolean }
      is_phone_blocked: { Args: { p_phone: string }; Returns: boolean }
      is_phone_registered: { Args: { p_phone: string }; Returns: boolean }
      link_driver_by_phone: { Args: { p_phone: string }; Returns: Json }
      log_api_usage: {
        Args: {
          p_api_type: string
          p_endpoint?: string
          p_estimated_cost?: number
          p_metadata?: Json
          p_request_count?: number
        }
        Returns: undefined
      }
      record_ip_request: {
        Args: { p_action: string; p_ip: string }
        Returns: undefined
      }
      reject_topup_request: {
        Args: { p_admin_notes?: string; p_request_id: string }
        Returns: Json
      }
      rider_has_active_ride_with_driver: {
        Args: { driver_id_param: string }
        Returns: boolean
      }
      transfer_wallet_to_driver: {
        Args: {
          p_amount: number
          p_commission_rate?: number
          p_driver_id: string
          p_ride_id: string
          p_rider_user_id: string
        }
        Returns: Json
      }
      update_driver_response: {
        Args: { p_driver_id: string; p_response: string; p_ride_id: string }
        Returns: boolean
      }
      update_notification_analytics: {
        Args: {
          p_delivery_delay_ms?: number
          p_is_delivered?: boolean
          p_is_failed?: boolean
          p_is_opened?: boolean
          p_is_sent?: boolean
          p_notification_type: string
        }
        Returns: undefined
      }
      update_user_name: { Args: { p_new_name: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      driver_status: "pending" | "approved" | "rejected" | "suspended"
      payment_method:
        | "cash"
        | "zain_cash"
        | "asia_hawala"
        | "qi_card"
        | "nas_wallet"
        | "nass"
      ride_status:
        | "pending"
        | "accepted"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
      vehicle_type: "economy" | "comfort" | "premium" | "women_only"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      driver_status: ["pending", "approved", "rejected", "suspended"],
      payment_method: [
        "cash",
        "zain_cash",
        "asia_hawala",
        "qi_card",
        "nas_wallet",
        "nass",
      ],
      ride_status: [
        "pending",
        "accepted",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
      ],
      vehicle_type: ["economy", "comfort", "premium", "women_only"],
    },
  },
} as const
