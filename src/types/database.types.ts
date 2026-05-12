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
      audio_files: {
        Row: {
          content_id: string
          created_at: string
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          metadata: Json
          storage_path: string
          tts_model: string | null
        }
        Insert: {
          content_id: string
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          storage_path: string
          tts_model?: string | null
        }
        Update: {
          content_id?: string
          created_at?: string
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          metadata?: Json
          storage_path?: string
          tts_model?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audio_files_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      bus_radio_assignments: {
        Row: {
          bus_id: string
          created_at: string
          id: string
          is_active: boolean
          radio_program_id: string
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          radio_program_id: string
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          radio_program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bus_radio_assignments_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bus_radio_assignments_radio_program_id_fkey"
            columns: ["radio_program_id"]
            isOneToOne: false
            referencedRelation: "radio_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          bus_code: string
          created_at: string
          group_id: string | null
          id: string
          name: string | null
          qr_code_id: string
          updated_at: string
        }
        Insert: {
          bus_code: string
          created_at?: string
          group_id?: string | null
          id?: string
          name?: string | null
          qr_code_id?: string
          updated_at?: string
        }
        Update: {
          bus_code?: string
          created_at?: string
          group_id?: string | null
          id?: string
          name?: string | null
          qr_code_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          category_tag: string | null
          created_at: string
          group_id: string | null
          id: string
          metadata: Json
          script: string
          source_polling_site_id: string | null
          source_type: string
          source_url: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category_tag?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          metadata?: Json
          script: string
          source_polling_site_id?: string | null
          source_type: string
          source_url?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category_tag?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          metadata?: Json
          script?: string
          source_polling_site_id?: string | null
          source_type?: string
          source_url?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contents_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contents_source_polling_site_id_fkey"
            columns: ["source_polling_site_id"]
            isOneToOne: false
            referencedRelation: "polling_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          bus_id: string
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          token: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          token: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      ondemand_areas: {
        Row: {
          created_at: string
          id: string
          polygon: Json
          proximity_settings: Json
          radio_program_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          polygon: Json
          proximity_settings?: Json
          radio_program_id: string
        }
        Update: {
          created_at?: string
          id?: string
          polygon?: Json
          proximity_settings?: Json
          radio_program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ondemand_areas_radio_program_id_fkey"
            columns: ["radio_program_id"]
            isOneToOne: false
            referencedRelation: "radio_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_favorites: {
        Row: {
          content_id: string
          created_at: string
          id: string
          passenger_user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          passenger_user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          passenger_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_favorites_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_favorites_passenger_user_id_fkey"
            columns: ["passenger_user_id"]
            isOneToOne: false
            referencedRelation: "passenger_users"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_session_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_session_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "passenger_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_sessions: {
        Row: {
          bus_id: string | null
          content_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          passenger_user_id: string
          started_at: string
        }
        Insert: {
          bus_id?: string | null
          content_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          passenger_user_id: string
          started_at?: string
        }
        Update: {
          bus_id?: string | null
          content_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          passenger_user_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passenger_sessions_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_sessions_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passenger_sessions_passenger_user_id_fkey"
            columns: ["passenger_user_id"]
            isOneToOne: false
            referencedRelation: "passenger_users"
            referencedColumns: ["id"]
          },
        ]
      }
      passenger_users: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      polling_sites: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_polled_at: string | null
          last_status: string | null
          name: string
          settings: Json
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_polled_at?: string | null
          last_status?: string | null
          name: string
          settings?: Json
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_polled_at?: string | null
          last_status?: string | null
          name?: string
          settings?: Json
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "polling_sites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          group_id: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          group_id?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          group_id?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_program_items: {
        Row: {
          audio_file_id: string | null
          content_id: string
          created_at: string
          display_name: string | null
          id: string
          lat: number
          lng: number
          radio_program_id: string
          sequence: number | null
          updated_at: string
        }
        Insert: {
          audio_file_id?: string | null
          content_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          lat: number
          lng: number
          radio_program_id: string
          sequence?: number | null
          updated_at?: string
        }
        Update: {
          audio_file_id?: string | null
          content_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          lat?: number
          lng?: number
          radio_program_id?: string
          sequence?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_program_items_audio_file_id_fkey"
            columns: ["audio_file_id"]
            isOneToOne: false
            referencedRelation: "audio_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_program_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radio_program_items_radio_program_id_fkey"
            columns: ["radio_program_id"]
            isOneToOne: false
            referencedRelation: "radio_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_program_shapes: {
        Row: {
          created_at: string | null
          id: string
          points: Json
          program_id: string
          shape_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          points: Json
          program_id: string
          shape_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          points?: Json
          program_id?: string
          shape_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_program_shapes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "radio_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      radio_programs: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_active: boolean
          name: string
          program_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          program_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          program_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "radio_programs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string | null
          route_id: string
          sequence: number
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name?: string | null
          route_id: string
          sequence: number
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string | null
          route_id?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          geometry: Json
          id: string
          name: string | null
          radio_program_id: string
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          geometry: Json
          id?: string
          name?: string | null
          radio_program_id: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          geometry?: Json
          id?: string
          name?: string | null
          radio_program_id?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_radio_program_id_fkey"
            columns: ["radio_program_id"]
            isOneToOne: false
            referencedRelation: "radio_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_playback_events: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          metadata: Json
          played_at: string
          radio_program_item_id: string
          status: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          metadata?: Json
          played_at?: string
          radio_program_item_id: string
          status: string
          trip_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          metadata?: Json
          played_at?: string
          radio_program_item_id?: string
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_playback_events_radio_program_item_id_fkey"
            columns: ["radio_program_item_id"]
            isOneToOne: false
            referencedRelation: "radio_program_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_playback_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          bus_id: string
          created_at: string
          device_id: string | null
          ended_at: string | null
          id: string
          metadata: Json
          radio_program_id: string
          started_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          device_id?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          radio_program_id: string
          started_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          device_id?: string | null
          ended_at?: string | null
          id?: string
          metadata?: Json
          radio_program_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_radio_program_id_fkey"
            columns: ["radio_program_id"]
            isOneToOne: false
            referencedRelation: "radio_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_location_logs: {
        Row: {
          bus_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          speed_kmh: number | null
          trip_id: string | null
        }
        Insert: {
          bus_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          speed_kmh?: number | null
          trip_id?: string | null
        }
        Update: {
          bus_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          speed_kmh?: number | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_location_logs_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_location_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_root: { Args: never; Returns: boolean }
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
