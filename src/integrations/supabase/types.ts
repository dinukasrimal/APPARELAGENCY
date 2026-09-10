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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          address: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agencies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_discount_limits: {
        Row: {
          agency_id: string
          assigned_at: string | null
          assigned_by: string
          id: string
          is_active: boolean | null
          max_discount_percentage: number
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          assigned_at?: string | null
          assigned_by: string
          id?: string
          is_active?: boolean | null
          max_discount_percentage?: number
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          assigned_at?: string | null
          assigned_by?: string
          id?: string
          is_active?: boolean | null
          max_discount_percentage?: number
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_discount_limits_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_expenses: {
        Row: {
          agency_id: string
          amount: number
          bill_photo_path: string
          bill_photo_url: string
          category: string
          created_at: string
          id: string
          notes: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          agency_id: string
          amount: number
          bill_photo_path: string
          bill_photo_url: string
          category: string
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          amount?: number
          bill_photo_path?: string
          bill_photo_url?: string
          category?: string
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_expenses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_feature_access: {
        Row: {
          agency_id: string
          created_at: string
          enable_fuel_expenses: boolean
          enable_time_tracking_odometer: boolean
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string
          enable_fuel_expenses?: boolean
          enable_time_tracking_odometer?: boolean
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string
          enable_fuel_expenses?: boolean
          enable_time_tracking_odometer?: boolean
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_feature_access_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_feature_access_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_pricing_settings: {
        Row: {
          agency_id: string | null
          id: string
          price_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          agency_id?: string | null
          id?: string
          price_type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          agency_id?: string | null
          id?: string
          price_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_pricing_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_pricing_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_product_exclusions: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_product_exclusions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_product_exclusions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_product_exclusions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      auto_sync_logs: {
        Row: {
          created_at: string | null
          cross_project_invoices_synced: number | null
          cross_project_lines_synced: number | null
          details: Json | null
          duration_ms: number | null
          id: string
          internal_movements_created: number | null
          message: string | null
          phases_completed: Json | null
          status: string
          sync_id: string
          total_errors: number | null
        }
        Insert: {
          created_at?: string | null
          cross_project_invoices_synced?: number | null
          cross_project_lines_synced?: number | null
          details?: Json | null
          duration_ms?: number | null
          id?: string
          internal_movements_created?: number | null
          message?: string | null
          phases_completed?: Json | null
          status: string
          sync_id: string
          total_errors?: number | null
        }
        Update: {
          created_at?: string | null
          cross_project_invoices_synced?: number | null
          cross_project_lines_synced?: number | null
          details?: Json | null
          duration_ms?: number | null
          id?: string
          internal_movements_created?: number | null
          message?: string | null
          phases_completed?: Json | null
          status?: string
          sync_id?: string
          total_errors?: number | null
        }
        Relationships: []
      }
      category_images: {
        Row: {
          category_name: string
          created_at: string
          id: string
          image_url: string
          subcategory_name: string | null
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          id?: string
          image_url: string
          subcategory_name?: string | null
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          id?: string
          image_url?: string
          subcategory_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      collection_allocations: {
        Row: {
          allocated_amount: number
          allocated_at: string | null
          allocated_by: string | null
          collection_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          allocated_amount: number
          allocated_at?: string | null
          allocated_by?: string | null
          collection_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          allocated_amount?: number
          allocated_at?: string | null
          allocated_by?: string | null
          collection_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_allocations_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_cheques: {
        Row: {
          amount: number
          bank_name: string
          cheque_date: string
          cheque_number: string
          cleared_at: string | null
          collection_id: string
          created_at: string | null
          id: string
          replacement_for_cheque_id: string | null
          resolution_method: string | null
          resolved_at: string | null
          return_reason: string | null
          returned_at: string | null
          status: string | null
        }
        Insert: {
          amount: number
          bank_name: string
          cheque_date: string
          cheque_number: string
          cleared_at?: string | null
          collection_id: string
          created_at?: string | null
          id?: string
          replacement_for_cheque_id?: string | null
          resolution_method?: string | null
          resolved_at?: string | null
          return_reason?: string | null
          returned_at?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          bank_name?: string
          cheque_date?: string
          cheque_number?: string
          cleared_at?: string | null
          collection_id?: string
          created_at?: string | null
          id?: string
          replacement_for_cheque_id?: string | null
          resolution_method?: string | null
          resolved_at?: string | null
          return_reason?: string | null
          returned_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_cheques_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_cheques_replacement_for_cheque_id_fkey"
            columns: ["replacement_for_cheque_id"]
            isOneToOne: false
            referencedRelation: "collection_cheques"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          agency_id: string
          cash_amount: number | null
          cash_date: string
          cash_discount: number | null
          cheque_amount: number | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          customer_name: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          payment_method: string
          status: string | null
          total_amount: number
        }
        Insert: {
          agency_id: string
          cash_amount?: number | null
          cash_date: string
          cash_discount?: number | null
          cheque_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          customer_name: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method: string
          status?: string | null
          total_amount: number
        }
        Update: {
          agency_id?: string
          cash_amount?: number | null
          cash_date?: string
          cash_discount?: number | null
          cheque_amount?: number | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          payment_method?: string
          status?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "collections_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_invoices: {
        Row: {
          agency_id: string
          agency_name: string
          file_name: string
          file_url: string
          id: string
          total: number
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          agency_id: string
          agency_name: string
          file_name: string
          file_url: string
          id?: string
          total?: number
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          agency_id?: string
          agency_name?: string
          file_name?: string
          file_url?: string
          id?: string
          total?: number
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_project_sync_config: {
        Row: {
          agency_mapping: Json | null
          batch_size: number | null
          created_at: string | null
          external_project_key_encrypted: string | null
          external_project_url: string
          id: string
          incremental_sync: boolean | null
          last_error: string | null
          last_sync_at: string | null
          max_retries: number | null
          next_sync_at: string | null
          sync_enabled: boolean | null
          sync_interval_hours: number | null
          sync_status: string | null
          total_synced: number | null
          updated_at: string | null
        }
        Insert: {
          agency_mapping?: Json | null
          batch_size?: number | null
          created_at?: string | null
          external_project_key_encrypted?: string | null
          external_project_url: string
          id?: string
          incremental_sync?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          max_retries?: number | null
          next_sync_at?: string | null
          sync_enabled?: boolean | null
          sync_interval_hours?: number | null
          sync_status?: string | null
          total_synced?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_mapping?: Json | null
          batch_size?: number | null
          created_at?: string | null
          external_project_key_encrypted?: string | null
          external_project_url?: string
          id?: string
          incremental_sync?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          max_retries?: number | null
          next_sync_at?: string | null
          sync_enabled?: boolean | null
          sync_interval_hours?: number | null
          sync_status?: string | null
          total_synced?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cross_project_sync_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          duration_ms: number | null
          errors_count: number | null
          external_project_url: string | null
          id: string
          invoices_skipped: number | null
          invoices_synced: number | null
          lines_synced: number | null
          message: string | null
          status: string
          sync_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          errors_count?: number | null
          external_project_url?: string | null
          id?: string
          invoices_skipped?: number | null
          invoices_synced?: number | null
          lines_synced?: number | null
          message?: string | null
          status: string
          sync_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          duration_ms?: number | null
          errors_count?: number | null
          external_project_url?: string | null
          id?: string
          invoices_skipped?: number | null
          invoices_synced?: number | null
          lines_synced?: number | null
          message?: string | null
          status?: string
          sync_id?: string
        }
        Relationships: []
      }
      customer_assets: {
        Row: {
          asset_type: string
          created_at: string
          customer_id: string
          description: string
          given_by: string
          id: string
          latitude: number | null
          longitude: number | null
          photo_url: string
        }
        Insert: {
          asset_type: string
          created_at?: string
          customer_id: string
          description: string
          given_by: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url: string
        }
        Update: {
          asset_type?: string
          created_at?: string
          customer_id?: string
          description?: string
          given_by?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          photo_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_assets_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          agency_id: string
          created_at: string | null
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          phone: string
          secondary_phone: string | null
          shop_owner_birthday: string | null
          shop_owner_name: string | null
          signature: string | null
          storefront_photo: string | null
        }
        Insert: {
          address: string
          agency_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          phone: string
          secondary_phone?: string | null
          shop_owner_birthday?: string | null
          shop_owner_name?: string | null
          signature?: string | null
          storefront_photo?: string | null
        }
        Update: {
          address?: string
          agency_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          phone?: string
          secondary_phone?: string | null
          shop_owner_birthday?: string | null
          shop_owner_name?: string | null
          signature?: string | null
          storefront_photo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          agency_id: string
          created_at: string | null
          created_by: string
          delivered_at: string | null
          delivery_agent_id: string
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_notes: string | null
          delivery_signature: string | null
          id: string
          invoice_id: string
          received_by_name: string | null
          received_by_phone: string | null
          scheduled_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          created_by: string
          delivered_at?: string | null
          delivery_agent_id: string
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_notes?: string | null
          delivery_signature?: string | null
          id?: string
          invoice_id: string
          received_by_name?: string | null
          received_by_phone?: string | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          created_by?: string
          delivered_at?: string | null
          delivery_agent_id?: string
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_notes?: string | null
          delivery_signature?: string | null
          id?: string
          invoice_id?: string
          received_by_name?: string | null
          received_by_phone?: string | null
          scheduled_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          color: string | null
          condition_notes: string | null
          created_at: string | null
          delivery_id: string
          id: string
          invoice_item_id: string
          item_condition: string | null
          product_id: string
          product_name: string
          quantity: number
          size: string | null
        }
        Insert: {
          color?: string | null
          condition_notes?: string | null
          created_at?: string | null
          delivery_id: string
          id?: string
          invoice_item_id: string
          item_condition?: string | null
          product_id: string
          product_name: string
          quantity: number
          size?: string | null
        }
        Update: {
          color?: string | null
          condition_notes?: string | null
          created_at?: string | null
          delivery_id?: string
          id?: string
          invoice_item_id?: string
          item_condition?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          size?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "delivery_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_rules: {
        Row: {
          applicable_to: Database["public"]["Enums"]["applicable_to"]
          created_at: string | null
          created_by: string | null
          current_usage_count: number | null
          description: string | null
          id: string
          is_active: boolean | null
          max_usage_count: number | null
          name: string
          target_ids: string[] | null
          target_names: string[] | null
          type: Database["public"]["Enums"]["discount_type"]
          valid_from: string
          valid_to: string
          value: number
        }
        Insert: {
          applicable_to: Database["public"]["Enums"]["applicable_to"]
          created_at?: string | null
          created_by?: string | null
          current_usage_count?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_usage_count?: number | null
          name: string
          target_ids?: string[] | null
          target_names?: string[] | null
          type: Database["public"]["Enums"]["discount_type"]
          valid_from: string
          valid_to: string
          value: number
        }
        Update: {
          applicable_to?: Database["public"]["Enums"]["applicable_to"]
          created_at?: string | null
          created_by?: string | null
          current_usage_count?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_usage_count?: number | null
          name?: string
          target_ids?: string[] | null
          target_names?: string[] | null
          type?: Database["public"]["Enums"]["discount_type"]
          valid_from?: string
          valid_to?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_by: string | null
          assigned_to: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: Database["public"]["Enums"]["priority_level"] | null
          reason: string
          sales_order_id: string | null
          status: Database["public"]["Enums"]["dispute_status"] | null
          target_id: string
          target_name: string
          type: Database["public"]["Enums"]["dispute_type"]
          updated_at: string | null
        }
        Insert: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          reason: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          target_id: string
          target_name: string
          type: Database["public"]["Enums"]["dispute_type"]
          updated_at?: string | null
        }
        Update: {
          assigned_by?: string | null
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["priority_level"] | null
          reason?: string
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["dispute_status"] | null
          target_id?: string
          target_name?: string
          type?: Database["public"]["Enums"]["dispute_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      external_bot_project_invoices: {
        Row: {
          agency_match: string | null
          amount_total: number | null
          auto_post: boolean | null
          company_id: number | null
          created_at: string | null
          currency_id: string | null
          date_invoice: string | null
          date_order: string | null
          fiscal_position_id: number | null
          id: number
          invoice_origin: string | null
          invoice_payment_term_id: number | null
          journal_id: number | null
          move_type: string | null
          name: string | null
          order_lines: Json | null
          partner_name: string | null
          payment_state: string | null
          reference: string | null
          state: string | null
          sync_timestamp: string | null
          team_id: number | null
          to_check: boolean | null
          updated_at: string | null
          user_id: number | null
        }
        Insert: {
          agency_match?: string | null
          amount_total?: number | null
          auto_post?: boolean | null
          company_id?: number | null
          created_at?: string | null
          currency_id?: string | null
          date_invoice?: string | null
          date_order?: string | null
          fiscal_position_id?: number | null
          id: number
          invoice_origin?: string | null
          invoice_payment_term_id?: number | null
          journal_id?: number | null
          move_type?: string | null
          name?: string | null
          order_lines?: Json | null
          partner_name?: string | null
          payment_state?: string | null
          reference?: string | null
          state?: string | null
          sync_timestamp?: string | null
          team_id?: number | null
          to_check?: boolean | null
          updated_at?: string | null
          user_id?: number | null
        }
        Update: {
          agency_match?: string | null
          amount_total?: number | null
          auto_post?: boolean | null
          company_id?: number | null
          created_at?: string | null
          currency_id?: string | null
          date_invoice?: string | null
          date_order?: string | null
          fiscal_position_id?: number | null
          id?: number
          invoice_origin?: string | null
          invoice_payment_term_id?: number | null
          journal_id?: number | null
          move_type?: string | null
          name?: string | null
          order_lines?: Json | null
          partner_name?: string | null
          payment_state?: string | null
          reference?: string | null
          state?: string | null
          sync_timestamp?: string | null
          team_id?: number | null
          to_check?: boolean | null
          updated_at?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      external_bot_sync_log: {
        Row: {
          created_at: string | null
          details: Json | null
          id: number
          message: string | null
          status: string
          sync_timestamp: string | null
          synced_count: number | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: number
          message?: string | null
          status: string
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: number
          message?: string | null
          status?: string
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Relationships: []
      }
      external_inventory_backup_final: {
        Row: {
          absolute_quantity: number | null
          agency_id: string | null
          category: string | null
          color: string | null
          created_at: string | null
          external_id: string | null
          external_reference: string | null
          external_source: string | null
          id: string | null
          is_stock_in: boolean | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          reference_name: string | null
          size: string | null
          sub_category: string | null
          transaction_date: string | null
          transaction_id: string | null
          transaction_type: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          absolute_quantity?: number | null
          agency_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          absolute_quantity?: number | null
          agency_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      external_inventory_management: {
        Row: {
          absolute_quantity: number | null
          agency_id: string
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          category: string | null
          color: string
          created_at: string | null
          external_id: string | null
          external_reference: string | null
          external_source: string | null
          id: string
          is_stock_in: boolean | null
          matched_product_id: string | null
          notes: string | null
          product_code: string | null
          product_name: string
          quantity: number
          reference_name: string | null
          requested_by: string | null
          requested_by_name: string | null
          size: string
          sub_category: string | null
          transaction_date: string
          transaction_id: string | null
          transaction_type: string
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          absolute_quantity?: number | null
          agency_id: string
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category?: string | null
          color?: string
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string
          is_stock_in?: boolean | null
          matched_product_id?: string | null
          notes?: string | null
          product_code?: string | null
          product_name: string
          quantity: number
          reference_name?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          size?: string
          sub_category?: string | null
          transaction_date?: string
          transaction_id?: string | null
          transaction_type: string
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          absolute_quantity?: number | null
          agency_id?: string
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category?: string | null
          color?: string
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string
          is_stock_in?: boolean | null
          matched_product_id?: string | null
          notes?: string | null
          product_code?: string | null
          product_name?: string
          quantity?: number
          reference_name?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          size?: string
          sub_category?: string | null
          transaction_date?: string
          transaction_id?: string | null
          transaction_type?: string
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_requested_by"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_invoice_lines: {
        Row: {
          created_at: string | null
          cross_project_source_line_id: string | null
          cross_project_synced_at: string | null
          external_invoice_id: string | null
          id: string
          qty_delivered: number | null
          quantity: number | null
        }
        Insert: {
          created_at?: string | null
          cross_project_source_line_id?: string | null
          cross_project_synced_at?: string | null
          external_invoice_id?: string | null
          id?: string
          qty_delivered?: number | null
          quantity?: number | null
        }
        Update: {
          created_at?: string | null
          cross_project_source_line_id?: string | null
          cross_project_synced_at?: string | null
          external_invoice_id?: string | null
          id?: string
          qty_delivered?: number | null
          quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_invoice_lines_external_invoice_id_fkey"
            columns: ["external_invoice_id"]
            isOneToOne: false
            referencedRelation: "cross_project_synced_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_invoice_lines_external_invoice_id_fkey"
            columns: ["external_invoice_id"]
            isOneToOne: false
            referencedRelation: "external_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      external_invoices: {
        Row: {
          agency_id: string | null
          amount_total: number | null
          created_at: string
          cross_project_metadata: Json | null
          cross_project_source_id: string | null
          cross_project_source_url: string | null
          cross_project_sync_enabled: boolean | null
          cross_project_sync_version: number | null
          cross_project_synced_at: string | null
          currency: string | null
          description: string | null
          discount_amount: number | null
          id: string
          invoice_date: string
          invoice_number: string | null
          partner_name: string
          product_category: string | null
          product_name: string | null
          quantity: number | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          amount_total?: number | null
          created_at?: string
          cross_project_metadata?: Json | null
          cross_project_source_id?: string | null
          cross_project_source_url?: string | null
          cross_project_sync_enabled?: boolean | null
          cross_project_sync_version?: number | null
          cross_project_synced_at?: string | null
          currency?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date: string
          invoice_number?: string | null
          partner_name: string
          product_category?: string | null
          product_name?: string | null
          quantity?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          amount_total?: number | null
          created_at?: string
          cross_project_metadata?: Json | null
          cross_project_source_id?: string | null
          cross_project_source_url?: string | null
          cross_project_sync_enabled?: boolean | null
          cross_project_sync_version?: number | null
          cross_project_synced_at?: string | null
          currency?: string | null
          description?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          partner_name?: string
          product_category?: string | null
          product_name?: string | null
          quantity?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      external_sales_targets: {
        Row: {
          created_at: string
          customer_name: string
          description: string | null
          id: string
          product_category: string
          quarter: string
          target_amount: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          customer_name: string
          description?: string | null
          id?: string
          product_category: string
          quarter: string
          target_amount?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          customer_name?: string
          description?: string | null
          id?: string
          product_category?: string
          quarter?: string
          target_amount?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      external_stock_adjustments: {
        Row: {
          adjustment_quantity: number
          adjustment_type: string
          agency_id: string
          batch_id: string | null
          batch_name: string | null
          category: string | null
          color: string
          created_at: string | null
          current_stock: number
          external_source: string | null
          id: string
          new_stock: number
          notes: string | null
          product_code: string | null
          product_name: string
          reason: string
          reference_id: string | null
          requested_at: string | null
          requested_by: string
          requested_by_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_name: string | null
          size: string
          status: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          adjustment_quantity: number
          adjustment_type?: string
          agency_id: string
          batch_id?: string | null
          batch_name?: string | null
          category?: string | null
          color?: string
          created_at?: string | null
          current_stock?: number
          external_source?: string | null
          id?: string
          new_stock: number
          notes?: string | null
          product_code?: string | null
          product_name: string
          reason: string
          reference_id?: string | null
          requested_at?: string | null
          requested_by: string
          requested_by_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          size?: string
          status?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          adjustment_quantity?: number
          adjustment_type?: string
          agency_id?: string
          batch_id?: string | null
          batch_name?: string | null
          category?: string | null
          color?: string
          created_at?: string | null
          current_stock?: number
          external_source?: string | null
          id?: string
          new_stock?: number
          notes?: string | null
          product_code?: string | null
          product_name?: string
          reason?: string
          reference_id?: string | null
          requested_at?: string | null
          requested_by?: string
          requested_by_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_name?: string | null
          size?: string
          status?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      external_sync_backup: {
        Row: {
          absolute_quantity: number | null
          agency_id: string | null
          category: string | null
          color: string | null
          created_at: string | null
          external_id: string | null
          external_reference: string | null
          external_source: string | null
          id: string | null
          is_stock_in: boolean | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          reference_name: string | null
          size: string | null
          sub_category: string | null
          transaction_date: string | null
          transaction_id: string | null
          transaction_type: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          absolute_quantity?: number | null
          agency_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          absolute_quantity?: number | null
          agency_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      external_target_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          external_customer_name: string
          id: string
          local_name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_customer_name: string
          id?: string
          local_name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_customer_name?: string
          id?: string
          local_name?: string
          notes?: string | null
        }
        Relationships: []
      }
      fuel_recharges: {
        Row: {
          agency_id: string
          bill_photo_path: string
          bill_photo_url: string
          created_at: string
          id: string
          notes: string | null
          occurred_at: string
          odometer_km: number
          user_id: string
        }
        Insert: {
          agency_id: string
          bill_photo_path: string
          bill_photo_url: string
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          odometer_km: number
          user_id: string
        }
        Update: {
          agency_id?: string
          bill_photo_path?: string
          bill_photo_url?: string
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          odometer_km?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_recharges_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fuel_recharges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      global_bot_sync_log: {
        Row: {
          created_at: string | null
          created_transactions: number | null
          details: Json | null
          id: number
          matched_products: number | null
          message: string | null
          processed_invoices: number | null
          processing_duration_ms: number | null
          status: string
          sync_timestamp: string | null
          triggered_by: string | null
          unmatched_products: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_transactions?: number | null
          details?: Json | null
          id?: number
          matched_products?: number | null
          message?: string | null
          processed_invoices?: number | null
          processing_duration_ms?: number | null
          status: string
          sync_timestamp?: string | null
          triggered_by?: string | null
          unmatched_products?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_transactions?: number | null
          details?: Json | null
          id?: number
          matched_products?: number | null
          message?: string | null
          processed_invoices?: number | null
          processing_duration_ms?: number | null
          status?: string
          sync_timestamp?: string | null
          triggered_by?: string | null
          unmatched_products?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      grn_items: {
        Row: {
          color: string
          grn_id: string | null
          id: string
          product_name: string
          quantity: number
          size: string
          total: number
          unit_price: number
        }
        Insert: {
          color: string
          grn_id?: string | null
          id?: string
          product_name: string
          quantity?: number
          size: string
          total: number
          unit_price: number
        }
        Update: {
          color?: string
          grn_id?: string | null
          id?: string
          product_name?: string
          quantity?: number
          size?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
        ]
      }
      grns: {
        Row: {
          agency_id: string
          agency_name: string
          assigned_at: string | null
          created_at: string | null
          id: string
          invoice_file_name: string
          invoice_id: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["grn_status"] | null
          total: number
          uploaded_by: string | null
        }
        Insert: {
          agency_id: string
          agency_name: string
          assigned_at?: string | null
          created_at?: string | null
          id?: string
          invoice_file_name: string
          invoice_id: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["grn_status"] | null
          total?: number
          uploaded_by?: string | null
        }
        Update: {
          agency_id?: string
          agency_name?: string
          assigned_at?: string | null
          created_at?: string | null
          id?: string
          invoice_file_name?: string
          invoice_id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["grn_status"] | null
          total?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_stock_movements: {
        Row: {
          agency_id: string
          category: string | null
          color: string
          created_at: string | null
          external_document_number: string | null
          external_product_category: string | null
          external_product_name: string | null
          external_reference_id: string | null
          external_source: string
          id: string
          inventory_transaction_id: string | null
          match_confidence: number | null
          movement_type: string
          processed_at: string | null
          processed_to_inventory: boolean | null
          processing_attempts: number | null
          processing_error: string | null
          product_id: string | null
          product_name: string
          quantity: number
          size: string
          source_customer_name: string | null
          source_document_date: string | null
          source_document_type: string
          source_notes: string | null
          sub_category: string | null
          sync_id: string | null
          total_value: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          category?: string | null
          color?: string
          created_at?: string | null
          external_document_number?: string | null
          external_product_category?: string | null
          external_product_name?: string | null
          external_reference_id?: string | null
          external_source: string
          id?: string
          inventory_transaction_id?: string | null
          match_confidence?: number | null
          movement_type: string
          processed_at?: string | null
          processed_to_inventory?: boolean | null
          processing_attempts?: number | null
          processing_error?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          size?: string
          source_customer_name?: string | null
          source_document_date?: string | null
          source_document_type: string
          source_notes?: string | null
          sub_category?: string | null
          sync_id?: string | null
          total_value?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          category?: string | null
          color?: string
          created_at?: string | null
          external_document_number?: string | null
          external_product_category?: string | null
          external_product_name?: string | null
          external_reference_id?: string | null
          external_source?: string
          id?: string
          inventory_transaction_id?: string | null
          match_confidence?: number | null
          movement_type?: string
          processed_at?: string | null
          processed_to_inventory?: boolean | null
          processing_attempts?: number | null
          processing_error?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string
          source_customer_name?: string | null
          source_document_date?: string | null
          source_document_type?: string
          source_notes?: string | null
          sub_category?: string | null
          sync_id?: string | null
          total_value?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_internal_movements_agency"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_inventory_transaction"
            columns: ["inventory_transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_ignored_products: {
        Row: {
          created_at: string
          created_by: string | null
          product_name: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          product_name: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          product_name?: string
          reason?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          agency_id: string
          color: string
          current_stock: number
          id: string
          last_updated: string
          maximum_stock: number | null
          minimum_stock: number | null
          product_id: string
          product_name: string
          size: string
        }
        Insert: {
          agency_id: string
          color: string
          current_stock?: number
          id?: string
          last_updated?: string
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_id: string
          product_name: string
          size: string
        }
        Update: {
          agency_id?: string
          color?: string
          current_stock?: number
          id?: string
          last_updated?: string
          maximum_stock?: number | null
          minimum_stock?: number | null
          product_id?: string
          product_name?: string
          size?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          agency_id: string
          color: string
          created_at: string
          external_invoice_id: string | null
          external_product_category: string | null
          external_product_name: string | null
          id: string
          notes: string | null
          product_id: string
          product_name: string
          quantity: number
          reference_id: string
          reference_name: string
          size: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          agency_id: string
          color: string
          created_at?: string
          external_invoice_id?: string | null
          external_product_category?: string | null
          external_product_name?: string | null
          id?: string
          notes?: string | null
          product_id: string
          product_name: string
          quantity: number
          reference_id: string
          reference_name: string
          size: string
          transaction_type: string
          user_id: string
        }
        Update: {
          agency_id?: string
          color?: string
          created_at?: string
          external_invoice_id?: string | null
          external_product_category?: string | null
          external_product_name?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          reference_id?: string
          reference_name?: string
          size?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          color: string
          id: string
          invoice_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          size: string
          total: number
          unit_price: number
        }
        Insert: {
          color: string
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          size: string
          total: number
          unit_price: number
        }
        Update: {
          color?: string
          id?: string
          invoice_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_items_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          agency_id: string
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string
          discount_amount: number | null
          id: string
          invoice_number: string | null
          latitude: number | null
          longitude: number | null
          sales_order_id: string | null
          signature: string | null
          subtotal: number
          total: number
        }
        Insert: {
          agency_id: string
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          discount_amount?: number | null
          id?: string
          invoice_number?: string | null
          latitude?: number | null
          longitude?: number | null
          sales_order_id?: string | null
          signature?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          agency_id?: string
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_amount?: number | null
          id?: string
          invoice_number?: string | null
          latitude?: number | null
          longitude?: number | null
          sales_order_id?: string | null
          signature?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      non_productive_visits: {
        Row: {
          agency_id: string
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string | null
          id: string
          latitude: number
          longitude: number
          notes: string | null
          potential_customer: string | null
          reason: string
          store_front_photo: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          latitude: number
          longitude: number
          notes?: string | null
          potential_customer?: string | null
          reason: string
          store_front_photo?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          potential_customer?: string | null
          reason?: string
          store_front_photo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "non_productive_visits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_invoice_items: {
        Row: {
          created_at: string
          description: string | null
          discount: number | null
          id: string
          odoo_invoice_id: string
          odoo_product_id: number | null
          price_subtotal: number
          price_tax: number
          price_total: number
          product_default_code: string | null
          product_name: string
          quantity: number
          sequence: number | null
          unit_price: number
          uom_id: number | null
          uom_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount?: number | null
          id?: string
          odoo_invoice_id: string
          odoo_product_id?: number | null
          price_subtotal?: number
          price_tax?: number
          price_total?: number
          product_default_code?: string | null
          product_name: string
          quantity?: number
          sequence?: number | null
          unit_price?: number
          uom_id?: number | null
          uom_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount?: number | null
          id?: string
          odoo_invoice_id?: string
          odoo_product_id?: number | null
          price_subtotal?: number
          price_tax?: number
          price_total?: number
          product_default_code?: string | null
          product_name?: string
          quantity?: number
          sequence?: number | null
          unit_price?: number
          uom_id?: number | null
          uom_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "odoo_invoice_items_odoo_invoice_id_fkey"
            columns: ["odoo_invoice_id"]
            isOneToOne: false
            referencedRelation: "odoo_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      odoo_invoices: {
        Row: {
          agency_id: string
          amount_tax: number
          amount_total: number
          amount_untaxed: number
          created_at: string
          currency_id: number | null
          currency_symbol: string | null
          due_date: string | null
          error_message: string | null
          id: string
          invoice_date: string
          invoice_type: string | null
          last_updated_at: string
          notes: string | null
          odoo_id: number
          odoo_name: string
          partner_address: string | null
          partner_email: string | null
          partner_id: number | null
          partner_name: string
          partner_phone: string | null
          payment_state: string | null
          reference: string | null
          state: string
          sync_status: string | null
          synced_at: string
          terms_conditions: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount_tax?: number
          amount_total?: number
          amount_untaxed?: number
          created_at?: string
          currency_id?: number | null
          currency_symbol?: string | null
          due_date?: string | null
          error_message?: string | null
          id?: string
          invoice_date: string
          invoice_type?: string | null
          last_updated_at?: string
          notes?: string | null
          odoo_id: number
          odoo_name: string
          partner_address?: string | null
          partner_email?: string | null
          partner_id?: number | null
          partner_name: string
          partner_phone?: string | null
          payment_state?: string | null
          reference?: string | null
          state?: string
          sync_status?: string | null
          synced_at?: string
          terms_conditions?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount_tax?: number
          amount_total?: number
          amount_untaxed?: number
          created_at?: string
          currency_id?: number | null
          currency_symbol?: string | null
          due_date?: string | null
          error_message?: string | null
          id?: string
          invoice_date?: string
          invoice_type?: string | null
          last_updated_at?: string
          notes?: string | null
          odoo_id?: number
          odoo_name?: string
          partner_address?: string | null
          partner_email?: string | null
          partner_id?: number | null
          partner_name?: string
          partner_phone?: string | null
          payment_state?: string | null
          reference?: string | null
          state?: string
          sync_status?: string | null
          synced_at?: string
          terms_conditions?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      odoo_partner_mappings: {
        Row: {
          agency_id: string
          agency_name: string | null
          created_at: string
          created_by: string | null
          id: string
          partner_name: string
        }
        Insert: {
          agency_id: string
          agency_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          partner_name: string
        }
        Update: {
          agency_id?: string
          agency_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          partner_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "odoo_partner_mappings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          billing_price: number
          color: string
          created_at: string | null
          id: string
          product_id: string | null
          selling_price: number
          size: string
          sku: string
        }
        Insert: {
          billing_price: number
          color: string
          created_at?: string | null
          id?: string
          product_id?: string | null
          selling_price: number
          size: string
          sku: string
        }
        Update: {
          billing_price?: number
          color?: string
          created_at?: string | null
          id?: string
          product_id?: string | null
          selling_price?: number
          size?: string
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          billing_price: number
          category: string
          colors: string[] | null
          created_at: string | null
          description: string | null
          id: string
          image: string | null
          is_active: boolean
          name: string
          selling_price: number
          sizes: string[] | null
          sub_category: string | null
        }
        Insert: {
          billing_price?: number
          category: string
          colors?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          name: string
          selling_price?: number
          sizes?: string[] | null
          sub_category?: string | null
        }
        Update: {
          billing_price?: number
          category?: string
          colors?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          name?: string
          selling_price?: number
          sizes?: string[] | null
          sub_category?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_id: string | null
          agency_name: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          agency_name?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          agency_name?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      promotional_rules: {
        Row: {
          agent_ids: string[] | null
          agent_names: string[] | null
          applicable_to: Database["public"]["Enums"]["applicable_to"]
          buy_product_ids: string[] | null
          buy_product_names: string[] | null
          buy_quantity: number
          created_at: string | null
          created_by: string | null
          current_usage_count: number | null
          customer_ids: string[] | null
          customer_names: string[] | null
          description: string | null
          discount_percentage: number | null
          get_product_ids: string[] | null
          get_product_names: string[] | null
          get_quantity: number
          id: string
          is_active: boolean | null
          max_usage_count: number | null
          name: string
          type: Database["public"]["Enums"]["promotional_type"]
          valid_from: string
          valid_to: string
        }
        Insert: {
          agent_ids?: string[] | null
          agent_names?: string[] | null
          applicable_to: Database["public"]["Enums"]["applicable_to"]
          buy_product_ids?: string[] | null
          buy_product_names?: string[] | null
          buy_quantity: number
          created_at?: string | null
          created_by?: string | null
          current_usage_count?: number | null
          customer_ids?: string[] | null
          customer_names?: string[] | null
          description?: string | null
          discount_percentage?: number | null
          get_product_ids?: string[] | null
          get_product_names?: string[] | null
          get_quantity: number
          id?: string
          is_active?: boolean | null
          max_usage_count?: number | null
          name: string
          type: Database["public"]["Enums"]["promotional_type"]
          valid_from: string
          valid_to: string
        }
        Update: {
          agent_ids?: string[] | null
          agent_names?: string[] | null
          applicable_to?: Database["public"]["Enums"]["applicable_to"]
          buy_product_ids?: string[] | null
          buy_product_names?: string[] | null
          buy_quantity?: number
          created_at?: string | null
          created_by?: string | null
          current_usage_count?: number | null
          customer_ids?: string[] | null
          customer_names?: string[] | null
          description?: string | null
          discount_percentage?: number | null
          get_product_ids?: string[] | null
          get_product_names?: string[] | null
          get_quantity?: number
          id?: string
          is_active?: boolean | null
          max_usage_count?: number | null
          name?: string
          type?: Database["public"]["Enums"]["promotional_type"]
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotional_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          color: string
          id: string
          product_id: string | null
          product_name: string
          purchase_order_id: string | null
          quantity: number
          size: string
          total: number
          unit_price: number
        }
        Insert: {
          color: string
          id?: string
          product_id?: string | null
          product_name: string
          purchase_order_id?: string | null
          quantity?: number
          size: string
          total: number
          unit_price: number
        }
        Update: {
          color?: string
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_order_id?: string | null
          quantity?: number
          size?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_order_items_purchase_order"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          agency_id: string
          agency_name: string
          created_at: string | null
          created_by: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          status: Database["public"]["Enums"]["purchase_order_status"] | null
          total: number
        }
        Insert: {
          agency_id: string
          agency_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"] | null
          total?: number
        }
        Update: {
          agency_id?: string
          agency_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"] | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quarterly_targets: {
        Row: {
          achieved_amount: number | null
          agency_id: string | null
          agency_name: string | null
          created_at: string | null
          created_by: string | null
          id: string
          product_category: string
          quarter: Database["public"]["Enums"]["quarter"]
          target_amount: number
          updated_at: string | null
          year: number
        }
        Insert: {
          achieved_amount?: number | null
          agency_id?: string | null
          agency_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_category: string
          quarter: Database["public"]["Enums"]["quarter"]
          target_amount?: number
          updated_at?: string | null
          year: number
        }
        Update: {
          achieved_amount?: number | null
          agency_id?: string | null
          agency_name?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          product_category?: string
          quarter?: Database["public"]["Enums"]["quarter"]
          target_amount?: number
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_targets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          color: string
          id: string
          invoice_item_id: string | null
          original_quantity: number
          product_id: string | null
          product_name: string
          quantity_returned: number
          reason: string | null
          return_id: string | null
          size: string
          total: number
          unit_price: number
        }
        Insert: {
          color: string
          id?: string
          invoice_item_id?: string | null
          original_quantity: number
          product_id?: string | null
          product_name: string
          quantity_returned: number
          reason?: string | null
          return_id?: string | null
          size: string
          total: number
          unit_price: number
        }
        Update: {
          color?: string
          id?: string
          invoice_item_id?: string | null
          original_quantity?: number
          product_id?: string | null
          product_name?: string
          quantity_returned?: number
          reason?: string | null
          return_id?: string | null
          size?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "return_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "returns"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          agency_id: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string
          id: string
          invoice_id: string | null
          latitude: number | null
          longitude: number | null
          processed_at: string | null
          processed_by: string | null
          reason: string
          status: Database["public"]["Enums"]["return_status"] | null
          subtotal: number
          total: number
        }
        Insert: {
          agency_id: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          invoice_id?: string | null
          latitude?: number | null
          longitude?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reason: string
          status?: Database["public"]["Enums"]["return_status"] | null
          subtotal?: number
          total?: number
        }
        Update: {
          agency_id?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          invoice_id?: string | null
          latitude?: number | null
          longitude?: number | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["return_status"] | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_applications: {
        Row: {
          applied_amount: number
          applied_at: string | null
          id: string
          order_id: string
          rule_id: string
          rule_type: Database["public"]["Enums"]["rule_type"]
        }
        Insert: {
          applied_amount: number
          applied_at?: string | null
          id?: string
          order_id: string
          rule_id: string
          rule_type: Database["public"]["Enums"]["rule_type"]
        }
        Update: {
          applied_amount?: number
          applied_at?: string | null
          id?: string
          order_id?: string
          rule_id?: string
          rule_type?: Database["public"]["Enums"]["rule_type"]
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          color: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sales_order_id: string | null
          size: string
          total: number
          unit_price: number
        }
        Insert: {
          color: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sales_order_id?: string | null
          size: string
          total: number
          unit_price: number
        }
        Update: {
          color?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sales_order_id?: string | null
          size?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_order_items_sales_order"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          agency_id: string
          approved_at: string | null
          approved_by: string | null
          client_request_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          customer_name: string
          discount_amount: number | null
          discount_percentage: number | null
          id: string
          latitude: number | null
          longitude: number | null
          order_number: string | null
          requires_approval: boolean | null
          status: Database["public"]["Enums"]["sales_order_status"] | null
          subtotal: number
          total: number
          total_invoiced: number | null
        }
        Insert: {
          agency_id: string
          approved_at?: string | null
          approved_by?: string | null
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_number?: string | null
          requires_approval?: boolean | null
          status?: Database["public"]["Enums"]["sales_order_status"] | null
          subtotal?: number
          total?: number
          total_invoiced?: number | null
        }
        Update: {
          agency_id?: string
          approved_at?: string | null
          approved_by?: string | null
          client_request_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_amount?: number | null
          discount_percentage?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          order_number?: string | null
          requires_approval?: boolean | null
          status?: Database["public"]["Enums"]["sales_order_status"] | null
          subtotal?: number
          total?: number
          total_invoiced?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sewing_output_record_lines: {
        Row: {
          created_at: string
          id: string
          output_quantity: number
          po_number: string
          purchase_id: string | null
          record_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          output_quantity?: number
          po_number: string
          purchase_id?: string | null
          record_id: string
        }
        Update: {
          created_at?: string
          id?: string
          output_quantity?: number
          po_number?: string
          purchase_id?: string | null
          record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sewing_output_record_lines_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "sewing_output_records"
            referencedColumns: ["id"]
          },
        ]
      }
      sewing_output_records: {
        Row: {
          created_at: string
          id: string
          output_code: string
          supplier_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          output_code?: string
          supplier_name: string
        }
        Update: {
          created_at?: string
          id?: string
          output_code?: string
          supplier_name?: string
        }
        Relationships: []
      }
      stock_adjustment_reasons: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          reason: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          reason: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          reason?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          adjustment_type: string
          agency_id: string
          color: string
          created_at: string | null
          current_stock: number
          id: string
          justification: string | null
          new_stock: number
          product_id: string
          product_name: string
          quantity: number
          reason: string
          requested_at: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size: string
          status: string
          updated_at: string | null
        }
        Insert: {
          adjustment_type: string
          agency_id: string
          color: string
          created_at?: string | null
          current_stock: number
          id?: string
          justification?: string | null
          new_stock: number
          product_id: string
          product_name: string
          quantity: number
          reason: string
          requested_at?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          adjustment_type?: string
          agency_id?: string
          color?: string
          created_at?: string | null
          current_stock?: number
          id?: string
          justification?: string | null
          new_stock?: number
          product_id?: string
          product_name?: string
          quantity?: number
          reason?: string
          requested_at?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_tracking: {
        Row: {
          agency_id: string
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_in_time: string
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          clock_out_time: string | null
          created_at: string
          date: string
          id: string
          total_hours: string | null
          user_id: string
        }
        Insert: {
          agency_id: string
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_in_time: string
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          clock_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          total_hours?: string | null
          user_id: string
        }
        Update: {
          agency_id?: string
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_in_time?: string
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          clock_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          total_hours?: string | null
          user_id?: string
        }
        Relationships: []
      }
      time_tracking_odometer_entries: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          odometer_km: number
          photo_path: string
          photo_url: string
          time_tracking_id: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          odometer_km: number
          photo_path: string
          photo_url: string
          time_tracking_id: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          odometer_km?: number
          photo_path?: string
          photo_url?: string
          time_tracking_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_tracking_odometer_entries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_tracking_odometer_entries_time_tracking_id_fkey"
            columns: ["time_tracking_id"]
            isOneToOne: false
            referencedRelation: "time_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_tracking_odometer_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_creation_errors: {
        Row: {
          created_at: string | null
          email: string | null
          error_message: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          error_message?: string | null
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      all_sync_activities: {
        Row: {
          created_transactions: number | null
          description: string | null
          details: Json | null
          message: string | null
          processed_count: number | null
          status: string | null
          sync_timestamp: string | null
          sync_type: string | null
        }
        Relationships: []
      }
      auto_sync_stats: {
        Row: {
          avg_duration_ms: number | null
          failed_syncs: number | null
          first_sync_at: string | null
          last_sync_at: string | null
          success_rate_percent: number | null
          successful_syncs: number | null
          syncs_last_24h: number | null
          syncs_last_week: number | null
          total_invoices_synced: number | null
          total_lines_synced: number | null
          total_movements_created: number | null
          total_sync_operations: number | null
        }
        Relationships: []
      }
      cron_sync_requests: {
        Row: {
          action_needed: string | null
          details: Json | null
          message: string | null
          status: string | null
          sync_timestamp: string | null
          synced_count: number | null
        }
        Insert: {
          action_needed?: never
          details?: Json | null
          message?: string | null
          status?: string | null
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Update: {
          action_needed?: never
          details?: Json | null
          message?: string | null
          status?: string | null
          sync_timestamp?: string | null
          synced_count?: number | null
        }
        Relationships: []
      }
      cross_project_sync_stats: {
        Row: {
          first_sync_at: string | null
          last_sync_at: string | null
          synced_agencies: number | null
          synced_last_24h: number | null
          synced_last_week: number | null
          total_synced_invoices: number | null
          total_synced_value: number | null
        }
        Relationships: []
      }
      cross_project_synced_invoices: {
        Row: {
          agency_id: string | null
          amount_total: number | null
          created_at: string | null
          cross_project_metadata: Json | null
          cross_project_source_id: string | null
          cross_project_source_url: string | null
          cross_project_sync_enabled: boolean | null
          cross_project_sync_version: number | null
          cross_project_synced_at: string | null
          currency: string | null
          description: string | null
          discount_amount: number | null
          id: string | null
          invoice_date: string | null
          invoice_number: string | null
          line_count: number | null
          partner_name: string | null
          product_category: string | null
          product_name: string | null
          quantity: number | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          total_delivered: number | null
          total_quantity: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      delivery_summary: {
        Row: {
          agency_id: string | null
          customer_name: string | null
          delivered_at: string | null
          delivery_agent_id: string | null
          delivery_agent_name: string | null
          id: string | null
          invoice_id: string | null
          invoice_total: number | null
          scheduled_date: string | null
          status: string | null
          total_items: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      external_bot_cron_history: {
        Row: {
          active: boolean | null
          end_time: string | null
          jobname: string | null
          return_message: string | null
          schedule: string | null
          start_time: string | null
          status: string | null
        }
        Relationships: []
      }
      external_bot_invoices_monthly: {
        Row: {
          avg_amount: number | null
          invoice_count: number | null
          month: string | null
          state: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      external_bot_invoices_summary: {
        Row: {
          agency_match: string | null
          amount_total: number | null
          currency_id: string | null
          customer_name: string | null
          date_order: string | null
          id: number | null
          invoice_number: string | null
          payment_state: string | null
          state: string | null
          sync_timestamp: string | null
        }
        Insert: {
          agency_match?: string | null
          amount_total?: number | null
          currency_id?: string | null
          customer_name?: string | null
          date_order?: string | null
          id?: number | null
          invoice_number?: string | null
          payment_state?: string | null
          state?: string | null
          sync_timestamp?: string | null
        }
        Update: {
          agency_match?: string | null
          amount_total?: number | null
          currency_id?: string | null
          customer_name?: string | null
          date_order?: string | null
          id?: number | null
          invoice_number?: string | null
          payment_state?: string | null
          state?: string | null
          sync_timestamp?: string | null
        }
        Relationships: []
      }
      external_inventory_approved: {
        Row: {
          absolute_quantity: number | null
          agency_id: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          category: string | null
          color: string | null
          created_at: string | null
          external_id: string | null
          external_reference: string | null
          external_source: string | null
          id: string | null
          is_stock_in: boolean | null
          matched_product_id: string | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          reference_name: string | null
          requested_by: string | null
          requested_by_name: string | null
          size: string | null
          sub_category: string | null
          transaction_date: string | null
          transaction_id: string | null
          transaction_type: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          absolute_quantity?: number | null
          agency_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          matched_product_id?: string | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          absolute_quantity?: number | null
          agency_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          matched_product_id?: string | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_requested_by"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_inventory_by_type: {
        Row: {
          agency_id: string | null
          avg_price: number | null
          color: string | null
          last_transaction: string | null
          net_quantity: number | null
          product_name: string | null
          size: string | null
          transaction_count: number | null
          transaction_type: string | null
        }
        Relationships: []
      }
      external_inventory_pending: {
        Row: {
          absolute_quantity: number | null
          agency_id: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          category: string | null
          color: string | null
          created_at: string | null
          external_id: string | null
          external_reference: string | null
          external_source: string | null
          id: string | null
          is_stock_in: boolean | null
          matched_product_id: string | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          reference_name: string | null
          requested_by: string | null
          requested_by_name: string | null
          size: string | null
          sub_category: string | null
          transaction_date: string | null
          transaction_id: string | null
          transaction_type: string | null
          unit_price: number | null
          updated_at: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          absolute_quantity?: number | null
          agency_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          matched_product_id?: string | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          absolute_quantity?: number | null
          agency_id?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_id?: string | null
          external_reference?: string | null
          external_source?: string | null
          id?: string | null
          is_stock_in?: boolean | null
          matched_product_id?: string | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          requested_by?: string | null
          requested_by_name?: string | null
          size?: string | null
          sub_category?: string | null
          transaction_date?: string | null
          transaction_id?: string | null
          transaction_type?: string | null
          unit_price?: number | null
          updated_at?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_approved_by"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_requested_by"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_inventory_stock_summary: {
        Row: {
          agency_id: string | null
          avg_unit_price: number | null
          category: string | null
          color: string | null
          current_stock: number | null
          first_transaction_date: string | null
          last_transaction_date: string | null
          matched_product_id: string | null
          product_name: string | null
          size: string | null
          sub_category: string | null
          total_stock_in: number | null
          total_stock_out: number | null
          transaction_count: number | null
          variant_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_inventory_management_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_external_inv_matched_product"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_inventory_transactions: {
        Row: {
          agency_id: string | null
          category: string | null
          color: string | null
          external_id: string | null
          external_source: string | null
          id: string | null
          movement_type: string | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          quantity: number | null
          reference_name: string | null
          size: string | null
          transaction_date: string | null
          transaction_type: string | null
          user_name: string | null
        }
        Insert: {
          agency_id?: string | null
          category?: string | null
          color?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string | null
          movement_type?: never
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          size?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
          user_name?: string | null
        }
        Update: {
          agency_id?: string | null
          category?: string | null
          color?: string | null
          external_id?: string | null
          external_source?: string | null
          id?: string | null
          movement_type?: never
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          quantity?: number | null
          reference_name?: string | null
          size?: string | null
          transaction_date?: string | null
          transaction_type?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      external_stock_adjustments_history: {
        Row: {
          adjustment_quantity: number | null
          adjustment_type: string | null
          agency_id: string | null
          batch_id: string | null
          batch_name: string | null
          category: string | null
          color: string | null
          current_stock: number | null
          id: string | null
          new_stock: number | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          reason: string | null
          requested_at: string | null
          requested_by_name: string | null
          reviewed_at: string | null
          reviewed_by_name: string | null
          size: string | null
          status: string | null
        }
        Insert: {
          adjustment_quantity?: number | null
          adjustment_type?: string | null
          agency_id?: string | null
          batch_id?: string | null
          batch_name?: string | null
          category?: string | null
          color?: string | null
          current_stock?: number | null
          id?: string | null
          new_stock?: number | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          reason?: string | null
          requested_at?: string | null
          requested_by_name?: string | null
          reviewed_at?: string | null
          reviewed_by_name?: string | null
          size?: string | null
          status?: string | null
        }
        Update: {
          adjustment_quantity?: number | null
          adjustment_type?: string | null
          agency_id?: string | null
          batch_id?: string | null
          batch_name?: string | null
          category?: string | null
          color?: string | null
          current_stock?: number | null
          id?: string | null
          new_stock?: number | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          reason?: string | null
          requested_at?: string | null
          requested_by_name?: string | null
          reviewed_at?: string | null
          reviewed_by_name?: string | null
          size?: string | null
          status?: string | null
        }
        Relationships: []
      }
      external_stock_adjustments_pending: {
        Row: {
          adjustment_quantity: number | null
          adjustment_type: string | null
          agency_id: string | null
          batch_id: string | null
          batch_name: string | null
          category: string | null
          color: string | null
          current_stock: number | null
          id: string | null
          new_stock: number | null
          notes: string | null
          product_code: string | null
          product_name: string | null
          reason: string | null
          requested_at: string | null
          requested_by_name: string | null
          size: string | null
        }
        Insert: {
          adjustment_quantity?: number | null
          adjustment_type?: string | null
          agency_id?: string | null
          batch_id?: string | null
          batch_name?: string | null
          category?: string | null
          color?: string | null
          current_stock?: number | null
          id?: string | null
          new_stock?: number | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          reason?: string | null
          requested_at?: string | null
          requested_by_name?: string | null
          size?: string | null
        }
        Update: {
          adjustment_quantity?: number | null
          adjustment_type?: string | null
          agency_id?: string | null
          batch_id?: string | null
          batch_name?: string | null
          category?: string | null
          color?: string | null
          current_stock?: number | null
          id?: string | null
          new_stock?: number | null
          notes?: string | null
          product_code?: string | null
          product_name?: string | null
          reason?: string | null
          requested_at?: string | null
          requested_by_name?: string | null
          size?: string | null
        }
        Relationships: []
      }
      global_sync_requests: {
        Row: {
          action_needed: string | null
          created_at: string | null
          created_transactions: number | null
          id: number | null
          matched_products: number | null
          message: string | null
          processed_invoices: number | null
          processing_duration_ms: number | null
          status: string | null
          sync_timestamp: string | null
          triggered_by: string | null
          unmatched_products: number | null
          updated_at: string | null
        }
        Insert: {
          action_needed?: never
          created_at?: string | null
          created_transactions?: number | null
          id?: number | null
          matched_products?: number | null
          message?: string | null
          processed_invoices?: number | null
          processing_duration_ms?: number | null
          status?: string | null
          sync_timestamp?: string | null
          triggered_by?: string | null
          unmatched_products?: number | null
          updated_at?: string | null
        }
        Update: {
          action_needed?: never
          created_at?: string | null
          created_transactions?: number | null
          id?: number | null
          matched_products?: number | null
          message?: string | null
          processed_invoices?: number | null
          processing_duration_ms?: number | null
          status?: string | null
          sync_timestamp?: string | null
          triggered_by?: string | null
          unmatched_products?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      internal_stock_movements_summary: {
        Row: {
          agency_id: string | null
          color: string | null
          last_movement_at: string | null
          movement_count: number | null
          net_movement: number | null
          product_id: string | null
          product_name: string | null
          size: string | null
          total_stock_in: number | null
          total_stock_out: number | null
          total_value_moved: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_internal_movements_agency"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_auto_sync_activity: {
        Row: {
          created_at: string | null
          cross_project_invoices_synced: number | null
          cross_project_lines_synced: number | null
          duration_ms: number | null
          internal_movements_created: number | null
          message: string | null
          phases_completed: Json | null
          row_num: number | null
          status: string | null
          sync_id: string | null
          total_errors: number | null
        }
        Relationships: []
      }
      recent_cross_project_sync_activity: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          errors_count: number | null
          invoices_skipped: number | null
          invoices_synced: number | null
          lines_synced: number | null
          message: string | null
          row_num: number | null
          status: string | null
          sync_id: string | null
        }
        Relationships: []
      }
      sortedproducts: {
        Row: {
          billing_price: number | null
          category: string | null
          colors: string[] | null
          created_at: string | null
          description: string | null
          id: string | null
          image: string | null
          name: string | null
          selling_price: number | null
          size: string | null
          sizes: string[] | null
          sub_category: string | null
        }
        Insert: {
          billing_price?: number | null
          category?: string | null
          colors?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image?: string | null
          name?: string | null
          selling_price?: number | null
          size?: never
          sizes?: string[] | null
          sub_category?: string | null
        }
        Update: {
          billing_price?: number | null
          category?: string | null
          colors?: string[] | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image?: string | null
          name?: string | null
          selling_price?: number | null
          size?: never
          sizes?: string[] | null
          sub_category?: string | null
        }
        Relationships: []
      }
      unified_inventory_summary: {
        Row: {
          agency_id: string | null
          avg_unit_price: number | null
          current_stock: number | null
          first_transaction_date: string | null
          last_transaction_date: string | null
          product_display_name: string | null
          product_name: string | null
          stock_status: string | null
          sub_category: string | null
          total_stock_in: number | null
          total_stock_out: number | null
          total_value: number | null
          transaction_count: number | null
          variant_count: number | null
        }
        Relationships: []
      }
      unprocessed_internal_stock_movements: {
        Row: {
          agency_id: string | null
          category: string | null
          color: string | null
          created_at: string | null
          external_document_number: string | null
          external_product_category: string | null
          external_product_name: string | null
          external_reference_id: string | null
          external_source: string | null
          id: string | null
          inventory_transaction_id: string | null
          match_confidence: number | null
          movement_type: string | null
          processed_at: string | null
          processed_to_inventory: boolean | null
          processing_attempts: number | null
          processing_error: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          size: string | null
          source_customer_name: string | null
          source_document_date: string | null
          source_document_type: string | null
          source_notes: string | null
          sub_category: string | null
          sync_id: string | null
          total_value: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          agency_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_document_number?: string | null
          external_product_category?: string | null
          external_product_name?: string | null
          external_reference_id?: string | null
          external_source?: string | null
          id?: string | null
          inventory_transaction_id?: string | null
          match_confidence?: number | null
          movement_type?: string | null
          processed_at?: string | null
          processed_to_inventory?: boolean | null
          processing_attempts?: number | null
          processing_error?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          size?: string | null
          source_customer_name?: string | null
          source_document_date?: string | null
          source_document_type?: string | null
          source_notes?: string | null
          sub_category?: string | null
          sync_id?: string | null
          total_value?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string | null
          category?: string | null
          color?: string | null
          created_at?: string | null
          external_document_number?: string | null
          external_product_category?: string | null
          external_product_name?: string | null
          external_reference_id?: string | null
          external_source?: string | null
          id?: string | null
          inventory_transaction_id?: string | null
          match_confidence?: number | null
          movement_type?: string | null
          processed_at?: string | null
          processed_to_inventory?: boolean | null
          processing_attempts?: number | null
          processing_error?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          size?: string | null
          source_customer_name?: string | null
          source_document_date?: string | null
          source_document_type?: string | null
          source_notes?: string | null
          sub_category?: string | null
          sync_id?: string | null
          total_value?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_internal_movements_agency"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_inventory_transaction"
            columns: ["inventory_transaction_id"]
            isOneToOne: false
            referencedRelation: "inventory_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_movements_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "sortedproducts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_external_stock_adjustment: {
        Args: {
          p_adjustment_id: string
          p_reviewer_id: string
          p_reviewer_name: string
        }
        Returns: boolean
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
      create_profile_with_uuid: {
        Args: {
          profile_agency_id?: string
          profile_agency_name?: string
          profile_email: string
          profile_name: string
          profile_role?: Database["public"]["Enums"]["user_role"]
        }
        Returns: string
      }
      external_bot_cron_sync: { Args: never; Returns: undefined }
      generate_invoice_number: { Args: { agency_id: string }; Returns: string }
      generate_sales_order_number: {
        Args: { agency_id: string }
        Returns: string
      }
      get_agency_invoice_prefix: {
        Args: { agency_id: string }
        Returns: string
      }
      get_agency_unified_inventory: {
        Args: { p_agency_id: string }
        Returns: {
          avg_unit_price: number
          last_transaction_date: string
          product_name: string
          total_stock: number
          variant_count: number
        }[]
      }
      get_external_current_stock: {
        Args: {
          p_agency_id: string
          p_color?: string
          p_product_name: string
          p_size?: string
        }
        Returns: number
      }
      get_external_inventory_stock: {
        Args: {
          p_agency_id: string
          p_color?: string
          p_product_name: string
          p_size?: string
        }
        Returns: number
      }
      get_latest_external_bot_sync_status: {
        Args: never
        Returns: {
          last_sync_count: number
          last_sync_message: string
          last_sync_status: string
          last_sync_time: string
        }[]
      }
      get_unified_product_stock: {
        Args: { p_agency_id: string; p_product_name: string }
        Returns: number
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      match_external_inventory_to_products: { Args: never; Returns: undefined }
      process_global_sync_requests: { Args: never; Returns: Json }
      reject_external_stock_adjustment: {
        Args: {
          p_adjustment_id: string
          p_rejection_reason?: string
          p_reviewer_id: string
          p_reviewer_name: string
        }
        Returns: boolean
      }
      run_cross_project_sync: {
        Args: { trigger_time: string }
        Returns: undefined
      }
      setup_sync_config: {
        Args: {
          p_anon_key?: string
          p_service_key?: string
          p_supabase_url?: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_odoo_invoices: {
        Args: {
          p_agency_id: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: Json
      }
      test_automatic_external_bot_sync: { Args: never; Returns: Json }
      test_cron_sync: { Args: never; Returns: Json }
      test_cron_sync_fixed: { Args: never; Returns: Json }
      test_global_sync_cron: { Args: never; Returns: Json }
      test_newsyncodoo_cron: { Args: never; Returns: Json }
      test_sync_config: { Args: never; Returns: Json }
      text_to_bytea: { Args: { data: string }; Returns: string }
      trigger_external_bot_sync: { Args: never; Returns: undefined }
      trigger_external_bot_sync_http: { Args: never; Returns: undefined }
      trigger_global_bot_sync: { Args: never; Returns: undefined }
      trigger_newsyncodoo_sync: { Args: never; Returns: undefined }
      trigger_odoo_last25_sync: { Args: never; Returns: undefined }
      trigger_sync_via_webhook: { Args: never; Returns: undefined }
      update_user_role:
        | {
            Args: {
              new_agency_id?: string
              new_agency_name?: string
              new_role: string
              target_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              new_agency_id?: string
              new_agency_name?: string
              new_role: Database["public"]["Enums"]["user_role"]
              target_user_id: string
            }
            Returns: boolean
          }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      applicable_to: "customer" | "product" | "agent" | "global"
      discount_type: "percentage" | "fixed_amount" | "special_pricing"
      dispute_status: "open" | "in_progress" | "resolved" | "closed"
      dispute_type: "product_category" | "specific_product" | "customer"
      grn_status: "pending" | "accepted" | "rejected"
      priority_level: "low" | "medium" | "high" | "urgent"
      promotional_type:
        | "buy_x_get_y_free"
        | "buy_x_get_y_discount"
        | "bundle_discount"
      purchase_order_status:
        | "pending"
        | "approved"
        | "shipped"
        | "delivered"
        | "cancelled"
      quarter: "Q1" | "Q2" | "Q3" | "Q4"
      return_status: "pending" | "approved" | "processed" | "rejected"
      rule_type: "discount" | "promotional"
      sales_order_status:
        | "pending"
        | "approved"
        | "partially_invoiced"
        | "invoiced"
        | "cancelled"
        | "closed"
      user_role: "agency" | "superuser" | "agent"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      applicable_to: ["customer", "product", "agent", "global"],
      discount_type: ["percentage", "fixed_amount", "special_pricing"],
      dispute_status: ["open", "in_progress", "resolved", "closed"],
      dispute_type: ["product_category", "specific_product", "customer"],
      grn_status: ["pending", "accepted", "rejected"],
      priority_level: ["low", "medium", "high", "urgent"],
      promotional_type: [
        "buy_x_get_y_free",
        "buy_x_get_y_discount",
        "bundle_discount",
      ],
      purchase_order_status: [
        "pending",
        "approved",
        "shipped",
        "delivered",
        "cancelled",
      ],
      quarter: ["Q1", "Q2", "Q3", "Q4"],
      return_status: ["pending", "approved", "processed", "rejected"],
      rule_type: ["discount", "promotional"],
      sales_order_status: [
        "pending",
        "approved",
        "partially_invoiced",
        "invoiced",
        "cancelled",
        "closed",
      ],
      user_role: ["agency", "superuser", "agent"],
    },
  },
} as const
