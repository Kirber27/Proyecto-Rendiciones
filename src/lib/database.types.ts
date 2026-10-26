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
      cartola_movimientos: {
        Row: {
          abono: number
          cargo: number
          cartola_id: string
          descripcion: string
          fecha: string
          id: string
          idx: number
          ignorado: boolean
          referencia: string
        }
        Insert: {
          abono?: number
          cargo?: number
          cartola_id: string
          descripcion?: string
          fecha: string
          id?: string
          idx: number
          ignorado?: boolean
          referencia?: string
        }
        Update: {
          abono?: number
          cargo?: number
          cartola_id?: string
          descripcion?: string
          fecha?: string
          id?: string
          idx?: number
          ignorado?: boolean
          referencia?: string
        }
        Relationships: [
          {
            foreignKeyName: "cartola_movimientos_cartola_id_fkey"
            columns: ["cartola_id"]
            isOneToOne: false
            referencedRelation: "cartolas"
            referencedColumns: ["id"]
          },
        ]
      }
      cartolas: {
        Row: {
          creado_en: string
          id: string
          medio_pago_id: number | null
          nombre_archivo: string
          subido_por: string | null
        }
        Insert: {
          creado_en?: string
          id?: string
          medio_pago_id?: number | null
          nombre_archivo: string
          subido_por?: string | null
        }
        Update: {
          creado_en?: string
          id?: string
          medio_pago_id?: number | null
          nombre_archivo?: string
          subido_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cartolas_medio_pago_id_fkey"
            columns: ["medio_pago_id"]
            isOneToOne: false
            referencedRelation: "medios_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_costo: {
        Row: {
          codigo: string
          id: number
          orden: number
        }
        Insert: {
          codigo: string
          id?: number
          orden?: number
        }
        Update: {
          codigo?: string
          id?: number
          orden?: number
        }
        Relationships: []
      }
      cuentas: {
        Row: {
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          id?: number
          nombre: string
          orden?: number
        }
        Update: {
          id?: number
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      empresas: {
        Row: {
          centro_costo_id: number | null
          id: number
          nombre: string
          rut: string | null
        }
        Insert: {
          centro_costo_id?: number | null
          id?: number
          nombre: string
          rut?: string | null
        }
        Update: {
          centro_costo_id?: number | null
          id?: number
          nombre?: string
          rut?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
        ]
      }
      lecturas_ia: {
        Row: {
          creado_en: string
          error: string | null
          id: number
          imagenes: number
          ok: boolean
          tokens_entrada: number | null
          tokens_salida: number | null
          user_id: string | null
        }
        Insert: {
          creado_en?: string
          error?: string | null
          id?: never
          imagenes?: number
          ok: boolean
          tokens_entrada?: number | null
          tokens_salida?: number | null
          user_id?: string | null
        }
        Update: {
          creado_en?: string
          error?: string | null
          id?: never
          imagenes?: number
          ok?: boolean
          tokens_entrada?: number | null
          tokens_salida?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      medios_pago: {
        Row: {
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          id?: number
          nombre: string
          orden?: number
        }
        Update: {
          id?: number
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      pago_rendiciones: {
        Row: {
          pago_id: string
          rendicion_id: string
        }
        Insert: {
          pago_id: string
          rendicion_id: string
        }
        Update: {
          pago_id?: string
          rendicion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pago_rendiciones_pago_id_fkey"
            columns: ["pago_id"]
            isOneToOne: false
            referencedRelation: "pagos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pago_rendiciones_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos: {
        Row: {
          codigo_hist: string | null
          creado_en: string
          creado_por: string | null
          descripcion: string
          fecha: string | null
          id: string
          medio_pago_id: number | null
          monto: number
          movimiento_id: string | null
          obs: string
          origen: Database["public"]["Enums"]["origen_registro"]
          persona_id: string
          tipo: Database["public"]["Enums"]["tipo_pago"]
        }
        Insert: {
          codigo_hist?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string
          fecha?: string | null
          id?: string
          medio_pago_id?: number | null
          monto: number
          movimiento_id?: string | null
          obs?: string
          origen?: Database["public"]["Enums"]["origen_registro"]
          persona_id: string
          tipo?: Database["public"]["Enums"]["tipo_pago"]
        }
        Update: {
          codigo_hist?: string | null
          creado_en?: string
          creado_por?: string | null
          descripcion?: string
          fecha?: string | null
          id?: string
          medio_pago_id?: number | null
          monto?: number
          movimiento_id?: string | null
          obs?: string
          origen?: Database["public"]["Enums"]["origen_registro"]
          persona_id?: string
          tipo?: Database["public"]["Enums"]["tipo_pago"]
        }
        Relationships: [
          {
            foreignKeyName: "pagos_medio_pago_id_fkey"
            columns: ["medio_pago_id"]
            isOneToOne: false
            referencedRelation: "medios_pago"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: true
            referencedRelation: "cartola_movimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          codigo: string
          correo: string | null
          creado_en: string
          eliminada_en: string | null
          es_nueva: boolean
          id: string
          nombre: string
          nombre_norm: string | null
          rol: Database["public"]["Enums"]["rol_app"]
          user_id: string | null
        }
        Insert: {
          codigo: string
          correo?: string | null
          creado_en?: string
          eliminada_en?: string | null
          es_nueva?: boolean
          id?: string
          nombre: string
          nombre_norm?: string | null
          rol?: Database["public"]["Enums"]["rol_app"]
          user_id?: string | null
        }
        Update: {
          codigo?: string
          correo?: string | null
          creado_en?: string
          eliminada_en?: string | null
          es_nueva?: boolean
          id?: string
          nombre?: string
          nombre_norm?: string | null
          rol?: Database["public"]["Enums"]["rol_app"]
          user_id?: string | null
        }
        Relationships: []
      }
      rendicion_eventos: {
        Row: {
          actor: string | null
          creado_en: string
          evento: string
          id: number
          nota: string | null
          rendicion_id: string
        }
        Insert: {
          actor?: string | null
          creado_en?: string
          evento: string
          id?: never
          nota?: string | null
          rendicion_id: string
        }
        Update: {
          actor?: string | null
          creado_en?: string
          evento?: string
          id?: never
          nota?: string | null
          rendicion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rendicion_eventos_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      rendicion_lineas: {
        Row: {
          centro_costo_id: number | null
          cuenta_id: number | null
          detalle: string
          exento: number
          fecha: string | null
          id: string
          iva: number
          neto: number
          numero: string
          orden: number
          otros: number
          proveedor: string
          rendicion_id: string
          rut: string
          subcuenta_id: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
        }
        Insert: {
          centro_costo_id?: number | null
          cuenta_id?: number | null
          detalle?: string
          exento?: number
          fecha?: string | null
          id?: string
          iva?: number
          neto?: number
          numero?: string
          orden?: number
          otros?: number
          proveedor?: string
          rendicion_id: string
          rut?: string
          subcuenta_id?: number | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          centro_costo_id?: number | null
          cuenta_id?: number | null
          detalle?: string
          exento?: number
          fecha?: string | null
          id?: string
          iva?: number
          neto?: number
          numero?: string
          orden?: number
          otros?: number
          proveedor?: string
          rendicion_id?: string
          rut?: string
          subcuenta_id?: number | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
        }
        Relationships: [
          {
            foreignKeyName: "rendicion_lineas_centro_costo_id_fkey"
            columns: ["centro_costo_id"]
            isOneToOne: false
            referencedRelation: "centros_costo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendicion_lineas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendicion_lineas_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendicion_lineas_subcuenta_id_fkey"
            columns: ["subcuenta_id"]
            isOneToOne: false
            referencedRelation: "subcuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      rendiciones: {
        Row: {
          aprobacion_anulada: boolean
          creado_en: string
          creado_por: string | null
          decidido_en: string | null
          decidido_por: string | null
          editado_en: string | null
          empresa_id: number | null
          enviado_en: string | null
          estado: Database["public"]["Enums"]["estado_rendicion"]
          exportada: boolean
          fecha: string
          folio: string | null
          fondo: string
          id: string
          nota_tesoreria: string | null
          nro: number
          obs: string
          origen: Database["public"]["Enums"]["origen_registro"]
          persona_id: string
          total: number
          total_formulario: number | null
        }
        Insert: {
          aprobacion_anulada?: boolean
          creado_en?: string
          creado_por?: string | null
          decidido_en?: string | null
          decidido_por?: string | null
          editado_en?: string | null
          empresa_id?: number | null
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_rendicion"]
          exportada?: boolean
          fecha: string
          folio?: string | null
          fondo?: string
          id?: string
          nota_tesoreria?: string | null
          nro: number
          obs?: string
          origen?: Database["public"]["Enums"]["origen_registro"]
          persona_id: string
          total?: number
          total_formulario?: number | null
        }
        Update: {
          aprobacion_anulada?: boolean
          creado_en?: string
          creado_por?: string | null
          decidido_en?: string | null
          decidido_por?: string | null
          editado_en?: string | null
          empresa_id?: number | null
          enviado_en?: string | null
          estado?: Database["public"]["Enums"]["estado_rendicion"]
          exportada?: boolean
          fecha?: string
          folio?: string | null
          fondo?: string
          id?: string
          nota_tesoreria?: string | null
          nro?: number
          obs?: string
          origen?: Database["public"]["Enums"]["origen_registro"]
          persona_id?: string
          total?: number
          total_formulario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rendiciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rendiciones_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      respaldos: {
        Row: {
          creado_en: string
          id: string
          mime: string | null
          orden: number
          rendicion_id: string
          storage_path: string
        }
        Insert: {
          creado_en?: string
          id?: string
          mime?: string | null
          orden?: number
          rendicion_id: string
          storage_path: string
        }
        Update: {
          creado_en?: string
          id?: string
          mime?: string | null
          orden?: number
          rendicion_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "respaldos_rendicion_id_fkey"
            columns: ["rendicion_id"]
            isOneToOne: false
            referencedRelation: "rendiciones"
            referencedColumns: ["id"]
          },
        ]
      }
      subcuentas: {
        Row: {
          activa: boolean
          cuenta_sugerida_id: number | null
          id: number
          nombre: string
          orden: number
        }
        Insert: {
          activa?: boolean
          cuenta_sugerida_id?: number | null
          id?: number
          nombre: string
          orden?: number
        }
        Update: {
          activa?: boolean
          cuenta_sugerida_id?: number | null
          id?: number
          nombre?: string
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcuentas_cuenta_sugerida_id_fkey"
            columns: ["cuenta_sugerida_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _clp: { Args: { n: number }; Returns: string }
      _exigir_admin: { Args: never; Returns: undefined }
      _vincular_por_correo: {
        Args: { p_persona_id: string }
        Returns: undefined
      }
      asignar_rol: {
        Args: {
          p_persona_id: string
          p_rol: Database["public"]["Enums"]["rol_app"]
        }
        Returns: string
      }
      eliminar_persona: { Args: { p_persona_id: string }; Returns: undefined }
      enviar_rendicion: { Args: { p: Json }; Returns: string }
      es_admin: { Args: never; Returns: boolean }
      es_tesoreria: { Args: never; Returns: boolean }
      guardar_persona: { Args: { p: Json }; Returns: string }
      hook_validar_correo: { Args: { event: Json }; Returns: Json }
      listar_cuentas: {
        Args: never
        Returns: {
          email: string
          persona_id: string
          persona_nombre: string
          ultimo_ingreso: string
          user_id: string
        }[]
      }
      mi_persona_id: { Args: never; Returns: string }
      mi_rol: { Args: never; Returns: Database["public"]["Enums"]["rol_app"] }
      normalizar: { Args: { t: string }; Returns: string }
      restaurar_persona: { Args: { p_persona_id: string }; Returns: undefined }
      vincular_cuenta: {
        Args: { p_persona_id: string; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      estado_rendicion:
        | "en_revision"
        | "observada"
        | "rechazada"
        | "aprobada"
        | "eliminada"
      origen_registro: "App" | "Histórico"
      rol_app: "administrador" | "tesorero" | "solicitante"
      tipo_documento:
        | "Factura"
        | "Boleta"
        | "Boleta de honorarios"
        | "Transferencia"
      tipo_pago:
        | "Pago"
        | "Anticipo"
        | "No genera pago"
        | "Devolución de la persona"
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
      estado_rendicion: [
        "en_revision",
        "observada",
        "rechazada",
        "aprobada",
        "eliminada",
      ],
      origen_registro: ["App", "Histórico"],
      rol_app: ["administrador", "tesorero", "solicitante"],
      tipo_documento: [
        "Factura",
        "Boleta",
        "Boleta de honorarios",
        "Transferencia",
      ],
      tipo_pago: [
        "Pago",
        "Anticipo",
        "No genera pago",
        "Devolución de la persona",
      ],
    },
  },
} as const
