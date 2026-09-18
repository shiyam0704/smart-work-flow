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
  public: {
    Tables: {
      account_transfers: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          from_account_id: string
          id: string
          note: string
          reference_no: string
          to_account_id: string
          transfer_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          from_account_id: string
          id?: string
          note?: string
          reference_no?: string
          to_account_id: string
          transfer_date?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          from_account_id?: string
          id?: string
          note?: string
          reference_no?: string
          to_account_id?: string
          transfer_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          changed_fields: Json
          company_id: string | null
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          record_label: string
          table_name: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          changed_fields?: Json
          company_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_label?: string
          table_name: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          changed_fields?: Json
          company_id?: string | null
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_label?: string
          table_name?: string
        }
        Relationships: []
      }
      client_field_definitions: {
        Row: {
          company_id: string | null
          field_type: string
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          field_type: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_groups: {
        Row: {
          company_id: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string
          city: string
          client_group: string
          company_id: string | null
          contact_number: string
          contact_person: string
          created_at: string
          custom_fields: Json
          id: string
          logo: string
          logo_url: string | null
          name: string
          note: string
          status: string
        }
        Insert: {
          address?: string
          city?: string
          client_group?: string
          company_id?: string | null
          contact_number?: string
          contact_person?: string
          created_at?: string
          custom_fields?: Json
          id?: string
          logo?: string
          logo_url?: string | null
          name: string
          note?: string
          status?: string
        }
        Update: {
          address?: string
          city?: string
          client_group?: string
          company_id?: string | null
          contact_number?: string
          contact_person?: string
          created_at?: string
          custom_fields?: Json
          id?: string
          logo?: string
          logo_url?: string | null
          name?: string
          note?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          date_format: string
          id: string
          logo_url: string
          name: string
          slug: string
          status: string
          time_format: string
          timezone: string
        }
        Insert: {
          created_at?: string
          date_format?: string
          id?: string
          logo_url?: string
          name: string
          slug: string
          status?: string
          time_format?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          date_format?: string
          id?: string
          logo_url?: string
          name?: string
          slug?: string
          status?: string
          time_format?: string
          timezone?: string
        }
        Relationships: []
      }
      company_admins: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_admins_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_modules: {
        Row: {
          company_id: string
          enabled: boolean
          id: string
          module_key: string
        }
        Insert: {
          company_id: string
          enabled?: boolean
          id?: string
          module_key: string
        }
        Update: {
          company_id?: string
          enabled?: boolean
          id?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          color: string
          company_id: string | null
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          color?: string
          company_id?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          color?: string
          company_id?: string | null
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_field_definitions: {
        Row: {
          company_id: string | null
          field_type: string
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          field_type: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar: string
          company_id: string | null
          contact_number: string
          created_at: string
          custom_fields: Json
          department_id: string | null
          email: string
          employee_code: string
          id: string
          name: string
          photo_url: string
          role: string
          status: string
          user_id: string | null
        }
        Insert: {
          avatar?: string
          company_id?: string | null
          contact_number?: string
          created_at?: string
          custom_fields?: Json
          department_id?: string | null
          email?: string
          employee_code?: string
          id?: string
          name: string
          photo_url?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          avatar?: string
          company_id?: string | null
          contact_number?: string
          created_at?: string
          custom_fields?: Json
          department_id?: string | null
          email?: string
          employee_code?: string
          id?: string
          name?: string
          photo_url?: string
          role?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          amount: number
          category: string
          company_id: string | null
          created_at: string
          description: string
          expense_id: string
          id: string
          quantity: number
          rate: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string
          expense_id: string
          id?: string
          quantity?: number
          rate?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          company_id?: string | null
          created_at?: string
          description?: string
          expense_id?: string
          id?: string
          quantity?: number
          rate?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          account_id: string | null
          amount: number
          category: string
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          mode: string
          note: string
          project_id: string | null
          spent_on: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          note?: string
          project_id?: string | null
          spent_on?: string
          title?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          note?: string
          project_id?: string | null
          spent_on?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          company_id: string | null
          description: string
          discount_percent: number
          gst_percent: number
          hsn_sac: string
          id: string
          invoice_id: string
          item_id: string | null
          line_total: number
          quantity: number
          rate: number
          sort_order: number
          tax_amount: number
          taxable_amount: number
          unit: string
        }
        Insert: {
          company_id?: string | null
          description?: string
          discount_percent?: number
          gst_percent?: number
          hsn_sac?: string
          id?: string
          invoice_id: string
          item_id?: string | null
          line_total?: number
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          taxable_amount?: number
          unit?: string
        }
        Update: {
          company_id?: string | null
          description?: string
          discount_percent?: number
          gst_percent?: number
          hsn_sac?: string
          id?: string
          invoice_id?: string
          item_id?: string | null
          line_total?: number
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          taxable_amount?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
            foreignKeyName: "invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_number_series: {
        Row: {
          company_id: string | null
          created_at: string
          current_year: number
          doc_type: string
          id: string
          next_number: number
          padding: number
          prefix: string
          reset_yearly: boolean
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          current_year?: number
          doc_type: string
          id?: string
          next_number?: number
          padding?: number
          prefix?: string
          reset_yearly?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          current_year?: number
          doc_type?: string
          id?: string
          next_number?: number
          padding?: number
          prefix?: string
          reset_yearly?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_number_series_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          account_id: string | null
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          invoice_id: string
          mode: string
          note: string
          paid_on: string
          receipt_no: string
          reference_no: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id: string
          mode?: string
          note?: string
          paid_on?: string
          receipt_no?: string
          reference_no?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          invoice_id?: string
          mode?: string
          note?: string
          paid_on?: string
          receipt_no?: string
          reference_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_settings: {
        Row: {
          bank_account_name: string
          bank_account_no: string
          bank_ifsc: string
          bank_name: string
          company_id: string | null
          created_at: string
          default_gst_percent: number
          default_invoice_terms: string
          default_quotation_terms: string
          email: string
          footer_note: string
          gstin: string
          id: string
          include_project_payments_in_income: boolean
          include_supplier_payments_in_accounts: boolean
          invoice_due_days: number
          ledger_opening_date: string | null
          legal_name: string
          pan: string
          paper_size: string
          phone: string
          print_accent_color: string
          print_template: string
          quotation_validity_days: number
          receipt_paper_size: string
          registered_address: string
          repeat_brand_header: boolean
          repeat_table_header: boolean
          require_project_on_invoice: boolean
          round_off_enabled: boolean
          rows_first_page: number
          rows_next_page: number
          show_continued_marker: boolean
          show_page_numbers: boolean
          signature_url: string
          state_code: string
          state_name: string
          updated_at: string
          upi_id: string
        }
        Insert: {
          bank_account_name?: string
          bank_account_no?: string
          bank_ifsc?: string
          bank_name?: string
          company_id?: string | null
          created_at?: string
          default_gst_percent?: number
          default_invoice_terms?: string
          default_quotation_terms?: string
          email?: string
          footer_note?: string
          gstin?: string
          id?: string
          include_project_payments_in_income?: boolean
          include_supplier_payments_in_accounts?: boolean
          invoice_due_days?: number
          ledger_opening_date?: string | null
          legal_name?: string
          pan?: string
          paper_size?: string
          phone?: string
          print_accent_color?: string
          print_template?: string
          quotation_validity_days?: number
          receipt_paper_size?: string
          registered_address?: string
          repeat_brand_header?: boolean
          repeat_table_header?: boolean
          require_project_on_invoice?: boolean
          round_off_enabled?: boolean
          rows_first_page?: number
          rows_next_page?: number
          show_continued_marker?: boolean
          show_page_numbers?: boolean
          signature_url?: string
          state_code?: string
          state_name?: string
          updated_at?: string
          upi_id?: string
        }
        Update: {
          bank_account_name?: string
          bank_account_no?: string
          bank_ifsc?: string
          bank_name?: string
          company_id?: string | null
          created_at?: string
          default_gst_percent?: number
          default_invoice_terms?: string
          default_quotation_terms?: string
          email?: string
          footer_note?: string
          gstin?: string
          id?: string
          include_project_payments_in_income?: boolean
          include_supplier_payments_in_accounts?: boolean
          invoice_due_days?: number
          ledger_opening_date?: string | null
          legal_name?: string
          pan?: string
          paper_size?: string
          phone?: string
          print_accent_color?: string
          print_template?: string
          quotation_validity_days?: number
          receipt_paper_size?: string
          registered_address?: string
          repeat_brand_header?: boolean
          repeat_table_header?: boolean
          require_project_on_invoice?: boolean
          round_off_enabled?: boolean
          rows_first_page?: number
          rows_next_page?: number
          show_continued_marker?: boolean
          show_page_numbers?: boolean
          signature_url?: string
          state_code?: string
          state_name?: string
          updated_at?: string
          upi_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_tax_rates: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          label: string
          percent: number
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          label: string
          percent?: number
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          label?: string
          percent?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_tax_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_units: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          bill_to_address: string
          bill_to_contact_number: string
          bill_to_contact_person: string
          bill_to_gstin: string
          bill_to_name: string
          cgst_total: number
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          discount_total: number
          due_date: string | null
          grand_total: number
          id: string
          igst_total: number
          invoice_date: string
          invoice_no: string
          is_interstate: boolean
          notes: string
          place_of_supply: string
          project_id: string | null
          quotation_id: string | null
          round_off: number
          sgst_total: number
          status: string
          subtotal: number
          terms: string
          title: string
          updated_at: string
        }
        Insert: {
          bill_to_address?: string
          bill_to_contact_number?: string
          bill_to_contact_person?: string
          bill_to_gstin?: string
          bill_to_name?: string
          cgst_total?: number
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          due_date?: string | null
          grand_total?: number
          id?: string
          igst_total?: number
          invoice_date?: string
          invoice_no?: string
          is_interstate?: boolean
          notes?: string
          place_of_supply?: string
          project_id?: string | null
          quotation_id?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          terms?: string
          title?: string
          updated_at?: string
        }
        Update: {
          bill_to_address?: string
          bill_to_contact_number?: string
          bill_to_contact_person?: string
          bill_to_gstin?: string
          bill_to_name?: string
          cgst_total?: number
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          due_date?: string | null
          grand_total?: number
          id?: string
          igst_total?: number
          invoice_date?: string
          invoice_no?: string
          is_interstate?: boolean
          notes?: string
          place_of_supply?: string
          project_id?: string | null
          quotation_id?: string | null
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          terms?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_attachments: {
        Row: {
          company_id: string | null
          created_at: string
          file_name: string
          id: string
          lead_id: string
          mime_type: string
          size_bytes: number
          stage_entry_id: string | null
          storage_path: string
          uploader_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          lead_id: string
          mime_type?: string
          size_bytes?: number
          stage_entry_id?: string | null
          storage_path: string
          uploader_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          lead_id?: string
          mime_type?: string
          size_bytes?: number
          stage_entry_id?: string | null
          storage_path?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attachments_stage_entry_id_fkey"
            columns: ["stage_entry_id"]
            isOneToOne: false
            referencedRelation: "lead_stage_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_field_definitions: {
        Row: {
          company_id: string | null
          field_type: string
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          field_type: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_entries: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          data: Json
          employee_id: string | null
          id: string
          lead_id: string
          note: string
          stage: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          employee_id?: string | null
          id?: string
          lead_id: string
          note?: string
          stage: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: Json
          employee_id?: string | null
          id?: string
          lead_id?: string
          note?: string
          stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_stage_entries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string
          captured_by_employee_id: string | null
          city: string
          close_reason: string | null
          company_id: string | null
          company_name: string
          contact_number: string
          contact_person: string
          converted_client_id: string | null
          created_at: string
          created_by: string | null
          current_stage: string
          custom_fields: Json
          final_price: number | null
          followed_by_employee_id: string | null
          id: string
          lead_date: string
          lead_source: string
          note: string
          outcome: string | null
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          captured_by_employee_id?: string | null
          city?: string
          close_reason?: string | null
          company_id?: string | null
          company_name: string
          contact_number?: string
          contact_person?: string
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string
          custom_fields?: Json
          final_price?: number | null
          followed_by_employee_id?: string | null
          id?: string
          lead_date?: string
          lead_source?: string
          note?: string
          outcome?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          captured_by_employee_id?: string | null
          city?: string
          close_reason?: string | null
          company_id?: string | null
          company_name?: string
          contact_number?: string
          contact_person?: string
          converted_client_id?: string | null
          created_at?: string
          created_by?: string | null
          current_stage?: string
          custom_fields?: Json
          final_price?: number | null
          followed_by_employee_id?: string | null
          id?: string
          lead_date?: string
          lead_source?: string
          note?: string
          outcome?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_captured_by_employee_id_fkey"
            columns: ["captured_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_converted_client_id_fkey"
            columns: ["converted_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_followed_by_employee_id_fkey"
            columns: ["followed_by_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_accounts: {
        Row: {
          account_no: string
          account_type: string
          bank_name: string
          company_id: string | null
          created_at: string
          created_by: string | null
          holder_name: string
          id: string
          ifsc: string
          is_active: boolean
          name: string
          notes: string
          opening_balance: number
          opening_date: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_no?: string
          account_type?: string
          bank_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          holder_name?: string
          id?: string
          ifsc?: string
          is_active?: boolean
          name: string
          notes?: string
          opening_balance?: number
          opening_date?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_no?: string
          account_type?: string
          bank_name?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          holder_name?: string
          id?: string
          ifsc?: string
          is_active?: boolean
          name?: string
          notes?: string
          opening_balance?: number
          opening_date?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_attachments: {
        Row: {
          company_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string
          project_id: string
          size_bytes: number
          storage_path: string
          uploader_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string
          project_id: string
          size_bytes?: number
          storage_path: string
          uploader_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          project_id?: string
          size_bytes?: number
          storage_path?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_comments: {
        Row: {
          author_id: string
          body: string
          company_id: string | null
          created_at: string
          id: string
          project_id: string
        }
        Insert: {
          author_id: string
          body: string
          company_id?: string | null
          created_at?: string
          id?: string
          project_id: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string | null
          created_at?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_departments: {
        Row: {
          company_id: string | null
          department_id: string
          id: string
          project_id: string
        }
        Insert: {
          company_id?: string | null
          department_id: string
          id?: string
          project_id: string
        }
        Update: {
          company_id?: string | null
          department_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_departments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_field_definitions: {
        Row: {
          company_id: string | null
          field_type: string
          id: string
          label: string
          options: Json | null
          required: boolean
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          field_type: string
          id?: string
          label: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          field_type?: string
          id?: string
          label?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_payments: {
        Row: {
          account_id: string | null
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          description: string
          id: string
          mode: string
          paid_on: string
          project_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          mode?: string
          paid_on: string
          project_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          mode?: string
          paid_on?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_task_assignees: {
        Row: {
          company_id: string | null
          employee_id: string
          id: string
          template_task_id: string
        }
        Insert: {
          company_id?: string | null
          employee_id: string
          id?: string
          template_task_id: string
        }
        Update: {
          company_id?: string | null
          employee_id?: string
          id?: string
          template_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_template_task_assignees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_template_task_assignees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_template_task_assignees_template_task_id_fkey"
            columns: ["template_task_id"]
            isOneToOne: false
            referencedRelation: "project_template_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_template_tasks: {
        Row: {
          company_id: string | null
          department_id: string | null
          due_offset_days: number
          id: string
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          company_id?: string | null
          department_id?: string | null
          due_offset_days?: number
          id?: string
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          company_id?: string | null
          department_id?: string | null
          due_offset_days?: number
          id?: string
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_template_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_template_tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          company_id: string | null
          created_at: string
          department_ids: Json
          description: string
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department_ids?: Json
          description?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department_ids?: Json
          description?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          deadline_date: string | null
          final_price: number | null
          id: string
          location_address: string | null
          location_lat: number | null
          location_lng: number | null
          location_place_id: string | null
          location_url: string | null
          name: string
          priority: string
          quoted_price: number | null
          start_date: string | null
          status: string
          work_details: string
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deadline_date?: string | null
          final_price?: number | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_place_id?: string | null
          location_url?: string | null
          name: string
          priority?: string
          quoted_price?: number | null
          start_date?: string | null
          status?: string
          work_details?: string
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          deadline_date?: string | null
          final_price?: number | null
          id?: string
          location_address?: string | null
          location_lat?: number | null
          location_lng?: number | null
          location_place_id?: string | null
          location_url?: string | null
          name?: string
          priority?: string
          quoted_price?: number | null
          start_date?: string | null
          status?: string
          work_details?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string | null
          description: string
          discount_percent: number
          gst_percent: number
          id: string
          item_id: string | null
          line_total: number
          purchase_order_id: string
          quantity: number
          rate: number
          received_quantity: number
          sort_order: number
          tax_amount: number
          taxable_amount: number
          unit: string
        }
        Insert: {
          company_id?: string | null
          description?: string
          discount_percent?: number
          gst_percent?: number
          id?: string
          item_id?: string | null
          line_total?: number
          purchase_order_id: string
          quantity?: number
          rate?: number
          received_quantity?: number
          sort_order?: number
          tax_amount?: number
          taxable_amount?: number
          unit?: string
        }
        Update: {
          company_id?: string | null
          description?: string
          discount_percent?: number
          gst_percent?: number
          id?: string
          item_id?: string | null
          line_total?: number
          purchase_order_id?: string
          quantity?: number
          rate?: number
          received_quantity?: number
          sort_order?: number
          tax_amount?: number
          taxable_amount?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
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
          approved_at: string | null
          approved_by: string | null
          cgst_total: number
          company_id: string | null
          created_at: string
          created_by: string | null
          discount_total: number
          expected_date: string | null
          grand_total: number
          id: string
          igst_total: number
          is_interstate: boolean
          location_id: string | null
          notes: string
          po_date: string
          po_no: string
          round_off: number
          sgst_total: number
          status: string
          subtotal: number
          supplier_id: string | null
          terms: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cgst_total?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          expected_date?: string | null
          grand_total?: number
          id?: string
          igst_total?: number
          is_interstate?: boolean
          location_id?: string | null
          notes?: string
          po_date?: string
          po_no: string
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          supplier_id?: string | null
          terms?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cgst_total?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          expected_date?: string | null
          grand_total?: number
          id?: string
          igst_total?: number
          is_interstate?: boolean
          location_id?: string | null
          notes?: string
          po_date?: string
          po_no?: string
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          supplier_id?: string | null
          terms?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          amount: number
          company_id: string | null
          description: string
          id: string
          item_id: string | null
          purchase_order_item_id: string | null
          quantity: number
          rate: number
          receipt_id: string
          sort_order: number
        }
        Insert: {
          amount?: number
          company_id?: string | null
          description?: string
          id?: string
          item_id?: string | null
          purchase_order_item_id?: string | null
          quantity?: number
          rate?: number
          receipt_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          company_id?: string | null
          description?: string
          id?: string
          item_id?: string | null
          purchase_order_item_id?: string | null
          quantity?: number
          rate?: number
          receipt_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          bill_date: string | null
          bill_no: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          notes: string
          purchase_order_id: string | null
          receipt_date: string
          supplier_id: string | null
          total_value: number
        }
        Insert: {
          bill_date?: string | null
          bill_no?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string
          purchase_order_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          total_value?: number
        }
        Update: {
          bill_date?: string | null
          bill_no?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          notes?: string
          purchase_order_id?: string | null
          receipt_date?: string
          supplier_id?: string | null
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          company_id: string | null
          description: string
          discount_percent: number
          gst_percent: number
          hsn_sac: string
          id: string
          item_id: string | null
          line_total: number
          quantity: number
          quotation_id: string
          rate: number
          sort_order: number
          tax_amount: number
          taxable_amount: number
          unit: string
        }
        Insert: {
          company_id?: string | null
          description?: string
          discount_percent?: number
          gst_percent?: number
          hsn_sac?: string
          id?: string
          item_id?: string | null
          line_total?: number
          quantity?: number
          quotation_id: string
          rate?: number
          sort_order?: number
          tax_amount?: number
          taxable_amount?: number
          unit?: string
        }
        Update: {
          company_id?: string | null
          description?: string
          discount_percent?: number
          gst_percent?: number
          hsn_sac?: string
          id?: string
          item_id?: string | null
          line_total?: number
          quantity?: number
          quotation_id?: string
          rate?: number
          sort_order?: number
          tax_amount?: number
          taxable_amount?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          bill_to_address: string
          bill_to_contact_number: string
          bill_to_contact_person: string
          bill_to_gstin: string
          bill_to_name: string
          cgst_total: number
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          discount_total: number
          grand_total: number
          id: string
          igst_total: number
          is_interstate: boolean
          lead_id: string | null
          notes: string
          place_of_supply: string
          project_id: string | null
          quotation_date: string
          quotation_no: string
          round_off: number
          sgst_total: number
          status: string
          subtotal: number
          terms: string
          title: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          bill_to_address?: string
          bill_to_contact_number?: string
          bill_to_contact_person?: string
          bill_to_gstin?: string
          bill_to_name?: string
          cgst_total?: number
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          igst_total?: number
          is_interstate?: boolean
          lead_id?: string | null
          notes?: string
          place_of_supply?: string
          project_id?: string | null
          quotation_date?: string
          quotation_no?: string
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          terms?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          bill_to_address?: string
          bill_to_contact_number?: string
          bill_to_contact_person?: string
          bill_to_gstin?: string
          bill_to_name?: string
          cgst_total?: number
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_total?: number
          grand_total?: number
          id?: string
          igst_total?: number
          is_interstate?: boolean
          lead_id?: string | null
          notes?: string
          place_of_supply?: string
          project_id?: string | null
          quotation_date?: string
          quotation_no?: string
          round_off?: number
          sgst_total?: number
          status?: string
          subtotal?: number
          terms?: string
          title?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          company_id: string
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          allowed?: boolean
          company_id: string
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          allowed?: boolean
          company_id?: string
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_categories: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category: string
          category_id: string | null
          code: string
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          min_stock: number
          name: string
          notes: string
          purchase_rate: number
          selling_rate: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          category_id?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          notes?: string
          purchase_rate?: number
          selling_rate?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          category_id?: string | null
          code?: string
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          notes?: string
          purchase_rate?: number
          selling_rate?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          location_id: string | null
          moved_on: string
          movement_type: string
          note: string
          project_id: string | null
          quantity: number
          rate: number
          reference_id: string | null
          reference_type: string
          task_id: string | null
          to_location_id: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          location_id?: string | null
          moved_on?: string
          movement_type: string
          note?: string
          project_id?: string | null
          quantity?: number
          rate?: number
          reference_id?: string | null
          reference_type?: string
          task_id?: string | null
          to_location_id?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          location_id?: string | null
          moved_on?: string
          movement_type?: string
          note?: string
          project_id?: string | null
          quantity?: number
          rate?: number
          reference_id?: string | null
          reference_type?: string
          task_id?: string | null
          to_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_settings: {
        Row: {
          company_id: string | null
          created_at: string
          default_gst_percent: number
          default_po_terms: string
          id: string
          paper_size: string
          print_template: string
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          default_gst_percent?: number
          default_po_terms?: string
          id?: string
          paper_size?: string
          print_template?: string
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          default_gst_percent?: number
          default_po_terms?: string
          id?: string
          paper_size?: string
          print_template?: string
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_units: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          account_id: string | null
          amount: number
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          mode: string
          note: string
          paid_on: string
          purchase_order_id: string | null
          reference_no: string
          supplier_id: string
          updated_at: string
          voucher_no: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          note?: string
          paid_on?: string
          purchase_order_id?: string | null
          reference_no?: string
          supplier_id: string
          updated_at?: string
          voucher_no?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          mode?: string
          note?: string
          paid_on?: string
          purchase_order_id?: string | null
          reference_no?: string
          supplier_id?: string
          updated_at?: string
          voucher_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string
          city: string
          company_id: string | null
          contact_person: string
          created_at: string
          email: string
          gstin: string
          id: string
          is_active: boolean
          name: string
          notes: string
          opening_balance: number
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string
          city?: string
          company_id?: string | null
          contact_person?: string
          created_at?: string
          email?: string
          gstin?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string
          opening_balance?: number
          phone?: string
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string
          company_id?: string | null
          contact_person?: string
          created_at?: string
          email?: string
          gstin?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
          opening_balance?: number
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          company_id: string | null
          employee_id: string
          id: string
          task_id: string
        }
        Insert: {
          company_id?: string | null
          employee_id: string
          id?: string
          task_id: string
        }
        Update: {
          company_id?: string | null
          employee_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          company_id: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          task_id: string
          uploader_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path: string
          task_id: string
          uploader_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          task_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          company_id: string | null
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          body: string
          company_id?: string | null
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string | null
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          client_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string
          due_date: string | null
          id: string
          parent_task_id: string | null
          priority: string
          project_id: string | null
          repeat_rule: string
          status_id: string | null
          title: string
        }
        Insert: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          repeat_rule?: string
          status_id?: string | null
          title: string
        }
        Update: {
          client_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          repeat_rule?: string
          status_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "workflow_states"
            referencedColumns: ["id"]
          },
        ]
      }
      user_role_departments: {
        Row: {
          company_id: string | null
          created_at: string
          department_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          department_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          department_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_role_departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_states: {
        Row: {
          color: string
          company_id: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          company_id?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          company_id?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_states_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_company_branding: {
        Args: { _slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          slug: string
          status: string
        }[]
      }
      has_company_role: {
        Args: {
          _company_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_super: { Args: { _uid: string }; Returns: boolean }
      is_provisioned_user: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      next_document_number: { Args: { _doc_type: string }; Returns: string }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "executive"
        | "officer"
        | "staff"
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
      app_role: [
        "super_admin",
        "admin",
        "manager",
        "executive",
        "officer",
        "staff",
      ],
    },
  },
} as const
