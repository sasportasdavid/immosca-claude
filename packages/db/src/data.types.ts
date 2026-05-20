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
      refresh_dvf_medians: { Args: never; Returns: undefined }
      rpc_dpe_sector_average: {
        Args: { p_code_insee: string; p_type_bien: string }
        Returns: {
          classe_mediane: string
          code_iris: string
          count_a: number
          count_b: number
          count_c: number
          count_d: number
          count_e: number
          count_f: number
          count_g: number
          echantillon_size: number
          typologie: string
        }[]
      }
      rpc_dvf_comparables: {
        Args: {
          p_depuis_annee?: number
          p_lat: number
          p_lng: number
          p_rayon_m?: number
          p_surface_m2: number
          p_type_bien: string
        }
        Returns: {
          code_iris: string
          date_mutation: string
          distance_m: number
          prix: number
          prix_m2: number
          ref: string
          surface: number
          typologie: string
        }[]
      }
      rpc_georisques: {
        Args: { p_code_insee: string }
        Returns: {
          argile_aleas: string
          basol_proche_m: number
          ppri_inondation: boolean
          ppri_mouvement_terrain: boolean
          radon_potentiel: string
          remarques: string[]
          sismicite_zone: number
        }[]
      }
      rpc_iris_context: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          age_median: number
          code_iris: string
          nom_iris: string
          pct_logements_collectifs: number
          pct_proprietaires: number
          pct_residences_principales: number
          population: number
          revenu_median: number
          taux_pauvrete: number
        }[]
      }
      rpc_noise: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          categorie: string
          lden_db: number
          source_bruit_principale: string
        }[]
      }
      rpc_oll_market: {
        Args: { p_code_insee: string; p_type_bien: string }
        Returns: {
          annee_reference: number
          code_insee: string
          loyer_median_m2: number
          loyer_p25_m2: number
          loyer_p75_m2: number
          source: string
          typologie: string
        }[]
      }
      rpc_prix_trend: {
        Args: { p_code_insee: string; p_type_bien: string }
        Returns: {
          annee: number
          nb_mutations: number
          prix_m2_median: number
        }[]
      }
      rpc_transports: {
        Args: { p_lat: number; p_lng: number; p_rayon_m?: number }
        Returns: {
          bus_distance_m: number
          bus_ligne: string
          commerces_500m: number
          gare_distance_m: number
          gare_nom: string
          isochrone_15min_paris: boolean
          metro_distance_m: number
          metro_ligne: string
          rer_distance_m: number
          rer_ligne: string
          services_500m: number
        }[]
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
  public: {
    Enums: {},
  },
} as const
