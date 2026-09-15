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
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_equipment: {
        Row: {
          created_at: string
          id: string
          name: string
          requirement_level: string
          route_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          requirement_level?: string
          route_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          requirement_level?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_equipment_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_pauses: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          route_id: string
          started_at: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          route_id: string
          started_at: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          route_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_pauses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_point_services: {
        Row: {
          created_at: string
          details: string | null
          id: string
          is_available: boolean
          route_point_id: string
          service_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          is_available?: boolean
          route_point_id: string
          service_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          is_available?: boolean
          route_point_id?: string
          service_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_point_services_route_point_id_fkey"
            columns: ["route_point_id"]
            isOneToOne: false
            referencedRelation: "route_points"
            referencedColumns: ["id"]
          },
        ]
      }
      route_points: {
        Row: {
          created_at: string
          description: string | null
          id: string
          latitude: number
          longitude: number
          name: string | null
          point_type: string
          route_id: string
          sequence_no: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          latitude: number
          longitude: number
          name?: string | null
          point_type: string
          route_id: string
          sequence_no?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string | null
          point_type?: string
          route_id?: string
          sequence_no?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_points_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_track_points: {
        Row: {
          accuracy_m: number | null
          altitude_m: number | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          route_id: string
          sequence_no: number
        }
        Insert: {
          accuracy_m?: number | null
          altitude_m?: number | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          recorded_at: string
          route_id: string
          sequence_no: number
        }
        Update: {
          accuracy_m?: number | null
          altitude_m?: number | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          route_id?: string
          sequence_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_track_points_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active_duration_seconds: number
          created_at: string
          description: string | null
          difficulty: string | null
          end_latitude: number | null
          end_longitude: number | null
          estimated_duration_minutes: number | null
          finished_at: string | null
          id: string
          main_image_path: string | null
          name: string | null
          owner_id: string
          pause_count: number
          published_at: string | null
          start_latitude: number | null
          start_longitude: number | null
          started_at: string | null
          status: string
          total_distance_m: number
          updated_at: string
          visibility: string
        }
        Insert: {
          active_duration_seconds?: number
          created_at?: string
          description?: string | null
          difficulty?: string | null
          end_latitude?: number | null
          end_longitude?: number | null
          estimated_duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          main_image_path?: string | null
          name?: string | null
          owner_id: string
          pause_count?: number
          published_at?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          status?: string
          total_distance_m?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          active_duration_seconds?: number
          created_at?: string
          description?: string | null
          difficulty?: string | null
          end_latitude?: number | null
          end_longitude?: number | null
          estimated_duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          main_image_path?: string | null
          name?: string | null
          owner_id?: string
          pause_count?: number
          published_at?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          status?: string
          total_distance_m?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
