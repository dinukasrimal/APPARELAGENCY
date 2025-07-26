export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
        ]
      }
      collections: {
        Row: {
          agency_id: string
          cash_amount: number | null
          cash_date: string
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
      customer_assets: {
        Row: {
          asset_type: string
          created_at: string | null
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
          created_at?: string | null
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
          created_at?: string | null
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
          id?: string
          latitude?: number
          longitude?: number
          notes?: string | null
          potential_customer?: string | null
          reason?: string
          store_front_photo?: string | null
          user_id?: string
        }
        Relationships: []
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
          total_hours: unknown | null
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
          total_hours?: unknown | null
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
          total_hours?: unknown | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
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
    }
    Functions: {
      generate_invoice_number: {
        Args: { agency_id: string }
        Returns: string
      }
      generate_sales_order_number: {
        Args: { agency_id: string }
        Returns: string
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      sync_odoo_invoices: {
        Args: {
          p_agency_id: string
          p_start_date?: string
          p_end_date?: string
        }
        Returns: Json
      }
      update_user_role: {
        Args: {
          target_user_id: string
          new_role: Database["public"]["Enums"]["user_role"]
          new_agency_id?: string
          new_agency_name?: string
        }
        Returns: boolean
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
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
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
