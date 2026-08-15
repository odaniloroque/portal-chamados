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
      contract_assets: {
        Row: {
          active: boolean
          category: string
          contract_id: string
          counter: number | null
          created_at: string
          device_type: string | null
          hostname: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          serial: string | null
          specs: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          contract_id: string
          counter?: number | null
          created_at?: string
          device_type?: string | null
          hostname?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          serial?: string | null
          specs?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          contract_id?: string
          counter?: number | null
          created_at?: string
          device_type?: string | null
          hostname?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          serial?: string | null
          specs?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_assets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          active: boolean
          billing_type: Database["public"]["Enums"]["contract_billing_type"]
          client_id: string
          contract_end: string | null
          contract_number: string | null
          contract_plan: string | null
          contract_start: string | null
          contract_value: number | null
          created_at: string
          id: string
          monthly_page_quota: number | null
          name: string
          page_price: number | null
          rental_mode: string | null
          supply_billing: string | null
          toner_price: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_type?: Database["public"]["Enums"]["contract_billing_type"]
          client_id: string
          contract_end?: string | null
          contract_number?: string | null
          contract_plan?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          id?: string
          monthly_page_quota?: number | null
          name: string
          page_price?: number | null
          rental_mode?: string | null
          supply_billing?: string | null
          toner_price?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_type?: Database["public"]["Enums"]["contract_billing_type"]
          client_id?: string
          contract_end?: string | null
          contract_number?: string | null
          contract_plan?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          id?: string
          monthly_page_quota?: number | null
          name?: string
          page_price?: number | null
          rental_mode?: string | null
          supply_billing?: string | null
          toner_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_secrets: {
        Row: {
          created_at: string
          name: string
          value: string
        }
        Insert: {
          created_at?: string
          name: string
          value: string
        }
        Update: {
          created_at?: string
          name?: string
          value?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          ticket_id: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          ticket_id: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          ticket_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_display"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          address: string | null
          cnpj: string | null
          company_name: string | null
          contract_end: string | null
          contract_number: string | null
          contract_plan: string | null
          contract_start: string | null
          contract_value: number | null
          created_at: string
          custom_fields: Json
          email: string
          email_notifications: boolean
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          whatsapp_notifications: boolean
        }
        Insert: {
          active?: boolean
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          contract_end?: string | null
          contract_number?: string | null
          contract_plan?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          custom_fields?: Json
          email: string
          email_notifications?: boolean
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
          whatsapp_notifications?: boolean
        }
        Update: {
          active?: boolean
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          contract_end?: string | null
          contract_number?: string | null
          contract_plan?: string | null
          contract_start?: string | null
          contract_value?: number | null
          created_at?: string
          custom_fields?: Json
          email?: string
          email_notifications?: boolean
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          whatsapp_notifications?: boolean
        }
        Relationships: []
      }
      technician_contracts: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          technician_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          technician_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          technician_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_contracts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          ticket_id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          ticket_id: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          ticket_id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_display"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_updates: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          message: string | null
          status_from: Database["public"]["Enums"]["ticket_status"] | null
          status_to: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          status_from?: Database["public"]["Enums"]["ticket_status"] | null
          status_to?: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          status_from?: Database["public"]["Enums"]["ticket_status"] | null
          status_to?: Database["public"]["Enums"]["ticket_status"] | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_updates_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_updates_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_display"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          asset_id: string | null
          child_seq: number | null
          contract_id: string | null
          created_at: string
          custom_fields: Json
          description: string
          id: string
          parent_ticket_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          service_type: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          status_dev: string | null
          ticket_number: number
          title: string
          toner_color: string | null
          toner_qty: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id?: string | null
          child_seq?: number | null
          contract_id?: string | null
          created_at?: string
          custom_fields?: Json
          description: string
          id?: string
          parent_ticket_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          service_type?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_dev?: string | null
          ticket_number?: number
          title: string
          toner_color?: string | null
          toner_qty?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string | null
          child_seq?: number | null
          contract_id?: string | null
          created_at?: string
          custom_fields?: Json
          description?: string
          id?: string
          parent_ticket_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          service_type?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          status_dev?: string | null
          ticket_number?: number
          title?: string
          toner_color?: string | null
          toner_qty?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "contract_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_display"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          client_id: string
          contract_id: string | null
          created_at: string
          description: string
          duration_minutes: number
          ended_at: string | null
          entry_date: string
          id: string
          source: Database["public"]["Enums"]["time_entry_source"]
          started_at: string | null
          ticket_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          contract_id?: string | null
          created_at?: string
          description?: string
          duration_minutes: number
          ended_at?: string | null
          entry_date?: string
          id?: string
          source?: Database["public"]["Enums"]["time_entry_source"]
          started_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string
          duration_minutes?: number
          ended_at?: string | null
          entry_date?: string
          id?: string
          source?: Database["public"]["Enums"]["time_entry_source"]
          started_at?: string | null
          ticket_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_display"
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
    }
    Views: {
      tickets_display: {
        Row: {
          asset_id: string | null
          child_seq: number | null
          contract_id: string | null
          created_at: string | null
          custom_fields: Json | null
          description: string | null
          display_number: string | null
          id: string | null
          parent_ticket_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"] | null
          service_type: string | null
          status: Database["public"]["Enums"]["ticket_status"] | null
          status_dev: string | null
          ticket_number: number | null
          title: string | null
          toner_color: string | null
          toner_qty: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "contract_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_parent_ticket_id_fkey"
            columns: ["parent_ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets_display"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_client_ticket_response: {
        Args: { p_message: string; p_ticket_id: string }
        Returns: undefined
      }
      auto_close_resolved_tickets: { Args: never; Returns: number }
      can_access_contract: {
        Args: { _contract_id: string; _user_id: string }
        Returns: boolean
      }
      close_ticket_by_client: {
        Args: { p_ticket_id: string }
        Returns: undefined
      }
      create_ticket_from_webhook: {
        Args: {
          p_custom_fields?: Json
          p_description: string
          p_email: string
          p_priority?: Database["public"]["Enums"]["ticket_priority"]
          p_secret: string
          p_title: string
        }
        Returns: Json
      }
      create_ticket_notification: {
        Args: {
          _message: string
          _ticket: Database["public"]["Tables"]["tickets"]["Row"]
          _type: string
        }
        Returns: undefined
      }
      format_display_number: {
        Args: {
          _child_seq: number
          _parent_number: number
          _ticket_number: number
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      ticket_has_subtickets: { Args: { _ticket_id: string }; Returns: boolean }
      ticket_status_label: {
        Args: { _status: Database["public"]["Enums"]["ticket_status"] }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "cliente" | "tecnico" | "dev"
      contract_billing_type:
        | "por_hora"
        | "fixo"
        | "por_servico"
        | "locacao_impressoras"
        | "locacao_servidores"
        | "locacao_rede"
      ticket_priority: "baixa" | "media" | "alta" | "critica"
      ticket_status:
        | "aberto"
        | "em_andamento"
        | "aguardando_cliente"
        | "respondido_cliente"
        | "em_desenvolvimento"
        | "resolvido"
        | "fechado"
      time_entry_source: "timer" | "manual"
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
      app_role: ["admin", "cliente", "tecnico", "dev"],
      contract_billing_type: [
        "por_hora",
        "fixo",
        "por_servico",
        "locacao_impressoras",
        "locacao_servidores",
        "locacao_rede",
      ],
      ticket_priority: ["baixa", "media", "alta", "critica"],
      ticket_status: [
        "aberto",
        "em_andamento",
        "aguardando_cliente",
        "respondido_cliente",
        "em_desenvolvimento",
        "resolvido",
        "fechado",
      ],
      time_entry_source: ["timer", "manual"],
    },
  },
} as const
