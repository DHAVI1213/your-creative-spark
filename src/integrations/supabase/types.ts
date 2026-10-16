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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_config: {
        Row: {
          atualizado_em: string
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          atualizado_em: string
          chave: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          kiwify_order_id: string | null
          kiwify_subscription_id: string | null
          observacao: string | null
          origem: string
          plano: string
          status: string
          user_id: string | null
          valido_ate: string | null
          valor_centavos: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email: string
          id?: string
          kiwify_order_id?: string | null
          kiwify_subscription_id?: string | null
          observacao?: string | null
          origem?: string
          plano: string
          status: string
          user_id?: string | null
          valido_ate?: string | null
          valor_centavos?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          kiwify_order_id?: string | null
          kiwify_subscription_id?: string | null
          observacao?: string | null
          origem?: string
          plano?: string
          status?: string
          user_id?: string | null
          valido_ate?: string | null
          valor_centavos?: number | null
        }
        Relationships: []
      }
      eventos_kiwify: {
        Row: {
          assinatura_valida: boolean
          email: string | null
          erro: string | null
          id: string
          order_id: string | null
          payload: Json | null
          processado: boolean
          produto: string | null
          recebido_em: string
          status_pedido: string | null
          tipo: string | null
          valor_centavos: number | null
        }
        Insert: {
          assinatura_valida?: boolean
          email?: string | null
          erro?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          processado?: boolean
          produto?: string | null
          recebido_em?: string
          status_pedido?: string | null
          tipo?: string | null
          valor_centavos?: number | null
        }
        Update: {
          assinatura_valida?: boolean
          email?: string | null
          erro?: string | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          processado?: boolean
          produto?: string | null
          recebido_em?: string
          status_pedido?: string | null
          tipo?: string | null
          valor_centavos?: number | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          name: string
          price_cents: number
          recurring: boolean
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          price_cents?: number
          recurring?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price_cents?: number
          recurring?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          email: string
          external_id: string | null
          id: string
          plan: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          email?: string
          external_id?: string | null
          id?: string
          plan: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          email?: string
          external_id?: string | null
          id?: string
          plan?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tool_settings: {
        Row: {
          description: string
          enabled: boolean
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          description?: string
          enabled?: boolean
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          description?: string
          enabled?: boolean
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      tool_usage: {
        Row: {
          created_at: string
          id: string
          tool_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tool_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tool_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_accounts: {
        Row: {
          active: boolean
          plan_override: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          plan_override?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          plan_override?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
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
      viral_buscas: {
        Row: {
          criado_em: string
          download_iniciado: string | null
          download_run: string | null
          id: string
          perfil: Json
          run_id: string | null
          status: string
          user_id: string
          videos: Json
        }
        Insert: {
          criado_em?: string
          download_iniciado?: string | null
          download_run?: string | null
          id?: string
          perfil: Json
          run_id?: string | null
          status?: string
          user_id: string
          videos?: Json
        }
        Update: {
          criado_em?: string
          download_iniciado?: string | null
          download_run?: string | null
          id?: string
          perfil?: Json
          run_id?: string | null
          status?: string
          user_id?: string
          videos?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_change_account: {
        Args: { _active: boolean; _plan: string; _user_id: string }
        Returns: undefined
      }
      admin_has_secret: { Args: { _chave: string }; Returns: boolean }
      admin_panel_data: { Args: never; Returns: Json }
      admin_set_secret: {
        Args: { _chave: string; _valor: string }
        Returns: undefined
      }
      client_account_state: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      liga_conta_confirmada: {
        Args: { _email: string; _id: string }
        Returns: undefined
      }
      public_site_settings: { Args: never; Returns: Json }
      record_activity: { Args: { _tool_id?: string }; Returns: undefined }
      tem_acesso: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "cliente"
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
      app_role: ["admin", "cliente"],
    },
  },
} as const
