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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
      sales_activities: {
        Row: {
          activity_type: string
          channel: string
          created_at: string
          direction: string
          external_message_ref: string | null
          id: string
          lead_id: string
          next_action: string | null
          next_followup_at: string | null
          occurred_at: string
          opportunity_id: string | null
          outcome: string | null
          responsible: string | null
          summary: string | null
        }
        Insert: {
          activity_type?: string
          channel: string
          created_at?: string
          direction: string
          external_message_ref?: string | null
          id?: string
          lead_id: string
          next_action?: string | null
          next_followup_at?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          responsible?: string | null
          summary?: string | null
        }
        Update: {
          activity_type?: string
          channel?: string
          created_at?: string
          direction?: string
          external_message_ref?: string | null
          id?: string
          lead_id?: string
          next_action?: string | null
          next_followup_at?: string | null
          occurred_at?: string
          opportunity_id?: string | null
          outcome?: string | null
          responsible?: string | null
          summary?: string | null
        }
        Relationships: []
      }
      sales_leads: {
        Row: { business_unit: string; created_at: string; display_name: string; first_inbound_at: string | null; first_outbound_at: string | null; first_purchase_at: string | null; first_seen_at: string | null; id: string; instagram: string | null; notes: string | null; source: string | null; updated_at: string; user_id: string | null; whatsapp: string | null }
        Insert: { business_unit?: string; created_at?: string; display_name: string; first_inbound_at?: string | null; first_outbound_at?: string | null; first_purchase_at?: string | null; first_seen_at?: string | null; id?: string; instagram?: string | null; notes?: string | null; source?: string | null; updated_at?: string; user_id?: string | null; whatsapp?: string | null }
        Update: { business_unit?: string; created_at?: string; display_name?: string; first_inbound_at?: string | null; first_outbound_at?: string | null; first_purchase_at?: string | null; first_seen_at?: string | null; id?: string; instagram?: string | null; notes?: string | null; source?: string | null; updated_at?: string; user_id?: string | null; whatsapp?: string | null }
        Relationships: []
      }
      sales_opportunities: {
        Row: { business_unit: string; closed_at: string | null; created_at: string; currency: string; estimated_amount: number | null; id: string; kind: string; lead_id: string; lost_reason: string | null; next_followup_at: string | null; notes: string | null; service: string | null; source: string | null; stage: string; updated_at: string }
        Insert: { business_unit?: string; closed_at?: string | null; created_at?: string; currency?: string; estimated_amount?: number | null; id?: string; kind?: string; lead_id: string; lost_reason?: string | null; next_followup_at?: string | null; notes?: string | null; service?: string | null; source?: string | null; stage?: string; updated_at?: string }
        Update: { business_unit?: string; closed_at?: string | null; created_at?: string; currency?: string; estimated_amount?: number | null; id?: string; kind?: string; lead_id?: string; lost_reason?: string | null; next_followup_at?: string | null; notes?: string | null; service?: string | null; source?: string | null; stage?: string; updated_at?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      beat_license_assignments: {
        Row: {
          beat_id: string
          created_at: string
          id: string
          is_enabled: boolean
          license_id: string
          price: number
          updated_at: string
        }
        Insert: {
          beat_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          license_id: string
          price: number
          updated_at?: string
        }
        Update: {
          beat_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          license_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beat_license_assignments_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beat_license_assignments_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "beat_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_licenses: {
        Row: {
          created_at: string
          description: string
          format: string | null
          id: string
          is_active: boolean
          max_price: number
          min_price: number
          name: string
          stream_limit: number | null
          terms: string | null
          unlimited_streams: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          format?: string | null
          id?: string
          is_active?: boolean
          max_price: number
          min_price: number
          name: string
          stream_limit?: number | null
          terms?: string | null
          unlimited_streams?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          format?: string | null
          id?: string
          is_active?: boolean
          max_price?: number
          min_price?: number
          name?: string
          stream_limit?: number | null
          terms?: string | null
          unlimited_streams?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      cloud_jobs: {
        Row: {
          action: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          path: string | null
          payload: Json | null
          result: Json | null
          status: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          path?: string | null
          payload?: Json | null
          result?: Json | null
          status?: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          path?: string | null
          payload?: Json | null
          result?: Json | null
          status?: string
        }
        Relationships: []
      }
      contracts: {
        Row: {
          contract: string | null
          created_at: string
          id: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          contract?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          contract?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      downloads: {
        Row: {
          created_at: string | null
          id: string
          membership_cycle_number: number | null
          membership_delivery_id: string | null
          membership_id: string | null
          name: string | null
          notes: string | null
          release_mode: string
          storage_path: string | null
          type: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          membership_cycle_number?: number | null
          membership_delivery_id?: string | null
          membership_id?: string | null
          name?: string | null
          notes?: string | null
          release_mode?: string
          storage_path?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          membership_cycle_number?: number | null
          membership_delivery_id?: string | null
          membership_id?: string | null
          name?: string | null
          notes?: string | null
          release_mode?: string
          storage_path?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "downloads_membership_delivery_id_fkey"
            columns: ["membership_delivery_id"]
            isOneToOne: false
            referencedRelation: "membership_material_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "downloads_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participations: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          participation_percent: number | null
          role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          participation_percent?: number | null
          role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          participation_percent?: number | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_participations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_user_access"
            referencedColumns: ["event_id"]
          },
        ]
      }
      event_tickets: {
        Row: {
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          event_key: string
          folio: string
          id: string
          notes: string | null
          price: number
          qr_payload: string
          sold_at: string | null
          status: string
          ticket_type: string
          updated_at: string
          used_at: string | null
          used_by: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          event_key: string
          folio: string
          id?: string
          notes?: string | null
          price?: number
          qr_payload: string
          sold_at?: string | null
          status?: string
          ticket_type?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          event_key?: string
          folio?: string
          id?: string
          notes?: string | null
          price?: number
          qr_payload?: string
          sold_at?: string | null
          status?: string
          ticket_type?: string
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_user_permissions: {
        Row: {
          can_add_finance: boolean | null
          can_edit_finance: boolean | null
          can_edit_scrum: boolean | null
          can_view: boolean | null
          can_view_scrum: boolean
          created_at: string | null
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          can_add_finance?: boolean | null
          can_edit_finance?: boolean | null
          can_edit_scrum?: boolean | null
          can_view?: boolean | null
          can_view_scrum?: boolean
          created_at?: string | null
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          can_add_finance?: boolean | null
          can_edit_finance?: boolean | null
          can_edit_scrum?: boolean | null
          can_view?: boolean | null
          can_view_scrum?: boolean
          created_at?: string | null
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_user_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_user_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_user_permissions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_user_access"
            referencedColumns: ["event_id"]
          },
        ]
      }
      events: {
        Row: {
          city: string | null
          event_date: string | null
          event_key: string
          id: string
          modalidad: string | null
          name: string | null
          notes: string | null
          status: string | null
          venue: string | null
        }
        Insert: {
          city?: string | null
          event_date?: string | null
          event_key: string
          id?: string
          modalidad?: string | null
          name?: string | null
          notes?: string | null
          status?: string | null
          venue?: string | null
        }
        Update: {
          city?: string | null
          event_date?: string | null
          event_key?: string
          id?: string
          modalidad?: string | null
          name?: string | null
          notes?: string | null
          status?: string | null
          venue?: string | null
        }
        Relationships: []
      }
      finance_entities: {
        Row: {
          created_at: string
          entity_key: string
          entity_type: string
          id: string
          name: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          entity_type?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          entity_type?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      hr_internal_investments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          created_by_user_id: string | null
          created_by_username: string | null
          event_id: string | null
          event_key: string | null
          expected_return: number | null
          id: string
          investor_name: string
          investor_user_id: string | null
          movement_date: string | null
          movement_type: string
          notes: string | null
          payment_method: string | null
          return_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          created_by_user_id?: string | null
          created_by_username?: string | null
          event_id?: string | null
          event_key?: string | null
          expected_return?: number | null
          id?: string
          investor_name: string
          investor_user_id?: string | null
          movement_date?: string | null
          movement_type: string
          notes?: string | null
          payment_method?: string | null
          return_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          created_by_user_id?: string | null
          created_by_username?: string | null
          event_id?: string | null
          event_key?: string | null
          expected_return?: number | null
          id?: string
          investor_name?: string
          investor_user_id?: string | null
          movement_date?: string | null
          movement_type?: string
          notes?: string | null
          payment_method?: string | null
          return_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_internal_investments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_internal_investments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_internal_investments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_user_access"
            referencedColumns: ["event_id"]
          },
        ]
      }
      hr_transaction_allocations: {
        Row: {
          amount: number | null
          created_at: string
          entity_id: string
          id: string
          percentage: number | null
          transaction_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          entity_id: string
          id?: string
          percentage?: number | null
          transaction_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          entity_id?: string
          id?: string
          percentage?: number | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_transaction_allocations_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "finance_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_transaction_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "hr_event_transactions_clean"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_transaction_allocations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "hr_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_transactions: {
        Row: {
          amount: number | null
          class: string | null
          concept: string | null
          created_at: string
          created_by: string | null
          created_by_user_id: string | null
          created_by_username: string | null
          date: string | null
          div: string | null
          event_id: string | null
          event_key: string | null
          from_user_id: string | null
          hidden_room_share: number | null
          id: string
          "M.A.I.": number | null
          movement_date: string | null
          movement_type: string | null
          notes: string | null
          owner_entity_id: string | null
          owner_user_id: string | null
          payment_method: string | null
          to_user_id: string | null
          type: string | null
          user_id: string | null
          username: string | null
          via: string | null
        }
        Insert: {
          amount?: number | null
          class?: string | null
          concept?: string | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          created_by_username?: string | null
          date?: string | null
          div?: string | null
          event_id?: string | null
          event_key?: string | null
          from_user_id?: string | null
          hidden_room_share?: number | null
          id?: string
          "M.A.I."?: number | null
          movement_date?: string | null
          movement_type?: string | null
          notes?: string | null
          owner_entity_id?: string | null
          owner_user_id?: string | null
          payment_method?: string | null
          to_user_id?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
          via?: string | null
        }
        Update: {
          amount?: number | null
          class?: string | null
          concept?: string | null
          created_at?: string
          created_by?: string | null
          created_by_user_id?: string | null
          created_by_username?: string | null
          date?: string | null
          div?: string | null
          event_id?: string | null
          event_key?: string | null
          from_user_id?: string | null
          hidden_room_share?: number | null
          id?: string
          "M.A.I."?: number | null
          movement_date?: string | null
          movement_type?: string | null
          notes?: string | null
          owner_entity_id?: string | null
          owner_user_id?: string | null
          payment_method?: string | null
          to_user_id?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_user_access"
            referencedColumns: ["event_id"]
          },
          {
            foreignKeyName: "hr_transactions_owner_entity_id_fkey"
            columns: ["owner_entity_id"]
            isOneToOne: false
            referencedRelation: "finance_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      ig_contest: {
        Row: {
          concepto: string
          created_at: string
          id: string
          ig_username: string
          user_id: string | null
        }
        Insert: {
          concepto: string
          created_at?: string
          id?: string
          ig_username: string
          user_id?: string | null
        }
        Update: {
          concepto?: string
          created_at?: string
          id?: string
          ig_username?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ig_mention_analyses: {
        Row: {
          comments_count: number | null
          created_at: string
          created_by: string | null
          id: string
          media_id: string
          media_permalink: string | null
          mentions_count: number | null
          ranking_total: Json | null
          ranking_unique_authors: Json | null
          unique_mentions_count: number | null
        }
        Insert: {
          comments_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          media_id: string
          media_permalink?: string | null
          mentions_count?: number | null
          ranking_total?: Json | null
          ranking_unique_authors?: Json | null
          unique_mentions_count?: number | null
        }
        Update: {
          comments_count?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          media_id?: string
          media_permalink?: string | null
          mentions_count?: number | null
          ranking_total?: Json | null
          ranking_unique_authors?: Json | null
          unique_mentions_count?: number | null
        }
        Relationships: []
      }
      media_posts: {
        Row: {
          author_id: string | null
          author_name: string | null
          category: string
          content: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          featured: boolean
          id: string
          published_at: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
          views: number
        }
        Insert: {
          author_id?: string | null
          author_name?: string | null
          category: string
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          views?: number
        }
        Update: {
          author_id?: string | null
          author_name?: string | null
          category?: string
          content?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          views?: number
        }
        Relationships: []
      }
      membership_material_deliveries: {
        Row: {
          created_at: string
          cycle_number: number
          delivered_at: string
          id: string
          membership_id: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_number: number
          delivered_at: string
          id?: string
          membership_id?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_number?: number
          delivered_at?: string
          id?: string
          membership_id?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_material_deliveries_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          sessions_per_week: number
          start_date: string
          status: string
          updated_at: string | null
          user_id: string
          username: string | null
          weekly_price: number
        }
        Insert: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          sessions_per_week?: number
          start_date: string
          status?: string
          updated_at?: string | null
          user_id: string
          username?: string | null
          weekly_price?: number
        }
        Update: {
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          sessions_per_week?: number
          start_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          username?: string | null
          weekly_price?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          paid_at: string | null
          provider: string
          reference: string
          status: string
          store_order_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          reference: string
          status?: string
          store_order_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          paid_at?: string | null
          provider?: string
          reference?: string
          status?: string
          store_order_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: true
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          role: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          role?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          role?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      partner_contracts: {
        Row: {
          created_at: string
          id: string
          link: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      passline_tickets: {
        Row: {
          activation_code: string | null
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          discount_amount: number | null
          discount_code: string | null
          event_date: string | null
          event_key: string | null
          id: string
          imported_at: string | null
          imported_by: string | null
          is_courtesy: boolean | null
          purchase_id: string | null
          purchase_status: string | null
          raw_row: Json
          rrpp: string | null
          rrpp_email: string | null
          rrpp_name: string | null
          service_fee: number | null
          source_file: string | null
          ticket_id: string
          ticket_status: string | null
          ticket_type: string | null
          total: number | null
          user_id: string | null
          validation_datetime: string | null
        }
        Insert: {
          activation_code?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          event_date?: string | null
          event_key?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          is_courtesy?: boolean | null
          purchase_id?: string | null
          purchase_status?: string | null
          raw_row?: Json
          rrpp?: string | null
          rrpp_email?: string | null
          rrpp_name?: string | null
          service_fee?: number | null
          source_file?: string | null
          ticket_id: string
          ticket_status?: string | null
          ticket_type?: string | null
          total?: number | null
          user_id?: string | null
          validation_datetime?: string | null
        }
        Update: {
          activation_code?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          discount_amount?: number | null
          discount_code?: string | null
          event_date?: string | null
          event_key?: string | null
          id?: string
          imported_at?: string | null
          imported_by?: string | null
          is_courtesy?: boolean | null
          purchase_id?: string | null
          purchase_status?: string | null
          raw_row?: Json
          rrpp?: string | null
          rrpp_email?: string | null
          rrpp_name?: string | null
          service_fee?: number | null
          source_file?: string | null
          ticket_id?: string
          ticket_status?: string | null
          ticket_type?: string | null
          total?: number | null
          user_id?: string | null
          validation_datetime?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          approved_at: string | null
          created_at: string
          currency: string
          id: string
          order_id: string | null
          payment_id: string | null
          provider: string
          provider_order_id: string | null
          raw_response: Json
          reference: string | null
          status: string
          store_order_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          provider: string
          provider_order_id?: string | null
          raw_response?: Json
          reference?: string | null
          status?: string
          store_order_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          approved_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          provider?: string
          provider_order_id?: string | null
          raw_response?: Json
          reference?: string | null
          status?: string
          store_order_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_store_order_id_fkey"
            columns: ["store_order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      predictor_matches: {
        Row: {
          actual_winner: string | null
          away_score: number | null
          away_team: string
          created_at: string
          created_by: string | null
          finalized_at: string | null
          home_score: number | null
          home_team: string
          id: string
          kickoff_at: string
          stage: string | null
          status: string
        }
        Insert: {
          actual_winner?: string | null
          away_score?: number | null
          away_team: string
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          kickoff_at: string
          stage?: string | null
          status?: string
        }
        Update: {
          actual_winner?: string | null
          away_score?: number | null
          away_team?: string
          created_at?: string
          created_by?: string | null
          finalized_at?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          kickoff_at?: string
          stage?: string | null
          status?: string
        }
        Relationships: []
      }
      predictor_predictions: {
        Row: {
          away_score: number
          coins_awarded: number
          created_at: string
          exact_score_hit: boolean
          home_score: number
          id: string
          match_id: string
          points_awarded: number
          predicted_winner: string
          scored_at: string | null
          updated_at: string
          user_id: string
          winner_hit: boolean
        }
        Insert: {
          away_score: number
          coins_awarded?: number
          created_at?: string
          exact_score_hit?: boolean
          home_score: number
          id?: string
          match_id: string
          points_awarded?: number
          predicted_winner: string
          scored_at?: string | null
          updated_at?: string
          user_id: string
          winner_hit?: boolean
        }
        Update: {
          away_score?: number
          coins_awarded?: number
          created_at?: string
          exact_score_hit?: boolean
          home_score?: number
          id?: string
          match_id?: string
          points_awarded?: number
          predicted_winner?: string
          scored_at?: string | null
          updated_at?: string
          user_id?: string
          winner_hit?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "predictor_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "predictor_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      producer_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          slug: string
          social_links: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          slug: string
          social_links?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          slug?: string
          social_links?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "producer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producer_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          name: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          name?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      rewards: {
        Row: {
          concept: string | null
          created_at: string
          id: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          concept?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          concept?: string | null
          created_at?: string
          id?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          amount: number | null
          created_at: string
          game_id: string | null
          id: string
          type: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string
          game_id?: string | null
          id?: string
          type?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string
          game_id?: string | null
          id?: string
          type?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      server_metrics: {
        Row: {
          cpu_cores: number | null
          cpu_percent: number | null
          created_at: string | null
          disk_total_gb: number | null
          disk_used_gb: number | null
          hostname: string | null
          id: number
          online: boolean | null
          ram_total_gb: number | null
          ram_used_gb: number | null
          server_key: string
          tailscale_ip: string | null
          temperature_c: number | null
          uptime_seconds: number | null
        }
        Insert: {
          cpu_cores?: number | null
          cpu_percent?: number | null
          created_at?: string | null
          disk_total_gb?: number | null
          disk_used_gb?: number | null
          hostname?: string | null
          id?: never
          online?: boolean | null
          ram_total_gb?: number | null
          ram_used_gb?: number | null
          server_key?: string
          tailscale_ip?: string | null
          temperature_c?: number | null
          uptime_seconds?: number | null
        }
        Update: {
          cpu_cores?: number | null
          cpu_percent?: number | null
          created_at?: string | null
          disk_total_gb?: number | null
          disk_used_gb?: number | null
          hostname?: string | null
          id?: never
          online?: boolean | null
          ram_total_gb?: number | null
          ram_used_gb?: number | null
          server_key?: string
          tailscale_ip?: string | null
          temperature_c?: number | null
          uptime_seconds?: number | null
        }
        Relationships: []
      }
      server_status_history: {
        Row: {
          cpu_percent: number | null
          created_at: string
          disk_percent: number | null
          hostname: string | null
          id: number
          payload: Json
          ram_percent: number | null
          temperature_celsius: number | null
        }
        Insert: {
          cpu_percent?: number | null
          created_at?: string
          disk_percent?: number | null
          hostname?: string | null
          id?: number
          payload?: Json
          ram_percent?: number | null
          temperature_celsius?: number | null
        }
        Update: {
          cpu_percent?: number | null
          created_at?: string
          disk_percent?: number | null
          hostname?: string | null
          id?: number
          payload?: Json
          ram_percent?: number | null
          temperature_celsius?: number | null
        }
        Relationships: []
      }
      services: {
        Row: {
          created_at: string
          id: string
          key: string
          name: string
          session_cost: number | null
          session_minutes: number | null
          show_in_finance: boolean
          show_in_session: boolean
          sort_order: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          name: string
          session_cost?: number | null
          session_minutes?: number | null
          show_in_finance?: boolean
          show_in_session?: boolean
          sort_order?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          name?: string
          session_cost?: number | null
          session_minutes?: number | null
          show_in_finance?: boolean
          show_in_session?: boolean
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          assistance: boolean | null
          concept: string | null
          cost: number | null
          created_at: string | null
          end: string | null
          hour: string | null
          id: string
          membership_id: string | null
          notes: string | null
          promo: string | null
          sc_end: string | null
          session_date: string | null
          start: string | null
          status: string | null
          type: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          assistance?: boolean | null
          concept?: string | null
          cost?: number | null
          created_at?: string | null
          end?: string | null
          hour?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          promo?: string | null
          sc_end?: string | null
          session_date?: string | null
          start?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          assistance?: boolean | null
          concept?: string | null
          cost?: number | null
          created_at?: string | null
          end?: string | null
          hour?: string | null
          id?: string
          membership_id?: string | null
          notes?: string | null
          promo?: string | null
          sc_end?: string | null
          session_date?: string | null
          start?: string | null
          status?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      store_downloads: {
        Row: {
          beat_id: string | null
          available: boolean
          created_at: string
          download_count: number
          file_url: string | null
          id: string
          license_id: string | null
          license_name: string | null
          license_snapshot: Json
          order_id: string
          product_id: string | null
          user_id: string
        }
        Insert: {
          beat_id?: string | null
          available?: boolean
          created_at?: string
          download_count?: number
          file_url?: string | null
          id?: string
          license_id?: string | null
          license_name?: string | null
          license_snapshot?: Json
          order_id: string
          product_id?: string | null
          user_id: string
        }
        Update: {
          beat_id?: string | null
          available?: boolean
          created_at?: string
          download_count?: number
          file_url?: string | null
          id?: string
          license_id?: string | null
          license_name?: string | null
          license_snapshot?: Json
          order_id?: string
          product_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_downloads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_items: {
        Row: {
          beat_id: string | null
          created_at: string
          id: string
          license_id: string | null
          license_name: string | null
          license_snapshot: Json
          order_id: string
          producer_name: string | null
          product_id: string | null
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          beat_id?: string | null
          created_at?: string
          id?: string
          license_id?: string | null
          license_name?: string | null
          license_snapshot?: Json
          order_id: string
          producer_name?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          beat_id?: string | null
          created_at?: string
          id?: string
          license_id?: string | null
          license_name?: string | null
          license_snapshot?: Json
          order_id?: string
          producer_name?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "store_products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          external_reference: string | null
          id: string
          paid_at: string | null
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
          stripe_payment_intent: string | null
          stripe_session_id: string | null
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_reference?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_reference?: string | null
          id?: string
          paid_at?: string | null
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
          stripe_payment_intent?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      store_products: {
        Row: {
          beat_bpm: number | null
          beat_bpm_autodetected: boolean
          beat_cover_path: string | null
          beat_duration_seconds: number | null
          beat_genre: string | null
          beat_key: string | null
          beat_key_autodetected: boolean
          beat_original_path: string | null
          beat_preview_error: string | null
          beat_preview_path: string | null
          beat_preview_status: string
          beat_thumb_path: string | null
          category: string
          created_at: string
          currency: string
          description: string | null
          featured: boolean
          file_url: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_digital: boolean
          name: string
          price: number
          producer: string | null
          producer_profile_id: string | null
          producer_user_id: string | null
          slug: string
          stock: number | null
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          beat_bpm?: number | null
          beat_bpm_autodetected?: boolean
          beat_cover_path?: string | null
          beat_duration_seconds?: number | null
          beat_genre?: string | null
          beat_key?: string | null
          beat_key_autodetected?: boolean
          beat_original_path?: string | null
          beat_preview_error?: string | null
          beat_preview_path?: string | null
          beat_preview_status?: string
          beat_thumb_path?: string | null
          category: string
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_digital?: boolean
          name: string
          price: number
          producer?: string | null
          producer_profile_id?: string | null
          producer_user_id?: string | null
          slug: string
          stock?: number | null
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          beat_bpm?: number | null
          beat_bpm_autodetected?: boolean
          beat_cover_path?: string | null
          beat_duration_seconds?: number | null
          beat_genre?: string | null
          beat_key?: string | null
          beat_key_autodetected?: boolean
          beat_original_path?: string | null
          beat_preview_error?: string | null
          beat_preview_path?: string | null
          beat_preview_status?: string
          beat_thumb_path?: string | null
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          featured?: boolean
          file_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_digital?: boolean
          name?: string
          price?: number
          producer?: string | null
          producer_profile_id?: string | null
          producer_user_id?: string | null
          slug?: string
          stock?: number | null
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_producer_profile_id_fkey"
            columns: ["producer_profile_id"]
            isOneToOne: false
            referencedRelation: "producer_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          event_id: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_user_access"
            referencedColumns: ["event_id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number | null
          concept: string | null
          created_at: string | null
          date: string | null
          id: string
          id_trans: string | null
          membership_id: string | null
          notes: string | null
          service: string | null
          studio: string | null
          type: string | null
          user_id: string | null
          username: string | null
          varios_servicios: boolean | null
          via: string | null
        }
        Insert: {
          amount?: number | null
          concept?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          id_trans?: string | null
          membership_id?: string | null
          notes?: string | null
          service?: string | null
          studio?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
          varios_servicios?: boolean | null
          via?: string | null
        }
        Update: {
          amount?: number | null
          concept?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          id_trans?: string | null
          membership_id?: string | null
          notes?: string | null
          service?: string | null
          studio?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
          varios_servicios?: boolean | null
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          id: number
          permission_key: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          permission_key?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          permission_key?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          has_auth: boolean | null
          id: string
          ig_username: string | null
          occupations: string[]
          old_id: string | null
          passline_tracking: string[]
          roles: string | null
          temp_password: string | null
          user_id: string | null
          username: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          has_auth?: boolean | null
          id?: string
          ig_username?: string | null
          occupations?: string[]
          old_id?: string | null
          passline_tracking?: string[]
          roles?: string | null
          temp_password?: string | null
          user_id?: string | null
          username?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          has_auth?: boolean | null
          id?: string
          ig_username?: string | null
          occupations?: string[]
          old_id?: string | null
          passline_tracking?: string[]
          roles?: string | null
          temp_password?: string | null
          user_id?: string | null
          username?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      hr_event_finance_summary: {
        Row: {
          balance_evento: number | null
          egresos: number | null
          entregas_a_favor: number | null
          event_key: string | null
          hidden_room_share_total: number | null
          ingresos: number | null
          inversion_ingresada: number | null
          mai: number | null
          rights_counterparty_acquired: number | null
          rights_hidden_room_acquired: number | null
          rights_total_cost: number | null
          utilidad_devuelta: number | null
        }
        Relationships: []
      }
      hr_event_transactions_clean: {
        Row: {
          amount: number | null
          class: string | null
          concept: string | null
          created_at: string | null
          date: string | null
          div: string | null
          event_id: string | null
          event_key: string | null
          from_user_id: string | null
          id: string | null
          "M.A.I.": number | null
          mai_amount: number | null
          movement_date: string | null
          movement_type: string | null
          notes: string | null
          owner_user_id: string | null
          payment_method: string | null
          to_user_id: string | null
          type: string | null
          user_id: string | null
          username: string | null
          via: string | null
        }
        Insert: {
          amount?: number | null
          class?: string | null
          concept?: string | null
          created_at?: string | null
          date?: string | null
          div?: string | null
          event_id?: string | null
          event_key?: string | null
          from_user_id?: string | null
          id?: string | null
          "M.A.I."?: number | null
          mai_amount?: number | null
          movement_date?: string | null
          movement_type?: string | null
          notes?: string | null
          owner_user_id?: string | null
          payment_method?: string | null
          to_user_id?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
          via?: string | null
        }
        Update: {
          amount?: number | null
          class?: string | null
          concept?: string | null
          created_at?: string | null
          date?: string | null
          div?: string | null
          event_id?: string | null
          event_key?: string | null
          from_user_id?: string | null
          id?: string | null
          "M.A.I."?: number | null
          mai_amount?: number | null
          movement_date?: string | null
          movement_type?: string | null
          notes?: string | null
          owner_user_id?: string | null
          payment_method?: string | null
          to_user_id?: string | null
          type?: string | null
          user_id?: string | null
          username?: string | null
          via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_transactions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "hr_events_user_access"
            referencedColumns: ["event_id"]
          },
        ]
      }
      hr_events_dashboard: {
        Row: {
          balance_evento: number | null
          egresos: number | null
          entregas_a_favor: number | null
          event_date: string | null
          event_key: string | null
          hidden_room_share_total: number | null
          id: string | null
          ingresos: number | null
          inversion_ingresada: number | null
          mai: number | null
          name: string | null
          rights_counterparty_acquired: number | null
          rights_hidden_room_acquired: number | null
          rights_total_cost: number | null
          status: string | null
          utilidad_devuelta: number | null
        }
        Relationships: []
      }
      hr_events_user_access: {
        Row: {
          can_add_finance: boolean | null
          can_edit_finance: boolean | null
          can_edit_scrum: boolean | null
          can_view: boolean | null
          can_view_scrum: boolean | null
          event_date: string | null
          event_id: string | null
          event_key: string | null
          name: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: []
      }
      hr_scrum_events: {
        Row: {
          can_edit_scrum: boolean | null
          can_view_scrum: boolean | null
          event_date: string | null
          event_key: string | null
          id: string | null
          name: string | null
          status: string | null
        }
        Relationships: []
      }
      membership_dashboard: {
        Row: {
          estado: string | null
          fecha_de_saldo: string | null
          fecha_de_sesion: string | null
          notas: string | null
          saldo: number | null
          semana: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      predictor_leaderboard: {
        Row: {
          exact_hits: number | null
          predictions_count: number | null
          total_coins: number | null
          total_points: number | null
          user_id: string | null
          username: string | null
          winner_hits: number | null
        }
        Relationships: []
      }
      users_safe: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          email: string | null
          id: string | null
          roles: string | null
          user_id: string | null
          username: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          id?: string | null
          roles?: string | null
          user_id?: string | null
          username?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          email?: string | null
          id?: string | null
          roles?: string | null
          user_id?: string | null
          username?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_merge_public_user_profiles: {
        Args: { p_duplicate_email: string; p_keep_user_id: string }
        Returns: Json
      }
      can_edit_tickets: { Args: { check_user_id?: string }; Returns: boolean }
      can_import_passline_tickets: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      can_manage_beat_product: { Args: { p_beat_id: string }; Returns: boolean }
      can_validate_tickets: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      can_view_tickets: { Args: { check_user_id?: string }; Returns: boolean }
      delete_beat_license_if_unused: {
        Args: { p_license_id: string }
        Returns: boolean
      }
      delete_ticket_batch: {
        Args: {
          p_end_number: number
          p_event_key: string
          p_start_number: number
        }
        Returns: number
      }
      email_is_registered: { Args: { p_email: string }; Returns: boolean }
      ensure_my_user_id: { Args: never; Returns: string }
      finalize_predictor_match: {
        Args: { p_away_score: number; p_home_score: number; p_match_id: string }
        Returns: undefined
      }
      fulfill_store_order: {
        Args: {
          p_order_id: string
          p_stripe_payment_intent: string
          p_stripe_session_id: string
        }
        Returns: boolean
      }
      fulfill_store_order_provider: {
        Args: {
          p_order_id: string
          p_provider: string
          p_provider_order_id: string
          p_provider_payment_id: string
          p_raw_response?: Json
          p_status: string
        }
        Returns: boolean
      }
      generate_public_user_id: { Args: never; Returns: string }
      get_my_role: { Args: never; Returns: string }
      has_media_posts_permission: {
        Args: { check_user_id?: string }
        Returns: boolean
      }
      has_scrum_event_permission: {
        Args: {
          check_event_id: string
          check_user_id?: string
          permission_name: string
        }
        Returns: boolean
      }
      has_ticket_permission: {
        Args: { check_user_id?: string; permission_name: string }
        Returns: boolean
      }
      hr_normalize_ig_username: { Args: { p_value: string }; Returns: string }
      increment_media_post_views: {
        Args: { post_slug: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_claimable_phone: { Args: { p_phone: string }; Returns: boolean }
      mark_ticket_used: {
        Args: { ticket_folio: string }
        Returns: {
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          event_key: string
          folio: string
          id: string
          notes: string | null
          price: number
          qr_payload: string
          sold_at: string | null
          status: string
          ticket_type: string
          updated_at: string
          used_at: string | null
          used_by: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "event_tickets"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_user_id: { Args: never; Returns: string }
      normalize_phone_digits: { Args: { p_phone: string }; Returns: string }
      predictor_can_manage_matches: { Args: never; Returns: boolean }
      predictor_match_is_open: {
        Args: { p_match_id: string }
        Returns: boolean
      }
      predictor_prediction_exists: {
        Args: { p_match_id: string; p_user_id: string }
        Returns: boolean
      }
      save_hr_transaction_with_allocations: {
        Args: {
          p_allocations?: Json
          p_transaction: Json
          p_transaction_id?: string
        }
        Returns: string
      }
      sync_ig_contest_benefits_for_user: {
        Args: {
          p_display_name?: string
          p_email?: string
          p_ig_username: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
