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
      account_deletions: {
        Row: {
          account_age_days: number | null
          created_at: string | null
          deleted_at: string | null
          id: string
          reason: string | null
          total_earnings: number | null
          total_rides: number | null
          user_id: string
          user_type: string
        }
        Insert: {
          account_age_days?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          reason?: string | null
          total_earnings?: number | null
          total_rides?: number | null
          user_id: string
          user_type: string
        }
        Update: {
          account_age_days?: number | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          reason?: string | null
          total_earnings?: number | null
          total_rides?: number | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
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
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: number
          metadata: Json | null
          phone_number: string | null
          ride_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json | null
          phone_number?: string | null
          ride_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json | null
          phone_number?: string | null
          ride_id?: string | null
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
      bot_customers: {
        Row: {
          display_name: string | null
          first_seen: string | null
          full_name: string | null
          id: string
          interaction_count: number | null
          last_active: string | null
          last_intent: string | null
          last_seen: string | null
          phone_number: string | null
          platform: string
          platform_id: string
          session_data: Json | null
          username: string | null
        }
        Insert: {
          display_name?: string | null
          first_seen?: string | null
          full_name?: string | null
          id?: string
          interaction_count?: number | null
          last_active?: string | null
          last_intent?: string | null
          last_seen?: string | null
          phone_number?: string | null
          platform: string
          platform_id: string
          session_data?: Json | null
          username?: string | null
        }
        Update: {
          display_name?: string | null
          first_seen?: string | null
          full_name?: string | null
          id?: string
          interaction_count?: number | null
          last_active?: string | null
          last_intent?: string | null
          last_seen?: string | null
          phone_number?: string | null
          platform?: string
          platform_id?: string
          session_data?: Json | null
          username?: string | null
        }
        Relationships: []
      }
      captain_alerts_log: {
        Row: {
          alert_type: string
          created_at: string | null
          driver_id: string | null
          id: string
          message: string | null
          ride_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          driver_id?: string | null
          id?: string
          message?: string | null
          ride_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          driver_id?: string | null
          id?: string
          message?: string | null
          ride_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "captain_alerts_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_alerts_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_alerts_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_alerts_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_alerts_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "captain_alerts_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      complaint_responses: {
        Row: {
          attachments: string[] | null
          complaint_id: string
          created_at: string | null
          id: string
          responder_id: string
          responder_type: string
          response_text: string
        }
        Insert: {
          attachments?: string[] | null
          complaint_id: string
          created_at?: string | null
          id?: string
          responder_id: string
          responder_type: string
          response_text: string
        }
        Update: {
          attachments?: string[] | null
          complaint_id?: string
          created_at?: string | null
          id?: string
          responder_id?: string
          responder_type?: string
          response_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_responses_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "ride_complaints"
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
      countries: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      delay_alerts: {
        Row: {
          actual_delay_minutes: number
          created_at: string | null
          driver_id: string
          driver_location: Json
          estimated_arrival_minutes: number
          id: string
          ride_id: string
          ride_status: string
          rider_id: string
          target_location: Json
        }
        Insert: {
          actual_delay_minutes: number
          created_at?: string | null
          driver_id: string
          driver_location: Json
          estimated_arrival_minutes: number
          id?: string
          ride_id: string
          ride_status: string
          rider_id: string
          target_location: Json
        }
        Update: {
          actual_delay_minutes?: number
          created_at?: string | null
          driver_id?: string
          driver_location?: Json
          estimated_arrival_minutes?: number
          id?: string
          ride_id?: string
          ride_status?: string
          rider_id?: string
          target_location?: Json
        }
        Relationships: [
          {
            foreignKeyName: "delay_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delay_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "delay_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          governorate_id: string
          id: string
          is_active: boolean | null
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          governorate_id: string
          id?: string
          is_active?: boolean | null
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          governorate_id?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      driver_live_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          driver_id: string
          heading: number | null
          id: string
          is_offline: boolean | null
          location: Json
          ride_id: string
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          driver_id: string
          heading?: number | null
          id?: string
          is_offline?: boolean | null
          location?: Json
          ride_id: string
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          is_offline?: boolean | null
          location?: Json
          ride_id?: string
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_live_locations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "driver_live_locations_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_notifications: {
        Row: {
          body: string
          campaign_id: string | null
          action_url: string | null
          image_url: string | null
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
          campaign_id?: string | null
          action_url?: string | null
          image_url?: string | null
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
          campaign_id?: string | null
          action_url?: string | null
          image_url?: string | null
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      notification_campaigns: {
        Row: {
          id: string
          title: string
          body: string
          image_url: string | null
          target_type: string
          target_user_id: string | null
          target_group_id: string | null
          target_filters: Json | null
          notification_type: string
          priority: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          total_recipients: number | null
          sent_count: number | null
          failed_count: number | null
          read_count: number | null
          action_url: string | null
          extra_data: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          body: string
          image_url?: string | null
          target_type: string
          target_user_id?: string | null
          target_group_id?: string | null
          target_filters?: Json | null
          notification_type?: string
          priority?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          total_recipients?: number | null
          sent_count?: number | null
          failed_count?: number | null
          read_count?: number | null
          action_url?: string | null
          extra_data?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          body?: string
          image_url?: string | null
          target_type?: string
          target_user_id?: string | null
          target_group_id?: string | null
          target_filters?: Json | null
          notification_type?: string
          priority?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          total_recipients?: number | null
          sent_count?: number | null
          failed_count?: number | null
          read_count?: number | null
          action_url?: string | null
          extra_data?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_groups: {
        Row: {
          id: string
          name: string
          description: string | null
          group_type: string
          is_dynamic: boolean | null
          filters: Json | null
          member_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          group_type?: string
          is_dynamic?: boolean | null
          filters?: Json | null
          member_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          group_type?: string
          is_dynamic?: boolean | null
          filters?: Json | null
          member_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          added_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          added_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          added_at?: string | null
        }
        Relationships: []
      }
      notification_auto_settings: {
        Row: {
          id: string
          event_key: string
          title_template: string
          body_template: string
          is_enabled: boolean | null
          target_role: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          event_key: string
          title_template: string
          body_template: string
          is_enabled?: boolean | null
          target_role?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          event_key?: string
          title_template?: string
          body_template?: string
          is_enabled?: boolean | null
          target_role?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      driver_update_requests: {
        Row: {
          additional_notes: string | null
          applied_at: string | null
          created_at: string
          driver_id: string
          id: string
          new_photo_url: string | null
          new_value: string | null
          old_photo_url: string | null
          old_value: string | null
          reason: string | null
          rejection_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          update_type: string
          updated_at: string
        }
        Insert: {
          additional_notes?: string | null
          applied_at?: string | null
          created_at?: string
          driver_id: string
          id?: string
          new_photo_url?: string | null
          new_value?: string | null
          old_photo_url?: string | null
          old_value?: string | null
          reason?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          update_type: string
          updated_at?: string
        }
        Update: {
          additional_notes?: string | null
          applied_at?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          new_photo_url?: string | null
          new_value?: string | null
          old_photo_url?: string | null
          old_value?: string | null
          reason?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          update_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_update_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_update_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_update_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_update_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      driver_wallets: {
        Row: {
          balance: number
          bank_accounts: Json | null
          commission_paid: number
          created_at: string
          driver_id: string
          id: string
          is_suspended: boolean | null
          lifetime_earnings: number
          pending_balance: number
          preferred_bank_account_id: string | null
          suspension_reason: string | null
          tips_received: number
          total_rides_completed: number
          total_withdrawn: number
          updated_at: string
        }
        Insert: {
          balance?: number
          bank_accounts?: Json | null
          commission_paid?: number
          created_at?: string
          driver_id: string
          id?: string
          is_suspended?: boolean | null
          lifetime_earnings?: number
          pending_balance?: number
          preferred_bank_account_id?: string | null
          suspension_reason?: string | null
          tips_received?: number
          total_rides_completed?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          bank_accounts?: Json | null
          commission_paid?: number
          created_at?: string
          driver_id?: string
          id?: string
          is_suspended?: boolean | null
          lifetime_earnings?: number
          pending_balance?: number
          preferred_bank_account_id?: string | null
          suspension_reason?: string | null
          tips_received?: number
          total_rides_completed?: number
          total_withdrawn?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          admin_activated: boolean | null
          admin_controlled: boolean | null
          commission_balance: number | null
          cooldown_until: string | null
          created_at: string
          current_location: Json | null
          email: string | null
          full_name: string
          gender: string | null
          has_profile_photo: boolean | null
          heading: number | null
          id: string
          id_image_back_url: string | null
          id_image_url: string | null
          is_available: boolean | null
          is_online: boolean | null
          last_heading_update: string | null
          license_image_back_url: string | null
          license_image_url: string | null
          license_number: string | null
          max_pickup_radius: number | null
          notification_preferences: Json | null
          phone: string
          profile_image_url: string | null
          rating: number | null
          scheduled_blocked_until: string | null
          speed: number | null
          status: Database["public"]["Enums"]["driver_status"] | null
          telegram_chat_id: string | null
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
          cooldown_until?: string | null
          created_at?: string
          current_location?: Json | null
          email?: string | null
          full_name: string
          gender?: string | null
          has_profile_photo?: boolean | null
          heading?: number | null
          id?: string
          id_image_back_url?: string | null
          id_image_url?: string | null
          residency_image_url?: string | null
          guarantor_image_url?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          last_heading_update?: string | null
          license_image_back_url?: string | null
          license_image_url?: string | null
          license_number?: string | null
          max_pickup_radius?: number | null
          notification_preferences?: Json | null
          phone: string
          profile_image_url?: string | null
          rating?: number | null
          scheduled_blocked_until?: string | null
          speed?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          telegram_chat_id?: string | null
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
          cooldown_until?: string | null
          created_at?: string
          current_location?: Json | null
          email?: string | null
          full_name?: string
          gender?: string | null
          has_profile_photo?: boolean | null
          heading?: number | null
          id?: string
          id_image_back_url?: string | null
          id_image_url?: string | null
          residency_image_url?: string | null
          guarantor_image_url?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          last_heading_update?: string | null
          license_image_back_url?: string | null
          license_image_url?: string | null
          license_number?: string | null
          max_pickup_radius?: number | null
          notification_preferences?: Json | null
          phone?: string
          profile_image_url?: string | null
          rating?: number | null
          scheduled_blocked_until?: string | null
          speed?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          telegram_chat_id?: string | null
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
      dual_stop_alerts: {
        Row: {
          alert_severity: string
          created_at: string | null
          distance_between_meters: number | null
          driver_acknowledged: boolean | null
          driver_id: string
          driver_last_location: Json
          id: string
          notified_at: string | null
          resolution_notes: string | null
          resolved_at: string | null
          ride_id: string
          rider_acknowledged: boolean | null
          rider_id: string
          rider_last_location: Json
          status: string | null
          stop_duration_minutes: number
          updated_at: string | null
        }
        Insert: {
          alert_severity: string
          created_at?: string | null
          distance_between_meters?: number | null
          driver_acknowledged?: boolean | null
          driver_id: string
          driver_last_location: Json
          id?: string
          notified_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          ride_id: string
          rider_acknowledged?: boolean | null
          rider_id: string
          rider_last_location: Json
          status?: string | null
          stop_duration_minutes: number
          updated_at?: string | null
        }
        Update: {
          alert_severity?: string
          created_at?: string | null
          distance_between_meters?: number | null
          driver_acknowledged?: boolean | null
          driver_id?: string
          driver_last_location?: Json
          id?: string
          notified_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          ride_id?: string
          rider_acknowledged?: boolean | null
          rider_id?: string
          rider_last_location?: Json
          status?: string | null
          stop_duration_minutes?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dual_stop_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dual_stop_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dual_stop_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dual_stop_alerts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dual_stop_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "dual_stop_alerts_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
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
      emergency_alerts_log: {
        Row: {
          alert_type: string
          created_at: string
          id: string
          location: Json | null
          notified_contacts: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          ride_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          id?: string
          location?: Json | null
          notified_contacts?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          ride_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          id?: string
          location?: Json | null
          notified_contacts?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          ride_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_alerts_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "emergency_alerts_log_ride_id_fkey"
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
      emergency_usage_log: {
        Row: {
          action_type: string
          created_at: string | null
          device_info: string | null
          id: string
          location: Json | null
          reason: string | null
          ride_id: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          device_info?: string | null
          id?: string
          location?: Json | null
          reason?: string | null
          ride_id?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          device_info?: string | null
          id?: string
          location?: Json | null
          reason?: string | null
          ride_id?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_usage_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "emergency_usage_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
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
      financial_decisions_log: {
        Row: {
          amount: number
          complaint_id: string | null
          created_at: string | null
          decided_by: string
          decision_type: string
          executed: boolean | null
          executed_at: string | null
          execution_details: Json | null
          id: string
          reason: string
          ride_id: string
        }
        Insert: {
          amount: number
          complaint_id?: string | null
          created_at?: string | null
          decided_by: string
          decision_type: string
          executed?: boolean | null
          executed_at?: string | null
          execution_details?: Json | null
          id?: string
          reason: string
          ride_id: string
        }
        Update: {
          amount?: number
          complaint_id?: string | null
          created_at?: string | null
          decided_by?: string
          decision_type?: string
          executed?: boolean | null
          executed_at?: string | null
          execution_details?: Json | null
          id?: string
          reason?: string
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_decisions_log_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "ride_complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_decisions_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "financial_decisions_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
      }
      governorates: {
        Row: {
          area_km2: number | null
          capital_city: string | null
          code: string
          coordinates: Json | null
          country_id: string | null
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
          country_id?: string | null
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
          country_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name_ar?: string
          name_en?: string
          name_ku?: string | null
          population?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "governorates_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
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
      messenger_accounts: {
        Row: {
          account_name: string | null
          app_id: string | null
          app_secret: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_message_at: string | null
          messages_received: number | null
          messages_sent: number | null
          page_access_token: string
          page_id: string
          page_name: string
          platform: string | null
          updated_at: string | null
          verify_token: string
        }
        Insert: {
          account_name?: string | null
          app_id?: string | null
          app_secret?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_message_at?: string | null
          messages_received?: number | null
          messages_sent?: number | null
          page_access_token: string
          page_id: string
          page_name: string
          platform?: string | null
          updated_at?: string | null
          verify_token?: string
        }
        Update: {
          account_name?: string | null
          app_id?: string | null
          app_secret?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_message_at?: string | null
          messages_received?: number | null
          messages_sent?: number | null
          page_access_token?: string
          page_id?: string
          page_name?: string
          platform?: string | null
          updated_at?: string | null
          verify_token?: string
        }
        Relationships: []
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
      notification_preferences: {
        Row: {
          chat_messages: boolean | null
          created_at: string
          earnings: boolean | null
          id: string
          notification_language: string | null
          promotions: boolean | null
          push_enabled: boolean | null
          push_platform: string | null
          push_token: string | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          ride_updates: boolean | null
          sound_enabled: boolean | null
          system_alerts: boolean | null
          updated_at: string
          user_id: string
          vibration_enabled: boolean | null
        }
        Insert: {
          chat_messages?: boolean | null
          created_at?: string
          earnings?: boolean | null
          id?: string
          notification_language?: string | null
          promotions?: boolean | null
          push_enabled?: boolean | null
          push_platform?: string | null
          push_token?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          ride_updates?: boolean | null
          sound_enabled?: boolean | null
          system_alerts?: boolean | null
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean | null
        }
        Update: {
          chat_messages?: boolean | null
          created_at?: string
          earnings?: boolean | null
          id?: string
          notification_language?: string | null
          promotions?: boolean | null
          push_enabled?: boolean | null
          push_platform?: string | null
          push_token?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          ride_updates?: boolean | null
          sound_enabled?: boolean | null
          system_alerts?: boolean | null
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean | null
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      notifications: {
        Row: {
          action_url: string | null
          category: string | null
          created_at: string
          expires_at: string | null
          id: string
          is_read: boolean | null
          message: string
          priority: string | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          priority?: string | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          priority?: string | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications_log: {
        Row: {
          ack_method: string | null
          acknowledged_at: string | null
          body: string
          created_at: string
          data: Json | null
          delivered_at: string | null
          delivery_delay_ms: number | null
          driver_id: string | null
          error_message: string | null
          fallback_at: string | null
          fallback_sent: boolean | null
          id: string
          notification_id: string | null
          notification_type: string
          opened_at: string | null
          retry_count: number | null
          ride_id: string | null
          sent_at: string | null
          status: string
          title: string
        }
        Insert: {
          ack_method?: string | null
          acknowledged_at?: string | null
          body: string
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          delivery_delay_ms?: number | null
          driver_id?: string | null
          error_message?: string | null
          fallback_at?: string | null
          fallback_sent?: boolean | null
          id?: string
          notification_id?: string | null
          notification_type: string
          opened_at?: string | null
          retry_count?: number | null
          ride_id?: string | null
          sent_at?: string | null
          status?: string
          title: string
        }
        Update: {
          ack_method?: string | null
          acknowledged_at?: string | null
          body?: string
          created_at?: string
          data?: Json | null
          delivered_at?: string | null
          delivery_delay_ms?: number | null
          driver_id?: string | null
          error_message?: string | null
          fallback_at?: string | null
          fallback_sent?: boolean | null
          id?: string
          notification_id?: string | null
          notification_type?: string
          opened_at?: string | null
          retry_count?: number | null
          ride_id?: string | null
          sent_at?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "notifications_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "notifications_log_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
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
      payment_methods: {
        Row: {
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          display_order: number | null
          icon_name: string | null
          id: string
          is_available_for_drivers: boolean | null
          is_available_for_riders: boolean | null
          is_enabled: boolean | null
          max_amount: number | null
          method_key: string
          min_amount: number | null
          name_ar: string
          name_en: string
          processing_fee_fixed: number | null
          processing_fee_percentage: number | null
          requires_verification: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_available_for_drivers?: boolean | null
          is_available_for_riders?: boolean | null
          is_enabled?: boolean | null
          max_amount?: number | null
          method_key: string
          min_amount?: number | null
          name_ar: string
          name_en: string
          processing_fee_fixed?: number | null
          processing_fee_percentage?: number | null
          requires_verification?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_available_for_drivers?: boolean | null
          is_available_for_riders?: boolean | null
          is_enabled?: boolean | null
          max_amount?: number | null
          method_key?: string
          min_amount?: number | null
          name_ar?: string
          name_en?: string
          processing_fee_fixed?: number | null
          processing_fee_percentage?: number | null
          requires_verification?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_location: Json | null
          device_type: string | null
          email: string | null
          fcm_token: string | null
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
          device_type?: string | null
          email?: string | null
          fcm_token?: string | null
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
          device_type?: string | null
          email?: string | null
          fcm_token?: string | null
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
          fcm_token: string | null
          id: string
          p256dh_key: string
          platform: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string
          driver_id?: string | null
          endpoint: string
          fcm_token?: string | null
          id?: string
          p256dh_key: string
          platform?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string
          driver_id?: string | null
          endpoint?: string
          fcm_token?: string | null
          id?: string
          p256dh_key?: string
          platform?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      rate_limit_log: {
        Row: {
          created_at: string
          id: number
          phone_key: string
        }
        Insert: {
          created_at?: string
          id?: never
          phone_key: string
        }
        Update: {
          created_at?: string
          id?: never
          phone_key?: string
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
      ride_complaints: {
        Row: {
          complainant_id: string
          complainant_type: string
          complaint_type: string
          created_at: string | null
          description: string
          evidence_urls: string[] | null
          financial_decision: string | null
          financial_decision_executed: boolean | null
          financial_decision_executed_at: string | null
          financial_decision_notes: string | null
          id: string
          priority: string | null
          resolution_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          ride_id: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          complainant_id: string
          complainant_type: string
          complaint_type: string
          created_at?: string | null
          description: string
          evidence_urls?: string[] | null
          financial_decision?: string | null
          financial_decision_executed?: boolean | null
          financial_decision_executed_at?: string | null
          financial_decision_notes?: string | null
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          ride_id: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          complainant_id?: string
          complainant_type?: string
          complaint_type?: string
          created_at?: string | null
          description?: string
          evidence_urls?: string[] | null
          financial_decision?: string | null
          financial_decision_executed?: boolean | null
          financial_decision_executed_at?: string | null
          financial_decision_notes?: string | null
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          ride_id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_complaints_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_complaints_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      ride_tracking_points: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          ride_id: string
          speed: number | null
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          ride_id: string
          speed?: number | null
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          ride_id?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ride_tracking_points_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "ride_tracking_points_ride_id_fkey"
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
          campaign_id: string | null
          action_url: string | null
          image_url: string | null
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
          campaign_id?: string | null
          action_url?: string | null
          image_url?: string | null
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
          campaign_id?: string | null
          action_url?: string | null
          image_url?: string | null
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
          actual_distance_km: number | null
          cancellation_fee: number | null
          cancellation_fee_paid: boolean | null
          cancellation_reason: string | null
          cancelled_by: string | null
          chain_matched_at: string | null
          chain_ride_id: string | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          distance_to_pickup_at_cancel: number | null
          driver_arrival_time: string | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_location: Json
          duration_minutes: number | null
          emergency_completed: boolean | null
          emergency_end_reason: string | null
          ended_by: string | null
          estimated_fare: number | null
          fare_adjustment_reason: string | null
          fare_variance_percent: number | null
          final_fare: number | null
          high_priority: boolean | null
          id: string
          is_chain_ride: boolean | null
          matched_at: string | null
          matching_attempts: number | null
          metadata: Json | null
          notified_drivers: Json | null
          original_estimated_fare: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_address: string | null
          pickup_location: Json
          prefer_women_driver: boolean | null
          reassignment_count: number | null
          region_id: string | null
          return_trip_id: string | null
          rider_id: string | null
          rider_last_location: Json | null
          rider_last_update: string | null
          rider_location: Json | null
          rider_location_updated_at: string | null
          rider_rating: number | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"] | null
          stops: Json | null
          trip_type: string | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_fare: number | null
          waiting_minutes: number | null
        }
        Insert: {
          actual_distance_km?: number | null
          cancellation_fee?: number | null
          cancellation_fee_paid?: boolean | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          chain_matched_at?: string | null
          chain_ride_id?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          distance_to_pickup_at_cancel?: number | null
          driver_arrival_time?: string | null
          driver_id?: string | null
          driver_rating?: number | null
          dropoff_address?: string | null
          dropoff_location: Json
          duration_minutes?: number | null
          emergency_completed?: boolean | null
          emergency_end_reason?: string | null
          ended_by?: string | null
          estimated_fare?: number | null
          fare_adjustment_reason?: string | null
          fare_variance_percent?: number | null
          final_fare?: number | null
          high_priority?: boolean | null
          id?: string
          is_chain_ride?: boolean | null
          matched_at?: string | null
          matching_attempts?: number | null
          metadata?: Json | null
          notified_drivers?: Json | null
          original_estimated_fare?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location: Json
          prefer_women_driver?: boolean | null
          reassignment_count?: number | null
          region_id?: string | null
          return_trip_id?: string | null
          rider_id?: string | null
          rider_last_location?: Json | null
          rider_last_update?: string | null
          rider_location?: Json | null
          rider_location_updated_at?: string | null
          rider_rating?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"] | null
          stops?: Json | null
          trip_type?: string | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_fare?: number | null
          waiting_minutes?: number | null
        }
        Update: {
          actual_distance_km?: number | null
          cancellation_fee?: number | null
          cancellation_fee_paid?: boolean | null
          cancellation_reason?: string | null
          cancelled_by?: string | null
          chain_matched_at?: string | null
          chain_ride_id?: string | null
          completed_at?: string | null
          created_at?: string
          distance_km?: number | null
          distance_to_pickup_at_cancel?: number | null
          driver_arrival_time?: string | null
          driver_id?: string | null
          driver_rating?: number | null
          dropoff_address?: string | null
          dropoff_location?: Json
          duration_minutes?: number | null
          emergency_completed?: boolean | null
          emergency_end_reason?: string | null
          ended_by?: string | null
          estimated_fare?: number | null
          fare_adjustment_reason?: string | null
          fare_variance_percent?: number | null
          final_fare?: number | null
          high_priority?: boolean | null
          id?: string
          is_chain_ride?: boolean | null
          matched_at?: string | null
          matching_attempts?: number | null
          metadata?: Json | null
          notified_drivers?: Json | null
          original_estimated_fare?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location?: Json
          prefer_women_driver?: boolean | null
          reassignment_count?: number | null
          region_id?: string | null
          return_trip_id?: string | null
          rider_id?: string | null
          rider_last_location?: Json | null
          rider_last_update?: string | null
          rider_location?: Json | null
          rider_location_updated_at?: string | null
          rider_rating?: number | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["ride_status"] | null
          stops?: Json | null
          trip_type?: string | null
          updated_at?: string
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_fare?: number | null
          waiting_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rides_chain_ride_id_fkey"
            columns: ["chain_ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "rides_chain_ride_id_fkey"
            columns: ["chain_ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
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
      saved_cards: {
        Row: {
          brand: string | null
          card_token: string
          created_at: string | null
          id: string
          is_default: boolean | null
          last4: string | null
          provider: string | null
          user_id: string | null
        }
        Insert: {
          brand?: string | null
          card_token: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          provider?: string | null
          user_id?: string | null
        }
        Update: {
          brand?: string | null
          card_token?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          provider?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          accepted_at: string | null
          created_at: string | null
          driver_confirmed_at: string | null
          driver_id: string | null
          dropoff_address: string | null
          dropoff_location: Json
          estimated_fare: number | null
          group_id: string | null
          high_priority: boolean | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_address: string | null
          pickup_location: Json
          prefer_women_driver: boolean | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          return_at: string | null
          ride_id: string | null
          rider_id: string
          scheduled_at: string
          status: string | null
          stops: Json | null
          trip_type: string | null
          updated_at: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          driver_confirmed_at?: string | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_location: Json
          estimated_fare?: number | null
          group_id?: string | null
          high_priority?: boolean | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location: Json
          prefer_women_driver?: boolean | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          return_at?: string | null
          ride_id?: string | null
          rider_id: string
          scheduled_at: string
          status?: string | null
          stops?: Json | null
          trip_type?: string | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          driver_confirmed_at?: string | null
          driver_id?: string | null
          dropoff_address?: string | null
          dropoff_location?: Json
          estimated_fare?: number | null
          group_id?: string | null
          high_priority?: boolean | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          pickup_address?: string | null
          pickup_location?: Json
          prefer_women_driver?: boolean | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          return_at?: string | null
          ride_id?: string | null
          rider_id?: string
          scheduled_at?: string
          status?: string | null
          stops?: Json | null
          trip_type?: string | null
          updated_at?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_rides_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
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
      system_configs: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_secret: boolean
          key_name: string
          key_value: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key_name: string
          key_value?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_secret?: boolean
          key_name?: string
          key_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_alerts: {
        Row: {
          action_taken: string | null
          admin_notes: string | null
          alert_type: string
          created_at: string | null
          description: string
          evidence: Json | null
          expires_at: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: string | null
          title: string
          user_id: string
          user_type: string
        }
        Insert: {
          action_taken?: string | null
          admin_notes?: string | null
          alert_type: string
          created_at?: string | null
          description: string
          evidence?: Json | null
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string | null
          title: string
          user_id: string
          user_type: string
        }
        Update: {
          action_taken?: string | null
          admin_notes?: string | null
          alert_type?: string
          created_at?: string | null
          description?: string
          evidence?: Json | null
          expires_at?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string | null
          title?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
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
      user_sessions: {
        Row: {
          created_at: string | null
          device_id: string
          id: string
          is_active: boolean | null
          last_activity: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_id: string
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_id?: string
          id?: string
          is_active?: boolean | null
          last_activity?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicle_photos: {
        Row: {
          created_at: string
          driver_id: string
          expires_at: string | null
          file_size_bytes: number | null
          height: number | null
          id: string
          is_verified: boolean | null
          mime_type: string | null
          photo_type: string
          photo_url: string
          thumbnail_url: string | null
          uploaded_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          expires_at?: string | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          photo_type: string
          photo_url: string
          thumbnail_url?: string | null
          uploaded_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          expires_at?: string | null
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          is_verified?: boolean | null
          mime_type?: string | null
          photo_type?: string
          photo_url?: string
          thumbnail_url?: string | null
          uploaded_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_photos_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
        ]
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
      visual_workflows: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          graph_data: Json | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          graph_data?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          graph_data?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      wallet_settings: {
        Row: {
          auto_withdrawal_enabled: boolean | null
          auto_withdrawal_threshold: number | null
          created_at: string
          default_commission_rate: number
          id: string
          max_daily_withdrawal: number
          min_withdrawal_amount: number
          updated_at: string
          withdrawal_fee_fixed: number
          withdrawal_fee_percentage: number
          withdrawal_processing_days: number
        }
        Insert: {
          auto_withdrawal_enabled?: boolean | null
          auto_withdrawal_threshold?: number | null
          created_at?: string
          default_commission_rate?: number
          id?: string
          max_daily_withdrawal?: number
          min_withdrawal_amount?: number
          updated_at?: string
          withdrawal_fee_fixed?: number
          withdrawal_fee_percentage?: number
          withdrawal_processing_days?: number
        }
        Update: {
          auto_withdrawal_enabled?: boolean | null
          auto_withdrawal_threshold?: number | null
          created_at?: string
          default_commission_rate?: number
          id?: string
          max_daily_withdrawal?: number
          min_withdrawal_amount?: number
          updated_at?: string
          withdrawal_fee_fixed?: number
          withdrawal_fee_percentage?: number
          withdrawal_processing_days?: number
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
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          driver_id: string
          id: string
          metadata: Json | null
          processed_at: string | null
          processed_by: string | null
          ride_id: string | null
          status: string
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          driver_id: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          ride_id?: string | null
          status?: string
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          driver_id?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          ride_id?: string | null
          status?: string
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "ride_matching_stats"
            referencedColumns: ["ride_id"]
          },
          {
            foreignKeyName: "wallet_transactions_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "rides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "driver_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          account_details: Json
          account_holder_name: string
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          driver_id: string
          id: string
          processed_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          transaction_reference: string | null
          updated_at: string
          wallet_id: string
          withdrawal_method: string
        }
        Insert: {
          account_details: Json
          account_holder_name: string
          amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          driver_id: string
          id?: string
          processed_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
          wallet_id: string
          withdrawal_method: string
        }
        Update: {
          account_details?: Json
          account_holder_name?: string
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          driver_id?: string
          id?: string
          processed_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          transaction_reference?: string | null
          updated_at?: string
          wallet_id?: string
          withdrawal_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_active"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "available_drivers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawal_requests_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "driver_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_executions: {
        Row: {
          completed_at: string | null
          context_data: Json | null
          conversation_id: string | null
          created_at: string | null
          current_step_id: string | null
          error_message: string | null
          id: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context_data?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          current_step_id?: string | null
          error_message?: string | null
          id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context_data?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          current_step_id?: string | null
          error_message?: string | null
          id?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "visual_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          execution_id: string | null
          id: string
          input_data: Json | null
          node_id: string
          node_type: string
          output_data: Json | null
          status: string
          step_order: number
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          input_data?: Json | null
          node_id: string
          node_type: string
          output_data?: Json | null
          status?: string
          step_order?: number
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          input_data?: Json | null
          node_id?: string
          node_type?: string
          output_data?: Json | null
          status?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "workflow_executions"
            referencedColumns: ["id"]
          },
        ]
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
      available_drivers_active: {
        Row: {
          current_location: Json | null
          full_name: string | null
          gender: string | null
          heading: number | null
          id: string | null
          is_available: boolean | null
          is_online: boolean | null
          max_pickup_radius: number | null
          phone: string | null
          profile_image_url: string | null
          rating: number | null
          speed: number | null
          status: Database["public"]["Enums"]["driver_status"] | null
          total_rides: number | null
          user_id: string | null
          vehicle_color: string | null
          vehicle_model: string | null
          vehicle_plate: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          current_location?: Json | null
          full_name?: string | null
          gender?: string | null
          heading?: number | null
          id?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          max_pickup_radius?: number | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          speed?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          total_rides?: number | null
          user_id?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          current_location?: Json | null
          full_name?: string | null
          gender?: string | null
          heading?: number | null
          id?: string | null
          is_available?: boolean | null
          is_online?: boolean | null
          max_pickup_radius?: number | null
          phone?: string | null
          profile_image_url?: string | null
          rating?: number | null
          speed?: number | null
          status?: Database["public"]["Enums"]["driver_status"] | null
          total_rides?: number | null
          user_id?: string | null
          vehicle_color?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
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
      complaints_stats: {
        Row: {
          high_priority_count: number | null
          old_pending_count: number | null
          pending_count: number | null
          rejected_count: number | null
          resolved_count: number | null
          under_review_count: number | null
          urgent_count: number | null
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
      accept_scheduled_ride: {
        Args: { p_scheduled_ride_id: string }
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
      apply_driver_update_request: {
        Args: { p_request_id: string }
        Returns: Json
      }
      apply_referral: {
        Args: { p_code: string; p_referred_user_id: string }
        Returns: Json
      }
      approve_topup_request: {
        Args: { p_admin_notes?: string; p_request_id: string }
        Returns: Json
      }
      audit_ride_fare: {
        Args: { p_actual_distance_km?: number; p_ride_id: string }
        Returns: Json
      }
      auto_block_phone: {
        Args: { p_phone: string; p_reason?: string }
        Returns: undefined
      }
      calculate_bearing: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      calculate_cancellation_penalty: {
        Args: { p_ride_id: string }
        Returns: Json
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      calculate_tracked_distance: {
        Args: { p_ride_id: string }
        Returns: number
      }
      cancel_scheduled_ride_by_driver: {
        Args: { p_scheduled_ride_id: string }
        Returns: Json
      }
      check_and_grant_incentives: {
        Args: { p_driver_id: string }
        Returns: undefined
      }
      check_emergency_abuse: { Args: { p_user_id: string }; Returns: Json }
      check_ip_rate_limit: {
        Args: {
          p_action: string
          p_ip: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_limit: number
          p_phone_key: string
          p_window_seconds?: number
        }
        Returns: boolean
      }
      cleanup_old_analytics: { Args: never; Returns: number }
      cleanup_old_push_tokens: { Args: never; Returns: number }
      cleanup_old_tracking_points: { Args: never; Returns: number }
      cleanup_rate_limit_log: { Args: never; Returns: undefined }
      cleanup_stale_awaiting_schedule: { Args: never; Returns: number }
      cleanup_stale_chat_sessions: { Args: never; Returns: number }
      cleanup_stale_draft_rides: { Args: never; Returns: number }
      cleanup_stale_draft_sessions: { Args: never; Returns: number }
      confirm_scheduled_ride: {
        Args: { p_scheduled_ride_id: string }
        Returns: Json
      }
      count_rider_cancellations: {
        Args: { p_interval?: unknown; p_rider_id: string }
        Returns: number
      }
      create_delay_alerts_table: { Args: never; Returns: boolean }
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
      create_wallet_transaction: {
        Args: {
          p_amount: number
          p_description?: string
          p_driver_id: string
          p_metadata?: Json
          p_ride_id?: string
          p_transaction_type: string
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
      execute_financial_decision: {
        Args: {
          p_complaint_id: string
          p_decision_type: string
          p_reason: string
        }
        Returns: Json
      }
      find_chain_rides: {
        Args: {
          p_driver_heading?: number
          p_driver_id: string
          p_driver_vehicle_type?: string
          p_dropoff_lat: number
          p_dropoff_lng: number
          p_search_radius_km?: number
        }
        Returns: {
          chain_score: number
          distance_from_dropoff: number
          dropoff_address: string
          dropoff_location: Json
          estimated_fare: number
          is_heading_match: boolean
          pickup_address: string
          pickup_location: Json
          ride_id: string
          vehicle_type: string
        }[]
      }
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
      find_drivers_directional: {
        Args: {
          p_cone_half_angle?: number
          p_exclude_driver_ids?: string[]
          p_max_radius_km?: number
          p_pickup_lat: number
          p_pickup_lng: number
          p_prefer_women_driver?: boolean
          p_vehicle_type?: string
        }
        Returns: {
          bearing_to_pickup: number
          directional_score: number
          distance_km: number
          driver_heading: number
          driver_id: string
          driver_location: Json
          driver_max_pickup_radius: number
          driver_name: string
          driver_rating: number
          driver_speed: number
          driver_total_rides: number
          driver_user_id: string
          driver_vehicle_type: string
          is_heading_towards: boolean
        }[]
      }
      generate_referral_code: { Args: { p_user_id: string }; Returns: string }
      generate_ride_tracking_token: {
        Args: { p_ride_id: string }
        Returns: string
      }
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
      get_available_payment_methods: {
        Args: { user_type?: string }
        Returns: {
          description_ar: string
          icon_name: string
          id: string
          max_amount: number
          method_key: string
          min_amount: number
          name_ar: string
          name_en: string
          processing_fee_fixed: number
          processing_fee_percentage: number
        }[]
      }
      get_cancellation_penalties_report: {
        Args: { p_from_date?: string; p_to_date?: string }
        Returns: {
          cancellation_fee: number
          cancellation_fee_paid: boolean
          cancelled_at: string
          cancelled_by: string
          distance_to_pickup: number
          driver_id: string
          reassignment_count: number
          ride_id: string
          rider_id: string
        }[]
      }
      get_config: { Args: { p_key_name: string }; Returns: string }
      get_configs_by_category: {
        Args: { p_category: string }
        Returns: {
          key_name: string
          key_value: string
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
      get_daily_analytics: { Args: { p_date?: string }; Returns: Json }
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
          actual_distance_km: number | null
          cancellation_fee: number | null
          cancellation_fee_paid: boolean | null
          cancellation_reason: string | null
          cancelled_by: string | null
          chain_matched_at: string | null
          chain_ride_id: string | null
          completed_at: string | null
          created_at: string
          distance_km: number | null
          distance_to_pickup_at_cancel: number | null
          driver_arrival_time: string | null
          driver_id: string | null
          driver_rating: number | null
          dropoff_address: string | null
          dropoff_location: Json
          duration_minutes: number | null
          emergency_completed: boolean | null
          emergency_end_reason: string | null
          ended_by: string | null
          estimated_fare: number | null
          fare_adjustment_reason: string | null
          fare_variance_percent: number | null
          final_fare: number | null
          high_priority: boolean | null
          id: string
          is_chain_ride: boolean | null
          matched_at: string | null
          matching_attempts: number | null
          metadata: Json | null
          notified_drivers: Json | null
          original_estimated_fare: number | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          pickup_address: string | null
          pickup_location: Json
          prefer_women_driver: boolean | null
          reassignment_count: number | null
          region_id: string | null
          return_trip_id: string | null
          rider_id: string | null
          rider_last_location: Json | null
          rider_last_update: string | null
          rider_location: Json | null
          rider_location_updated_at: string | null
          rider_rating: number | null
          scheduled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["ride_status"] | null
          stops: Json | null
          trip_type: string | null
          updated_at: string
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          waiting_fare: number | null
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
      get_rider_penalty_info: { Args: { p_rider_id: string }; Returns: Json }
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
      get_supabase_config: { Args: { p_key: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_bot_customer_interactions: {
        Args: { p_platform: string; p_platform_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_name_banned: { Args: { p_name: string }; Returns: boolean }
      is_phone_blocked: { Args: { p_phone: string }; Returns: boolean }
      is_phone_registered: { Args: { p_phone: string }; Returns: boolean }
      is_within_cone: {
        Args: {
          cone_half_angle?: number
          driver_heading: number
          driver_lat: number
          driver_lng: number
          max_distance_km?: number
          target_lat: number
          target_lng: number
        }
        Returns: boolean
      }
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
      mark_notification_acknowledged: {
        Args: { p_method?: string; p_notification_id: string }
        Returns: undefined
      }
      mark_notifications_as_read: {
        Args: { p_notification_ids?: string[]; p_user_id: string }
        Returns: number
      }
      process_ride_earnings: {
        Args: {
          p_commission_rate?: number
          p_driver_id: string
          p_ride_id: string
          p_total_fare: number
        }
        Returns: Json
      }
      record_ip_request: {
        Args: { p_action: string; p_ip: string }
        Returns: undefined
      }
      reject_driver_update_request: {
        Args: {
          p_admin_id: string
          p_rejection_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      reject_topup_request: {
        Args: { p_admin_notes?: string; p_request_id: string }
        Returns: Json
      }
      reserve_chain_ride: {
        Args: {
          p_chain_ride_id: string
          p_current_ride_id: string
          p_driver_id: string
        }
        Returns: Json
      }
      rider_has_active_ride_with_driver: {
        Args: { driver_id_param: string }
        Returns: boolean
      }
      run_all_cleanups: { Args: never; Returns: Json }
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
      trigger_emergency_alert: {
        Args: {
          p_alert_type: string
          p_location?: Json
          p_ride_id?: string
          p_user_id: string
        }
        Returns: string
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
        | "draft"
        | "pending"
        | "accepted"
        | "arrived"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "scheduled"
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
        "draft",
        "pending",
        "accepted",
        "arrived",
        "in_progress",
        "completed",
        "cancelled",
        "scheduled",
      ],
      vehicle_type: ["economy", "comfort", "premium", "women_only"],
    },
  },
} as const

