export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ademe_dpe: {
        Row: {
          adresse_complete: string | null
          annee_construction: number | null
          cached_at: string
          classe_dpe: string | null
          classe_ges: string | null
          code_insee_commune: string | null
          code_postal: string | null
          consommation_energie_primaire: number | null
          date_etablissement_dpe: string | null
          date_visite_diagnostiqueur: string | null
          emission_ges: number | null
          geom: unknown
          id: string
          lat: number | null
          lng: number | null
          nom_commune: string | null
          numero_dpe: string
          surface_habitable_logement: number | null
          type_batiment: string | null
        }
        Insert: {
          adresse_complete?: string | null
          annee_construction?: number | null
          cached_at?: string
          classe_dpe?: string | null
          classe_ges?: string | null
          code_insee_commune?: string | null
          code_postal?: string | null
          consommation_energie_primaire?: number | null
          date_etablissement_dpe?: string | null
          date_visite_diagnostiqueur?: string | null
          emission_ges?: number | null
          geom?: unknown
          id?: string
          lat?: number | null
          lng?: number | null
          nom_commune?: string | null
          numero_dpe: string
          surface_habitable_logement?: number | null
          type_batiment?: string | null
        }
        Update: {
          adresse_complete?: string | null
          annee_construction?: number | null
          cached_at?: string
          classe_dpe?: string | null
          classe_ges?: string | null
          code_insee_commune?: string | null
          code_postal?: string | null
          consommation_energie_primaire?: number | null
          date_etablissement_dpe?: string | null
          date_visite_diagnostiqueur?: string | null
          emission_ges?: number | null
          geom?: unknown
          id?: string
          lat?: number | null
          lng?: number | null
          nom_commune?: string | null
          numero_dpe?: string
          surface_habitable_logement?: number | null
          type_batiment?: string | null
        }
        Relationships: []
      }
      ban_addresses_cache: {
        Row: {
          adresse_query: string
          cached_at: string
          city: string | null
          citycode: string | null
          context: string | null
          geom: unknown
          housenumber: string | null
          lat: number | null
          lng: number | null
          postcode: string | null
          result_label: string | null
          result_score: number | null
          street: string | null
          type_result: string | null
        }
        Insert: {
          adresse_query: string
          cached_at?: string
          city?: string | null
          citycode?: string | null
          context?: string | null
          geom?: unknown
          housenumber?: string | null
          lat?: number | null
          lng?: number | null
          postcode?: string | null
          result_label?: string | null
          result_score?: number | null
          street?: string | null
          type_result?: string | null
        }
        Update: {
          adresse_query?: string
          cached_at?: string
          city?: string | null
          citycode?: string | null
          context?: string | null
          geom?: unknown
          housenumber?: string | null
          lat?: number | null
          lng?: number | null
          postcode?: string | null
          result_label?: string | null
          result_score?: number | null
          street?: string | null
          type_result?: string | null
        }
        Relationships: []
      }
      credit_rates_history: {
        Row: {
          date_publication: string
          duree_ans: number
          id: string
          imported_at: string
          source: string
          taux_moyen_pct: number
        }
        Insert: {
          date_publication: string
          duree_ans: number
          id?: string
          imported_at?: string
          source?: string
          taux_moyen_pct: number
        }
        Update: {
          date_publication?: string
          duree_ans?: number
          id?: string
          imported_at?: string
          source?: string
          taux_moyen_pct?: number
        }
        Relationships: []
      }
      dvf_mutations: {
        Row: {
          code_commune: string
          code_departement: string
          code_iris: string | null
          code_postal: string | null
          date_mutation: string
          geom: unknown
          id_mutation: string
          imported_at: string
          latitude: number | null
          longitude: number | null
          millesime_dvf: string
          nature_mutation: string
          nom_commune: string
          nombre_pieces_principales: number | null
          surface_reelle_bati: number | null
          surface_terrain: number | null
          type_local: string | null
          valeur_fonciere: number | null
        }
        Insert: {
          code_commune: string
          code_departement: string
          code_iris?: string | null
          code_postal?: string | null
          date_mutation: string
          geom?: unknown
          id_mutation: string
          imported_at?: string
          latitude?: number | null
          longitude?: number | null
          millesime_dvf: string
          nature_mutation: string
          nom_commune: string
          nombre_pieces_principales?: number | null
          surface_reelle_bati?: number | null
          surface_terrain?: number | null
          type_local?: string | null
          valeur_fonciere?: number | null
        }
        Update: {
          code_commune?: string
          code_departement?: string
          code_iris?: string | null
          code_postal?: string | null
          date_mutation?: string
          geom?: unknown
          id_mutation?: string
          imported_at?: string
          latitude?: number | null
          longitude?: number | null
          millesime_dvf?: string
          nature_mutation?: string
          nom_commune?: string
          nombre_pieces_principales?: number | null
          surface_reelle_bati?: number | null
          surface_terrain?: number | null
          type_local?: string | null
          valeur_fonciere?: number | null
        }
        Relationships: []
      }
      education_etablissements: {
        Row: {
          adresse: string | null
          code_commune: string | null
          code_postal: string | null
          geom: unknown
          id: string
          imported_at: string
          ips: number | null
          ips_annee: number | null
          lat: number | null
          lng: number | null
          nom_etablissement: string
          secteur: string | null
          type_etablissement: string
        }
        Insert: {
          adresse?: string | null
          code_commune?: string | null
          code_postal?: string | null
          geom?: unknown
          id: string
          imported_at?: string
          ips?: number | null
          ips_annee?: number | null
          lat?: number | null
          lng?: number | null
          nom_etablissement: string
          secteur?: string | null
          type_etablissement: string
        }
        Update: {
          adresse?: string | null
          code_commune?: string | null
          code_postal?: string | null
          geom?: unknown
          id?: string
          imported_at?: string
          ips?: number | null
          ips_annee?: number | null
          lat?: number | null
          lng?: number | null
          nom_etablissement?: string
          secteur?: string | null
          type_etablissement?: string
        }
        Relationships: []
      }
      encadrement_loyers: {
        Row: {
          annee: number
          arrete_date: string
          epoque_construction: string
          geom: unknown
          id: string
          id_secteur: string
          imported_at: string
          loyer_reference: number
          loyer_reference_majore: number
          loyer_reference_minore: number
          nom_secteur: string | null
          nombre_pieces: string
          type_location: string
          ville: string
        }
        Insert: {
          annee: number
          arrete_date: string
          epoque_construction: string
          geom?: unknown
          id?: string
          id_secteur: string
          imported_at?: string
          loyer_reference: number
          loyer_reference_majore: number
          loyer_reference_minore: number
          nom_secteur?: string | null
          nombre_pieces: string
          type_location: string
          ville: string
        }
        Update: {
          annee?: number
          arrete_date?: string
          epoque_construction?: string
          geom?: unknown
          id?: string
          id_secteur?: string
          imported_at?: string
          loyer_reference?: number
          loyer_reference_majore?: number
          loyer_reference_minore?: number
          nom_secteur?: string | null
          nombre_pieces?: string
          type_location?: string
          ville?: string
        }
        Relationships: []
      }
      georisques_communes: {
        Row: {
          code_commune: string
          has_ppr_avalanche: boolean | null
          has_ppr_feu_foret: boolean | null
          has_ppr_mouvement_terrain: boolean | null
          has_ppri: boolean | null
          nom_commune: string
          ppri_count: number | null
          radon: number | null
          raw_data: Json | null
          retrait_argile_niveau: string | null
          sismicite: number | null
          sites_basias_count: number | null
          sites_basol_count: number | null
          updated_at: string
        }
        Insert: {
          code_commune: string
          has_ppr_avalanche?: boolean | null
          has_ppr_feu_foret?: boolean | null
          has_ppr_mouvement_terrain?: boolean | null
          has_ppri?: boolean | null
          nom_commune: string
          ppri_count?: number | null
          radon?: number | null
          raw_data?: Json | null
          retrait_argile_niveau?: string | null
          sismicite?: number | null
          sites_basias_count?: number | null
          sites_basol_count?: number | null
          updated_at?: string
        }
        Update: {
          code_commune?: string
          has_ppr_avalanche?: boolean | null
          has_ppr_feu_foret?: boolean | null
          has_ppr_mouvement_terrain?: boolean | null
          has_ppri?: boolean | null
          nom_commune?: string
          ppri_count?: number | null
          radon?: number | null
          raw_data?: Json | null
          retrait_argile_niveau?: string | null
          sismicite?: number | null
          sites_basias_count?: number | null
          sites_basol_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      import_runs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          rows_imported: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          rows_imported?: number | null
          source: string
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          rows_imported?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      insee_filosofi: {
        Row: {
          annee: number
          code_iris: string
          median_revenu_uc: number | null
          part_menages_locataires: number | null
          taux_chomage: number | null
          taux_pauvrete: number | null
        }
        Insert: {
          annee: number
          code_iris: string
          median_revenu_uc?: number | null
          part_menages_locataires?: number | null
          taux_chomage?: number | null
          taux_pauvrete?: number | null
        }
        Update: {
          annee?: number
          code_iris?: string
          median_revenu_uc?: number | null
          part_menages_locataires?: number | null
          taux_chomage?: number | null
          taux_pauvrete?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insee_filosofi_code_iris_fkey"
            columns: ["code_iris"]
            isOneToOne: false
            referencedRelation: "insee_iris"
            referencedColumns: ["code_iris"]
          },
        ]
      }
      insee_iris: {
        Row: {
          code_commune: string
          code_departement: string
          code_iris: string
          geom: unknown
          imported_at: string
          nom_commune: string
          nom_iris: string
          population: number | null
          type_iris: string | null
        }
        Insert: {
          code_commune: string
          code_departement: string
          code_iris: string
          geom?: unknown
          imported_at?: string
          nom_commune: string
          nom_iris: string
          population?: number | null
          type_iris?: string | null
        }
        Update: {
          code_commune?: string
          code_departement?: string
          code_iris?: string
          geom?: unknown
          imported_at?: string
          nom_commune?: string
          nom_iris?: string
          population?: number | null
          type_iris?: string | null
        }
        Relationships: []
      }
      oll_loyers_medians: {
        Row: {
          annee: number
          code_zonage_oll: string
          epoque_construction: string | null
          geom: unknown
          id: string
          imported_at: string
          loyer_m2_median: number
          loyer_m2_q1: number | null
          loyer_m2_q3: number | null
          nb_observations: number | null
          nom_zonage: string
          nombre_pieces: string
          region: string | null
          type_logement: string
        }
        Insert: {
          annee: number
          code_zonage_oll: string
          epoque_construction?: string | null
          geom?: unknown
          id?: string
          imported_at?: string
          loyer_m2_median: number
          loyer_m2_q1?: number | null
          loyer_m2_q3?: number | null
          nb_observations?: number | null
          nom_zonage: string
          nombre_pieces: string
          region?: string | null
          type_logement: string
        }
        Update: {
          annee?: number
          code_zonage_oll?: string
          epoque_construction?: string | null
          geom?: unknown
          id?: string
          imported_at?: string
          loyer_m2_median?: number
          loyer_m2_q1?: number | null
          loyer_m2_q3?: number | null
          nb_observations?: number | null
          nom_zonage?: string
          nombre_pieces?: string
          region?: string | null
          type_logement?: string
        }
        Relationships: []
      }
    }
    Views: {
      dvf_medians_commune: {
        Row: {
          annee: number | null
          code_commune: string | null
          median_prix_m2: number | null
          nb_mutations: number | null
          nom_commune: string | null
          q1_prix_m2: number | null
          q3_prix_m2: number | null
          type_local: string | null
        }
        Relationships: []
      }
      dvf_medians_iris: {
        Row: {
          annee: number | null
          code_iris: string | null
          median_prix_m2: number | null
          nb_mutations: number | null
          type_local: string | null
        }
        Relationships: []
      }
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
    Enums: {},
  },
} as const
