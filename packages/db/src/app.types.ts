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
      address_lookups: {
        Row: {
          address: string | null
          apify_run_id: string | null
          city: string | null
          completed_at: string | null
          confidence: number | null
          created_at: string
          error_message: string | null
          expires_at: string
          id: string
          lat: number | null
          listing_dpe: string | null
          listing_price: number | null
          listing_surface: number | null
          listing_title: string | null
          lng: number | null
          postal_code: string | null
          profile_id: string
          resolution_source: string | null
          source_site: Database["public"]["Enums"]["listing_source"] | null
          status: string
          trigger_run_id: string | null
          url: string
          url_hash: string
        }
        Insert: {
          address?: string | null
          apify_run_id?: string | null
          city?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          lat?: number | null
          listing_dpe?: string | null
          listing_price?: number | null
          listing_surface?: number | null
          listing_title?: string | null
          lng?: number | null
          postal_code?: string | null
          profile_id: string
          resolution_source?: string | null
          source_site?: Database["public"]["Enums"]["listing_source"] | null
          status?: string
          trigger_run_id?: string | null
          url: string
          url_hash: string
        }
        Update: {
          address?: string | null
          apify_run_id?: string | null
          city?: string | null
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          error_message?: string | null
          expires_at?: string
          id?: string
          lat?: number | null
          listing_dpe?: string | null
          listing_price?: number | null
          listing_surface?: number | null
          listing_title?: string | null
          lng?: number | null
          postal_code?: string | null
          profile_id?: string
          resolution_source?: string | null
          source_site?: Database["public"]["Enums"]["listing_source"] | null
          status?: string
          trigger_run_id?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "address_lookups_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          apify_run_id: string | null
          apify_run_ids: string[]
          archived_at: string | null
          code_postal: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          is_favorite: boolean
          items_cap_applied: number | null
          median_price_per_sqm: number | null
          median_score: number | null
          name: string | null
          params_snapshot: Json
          profile_id: string
          progress_pct: number
          search_filters: Json | null
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["analysis_status"]
          total_listings_filtered: number | null
          total_listings_raw: number | null
          trigger_run_id: string | null
          updated_at: string
          ville: string | null
          was_truncated: boolean
        }
        Insert: {
          apify_run_id?: string | null
          apify_run_ids?: string[]
          archived_at?: string | null
          code_postal?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_favorite?: boolean
          items_cap_applied?: number | null
          median_price_per_sqm?: number | null
          median_score?: number | null
          name?: string | null
          params_snapshot: Json
          profile_id: string
          progress_pct?: number
          search_filters?: Json | null
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          total_listings_filtered?: number | null
          total_listings_raw?: number | null
          trigger_run_id?: string | null
          updated_at?: string
          ville?: string | null
          was_truncated?: boolean
        }
        Update: {
          apify_run_id?: string | null
          apify_run_ids?: string[]
          archived_at?: string | null
          code_postal?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          is_favorite?: boolean
          items_cap_applied?: number | null
          median_price_per_sqm?: number | null
          median_score?: number | null
          name?: string | null
          params_snapshot?: Json
          profile_id?: string
          progress_pct?: number
          search_filters?: Json | null
          source_site?: Database["public"]["Enums"]["listing_source"]
          source_url?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["analysis_status"]
          total_listings_filtered?: number | null
          total_listings_raw?: number | null
          trigger_run_id?: string | null
          updated_at?: string
          ville?: string | null
          was_truncated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "analyses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      apify_listing_cache: {
        Row: {
          cached_at: string
          expires_at: string
          external_id: string
          external_id_site: string
          prix_at_cache: number
          raw_data: Json
          source_site: Database["public"]["Enums"]["listing_source"]
        }
        Insert: {
          cached_at?: string
          expires_at?: string
          external_id: string
          external_id_site: string
          prix_at_cache: number
          raw_data: Json
          source_site: Database["public"]["Enums"]["listing_source"]
        }
        Update: {
          cached_at?: string
          expires_at?: string
          external_id?: string
          external_id_site?: string
          prix_at_cache?: number
          raw_data?: Json
          source_site?: Database["public"]["Enums"]["listing_source"]
        }
        Relationships: []
      }
      apify_url_cache: {
        Row: {
          apify_run_id: string
          cached_at: string
          expires_at: string
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string
          total_listings: number
          url_hash: string
        }
        Insert: {
          apify_run_id: string
          cached_at?: string
          expires_at?: string
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string
          total_listings?: number
          url_hash: string
        }
        Update: {
          apify_run_id?: string
          cached_at?: string
          expires_at?: string
          source_site?: Database["public"]["Enums"]["listing_source"]
          source_url?: string
          total_listings?: number
          url_hash?: string
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          consumed_at: string | null
          consumed_resource_id: string | null
          created_at: string
          expires_at: string | null
          granted_at: string
          id: string
          metadata: Json
          profile_id: string
          source: string
          source_payment_id: string | null
          source_subscription_item_id: string | null
          status: Database["public"]["Enums"]["entitlement_status"]
          type: Database["public"]["Enums"]["entitlement_type"]
          updated_at: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_resource_id?: string | null
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json
          profile_id: string
          source?: string
          source_payment_id?: string | null
          source_subscription_item_id?: string | null
          status?: Database["public"]["Enums"]["entitlement_status"]
          type: Database["public"]["Enums"]["entitlement_type"]
          updated_at?: string
        }
        Update: {
          consumed_at?: string | null
          consumed_resource_id?: string | null
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json
          profile_id?: string
          source?: string
          source_payment_id?: string | null
          source_subscription_item_id?: string | null
          status?: Database["public"]["Enums"]["entitlement_status"]
          type?: Database["public"]["Enums"]["entitlement_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_scores: {
        Row: {
          analysis_id: string
          cashflow_mensuel: number | null
          claude_model: string | null
          claude_tokens_used: number | null
          cout_total_acquisition: number | null
          created_at: string
          ecart_prix_pct: number | null
          financement_claude: string | null
          frais_notaire: number | null
          id: string
          is_passoire_dpe: boolean | null
          listing_id: string
          loyer_estime: number | null
          loyer_m2_estime: number | null
          mensualite_credit: number | null
          negociation_claude: string | null
          prix_marche_estime: number | null
          prix_negociation_cible: number | null
          rendement_brut_pct: number | null
          rendement_net_net_pct: number | null
          rendement_net_pct: number | null
          risque_climat_2025: boolean | null
          risque_climat_2028: boolean | null
          risque_climat_2034: boolean | null
          score_cashflow: number
          score_dpe: number
          score_prix: number
          score_quartier: number
          score_rendement: number
          score_risques: number
          score_total: number
          scoring_version: string
          these_claude: string | null
          verdict: Database["public"]["Enums"]["verdict_type"] | null
        }
        Insert: {
          analysis_id: string
          cashflow_mensuel?: number | null
          claude_model?: string | null
          claude_tokens_used?: number | null
          cout_total_acquisition?: number | null
          created_at?: string
          ecart_prix_pct?: number | null
          financement_claude?: string | null
          frais_notaire?: number | null
          id?: string
          is_passoire_dpe?: boolean | null
          listing_id: string
          loyer_estime?: number | null
          loyer_m2_estime?: number | null
          mensualite_credit?: number | null
          negociation_claude?: string | null
          prix_marche_estime?: number | null
          prix_negociation_cible?: number | null
          rendement_brut_pct?: number | null
          rendement_net_net_pct?: number | null
          rendement_net_pct?: number | null
          risque_climat_2025?: boolean | null
          risque_climat_2028?: boolean | null
          risque_climat_2034?: boolean | null
          score_cashflow: number
          score_dpe: number
          score_prix: number
          score_quartier: number
          score_rendement: number
          score_risques: number
          score_total: number
          scoring_version?: string
          these_claude?: string | null
          verdict?: Database["public"]["Enums"]["verdict_type"] | null
        }
        Update: {
          analysis_id?: string
          cashflow_mensuel?: number | null
          claude_model?: string | null
          claude_tokens_used?: number | null
          cout_total_acquisition?: number | null
          created_at?: string
          ecart_prix_pct?: number | null
          financement_claude?: string | null
          frais_notaire?: number | null
          id?: string
          is_passoire_dpe?: boolean | null
          listing_id?: string
          loyer_estime?: number | null
          loyer_m2_estime?: number | null
          mensualite_credit?: number | null
          negociation_claude?: string | null
          prix_marche_estime?: number | null
          prix_negociation_cible?: number | null
          rendement_brut_pct?: number | null
          rendement_net_net_pct?: number | null
          rendement_net_pct?: number | null
          risque_climat_2025?: boolean | null
          risque_climat_2028?: boolean | null
          risque_climat_2034?: boolean | null
          score_cashflow?: number
          score_dpe?: number
          score_prix?: number
          score_quartier?: number
          score_rendement?: number
          score_risques?: number
          score_total?: number
          scoring_version?: string
          these_claude?: string | null
          verdict?: Database["public"]["Enums"]["verdict_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_scores_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_scores_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings_freemium_view"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address_confidence: number | null
          adresse_geocoded: string | null
          adresse_raw: string | null
          analysis_id: string
          annee_construction: number | null
          ascenseur: boolean | null
          balcon: boolean | null
          cave: boolean | null
          chambres: number | null
          charges_copro_annuelles: number | null
          code_insee: string | null
          code_postal: string | null
          description: string | null
          dpe: string | null
          etage: number | null
          external_id: string
          ges: string | null
          id: string
          is_exclusive: boolean | null
          is_new_construction: boolean | null
          lat: number | null
          lng: number | null
          parking: boolean | null
          photos_urls: string[] | null
          pieces: number | null
          prix: number
          published_at: string | null
          resolution_source: string | null
          scraped_at: string
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string
          surface: number | null
          taxe_fonciere: number | null
          terrasse: boolean | null
          title: string | null
          type: Database["public"]["Enums"]["bien_type"]
          ville: string | null
        }
        Insert: {
          address_confidence?: number | null
          adresse_geocoded?: string | null
          adresse_raw?: string | null
          analysis_id: string
          annee_construction?: number | null
          ascenseur?: boolean | null
          balcon?: boolean | null
          cave?: boolean | null
          chambres?: number | null
          charges_copro_annuelles?: number | null
          code_insee?: string | null
          code_postal?: string | null
          description?: string | null
          dpe?: string | null
          etage?: number | null
          external_id: string
          ges?: string | null
          id?: string
          is_exclusive?: boolean | null
          is_new_construction?: boolean | null
          lat?: number | null
          lng?: number | null
          parking?: boolean | null
          photos_urls?: string[] | null
          pieces?: number | null
          prix: number
          published_at?: string | null
          resolution_source?: string | null
          scraped_at?: string
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string
          surface?: number | null
          taxe_fonciere?: number | null
          terrasse?: boolean | null
          title?: string | null
          type: Database["public"]["Enums"]["bien_type"]
          ville?: string | null
        }
        Update: {
          address_confidence?: number | null
          adresse_geocoded?: string | null
          adresse_raw?: string | null
          analysis_id?: string
          annee_construction?: number | null
          ascenseur?: boolean | null
          balcon?: boolean | null
          cave?: boolean | null
          chambres?: number | null
          charges_copro_annuelles?: number | null
          code_insee?: string | null
          code_postal?: string | null
          description?: string | null
          dpe?: string | null
          etage?: number | null
          external_id?: string
          ges?: string | null
          id?: string
          is_exclusive?: boolean | null
          is_new_construction?: boolean | null
          lat?: number | null
          lng?: number | null
          parking?: boolean | null
          photos_urls?: string[] | null
          pieces?: number | null
          prix?: number
          published_at?: string | null
          resolution_source?: string | null
          scraped_at?: string
          source_site?: Database["public"]["Enums"]["listing_source"]
          source_url?: string
          surface?: number | null
          taxe_fonciere?: number | null
          terrasse?: boolean | null
          title?: string | null
          type?: Database["public"]["Enums"]["bien_type"]
          ville?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
      market_stats_cache: {
        Row: {
          bien_type: Database["public"]["Enums"]["bien_type"]
          commune_insee: string
          computed_at: string
          dpe_bin: Database["public"]["Enums"]["dpe_bin_type"]
          median_eur_m2: number
          n_transactions: number
          p25_eur_m2: number | null
          p75_eur_m2: number | null
          window_end: string
          window_start: string
        }
        Insert: {
          bien_type: Database["public"]["Enums"]["bien_type"]
          commune_insee: string
          computed_at?: string
          dpe_bin: Database["public"]["Enums"]["dpe_bin_type"]
          median_eur_m2: number
          n_transactions: number
          p25_eur_m2?: number | null
          p75_eur_m2?: number | null
          window_end: string
          window_start: string
        }
        Update: {
          bien_type?: Database["public"]["Enums"]["bien_type"]
          commune_insee?: string
          computed_at?: string
          dpe_bin?: Database["public"]["Enums"]["dpe_bin_type"]
          median_eur_m2?: number
          n_transactions?: number
          p25_eur_m2?: number | null
          p75_eur_m2?: number | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      pipeline_items: {
        Row: {
          adjusted_params: Json | null
          compromis_date: string | null
          created_at: string
          delisted_at: string | null
          delisted_reason: string | null
          id: string
          listing_id: string | null
          listing_snapshot: Json
          notes: string | null
          offre_price: number | null
          photos: string[] | null
          position: number
          profile_id: string
          signe_date: string | null
          stage: Database["public"]["Enums"]["pipeline_stage"]
          updated_at: string
          visite_date: string | null
        }
        Insert: {
          adjusted_params?: Json | null
          compromis_date?: string | null
          created_at?: string
          delisted_at?: string | null
          delisted_reason?: string | null
          id?: string
          listing_id?: string | null
          listing_snapshot: Json
          notes?: string | null
          offre_price?: number | null
          photos?: string[] | null
          position?: number
          profile_id: string
          signe_date?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
          visite_date?: string | null
        }
        Update: {
          adjusted_params?: Json | null
          compromis_date?: string | null
          created_at?: string
          delisted_at?: string | null
          delisted_reason?: string | null
          id?: string
          listing_id?: string | null
          listing_snapshot?: Json
          notes?: string | null
          offre_price?: number | null
          photos?: string[] | null
          position?: number
          profile_id?: string
          signe_date?: string | null
          stage?: Database["public"]["Enums"]["pipeline_stage"]
          updated_at?: string
          visite_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_freemium_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_items_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          marketing_emails_opt_in: boolean
          preferred_locale: string | null
          stripe_customer_id: string | null
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          subscription_status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          marketing_emails_opt_in?: boolean
          preferred_locale?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          marketing_emails_opt_in?: boolean
          preferred_locale?: string | null
          stripe_customer_id?: string | null
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          subscription_status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          id: string
          processed_at: string
          type: string
        }
        Insert: {
          created_at?: string
          id: string
          processed_at?: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          profile_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id: string
          stripe_subscription_id: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          profile_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id: string
          stripe_subscription_id: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          profile_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_price_id?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          analyses_concurrent: number
          analyses_used: number
          created_at: string
          id: string
          paste_urls_reset_at: string | null
          paste_urls_used_today: number
          period_end: string
          period_start: string
          profile_id: string
          updated_at: string
          watch_runs_used: number
        }
        Insert: {
          analyses_concurrent?: number
          analyses_used?: number
          created_at?: string
          id?: string
          paste_urls_reset_at?: string | null
          paste_urls_used_today?: number
          period_end: string
          period_start: string
          profile_id: string
          updated_at?: string
          watch_runs_used?: number
        }
        Update: {
          analyses_concurrent?: number
          analyses_used?: number
          created_at?: string
          id?: string
          paste_urls_reset_at?: string | null
          paste_urls_used_today?: number
          period_end?: string
          period_start?: string
          profile_id?: string
          updated_at?: string
          watch_runs_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_params: {
        Row: {
          apport: number
          budget_max: number | null
          created_at: string
          duree_credit_ans: number
          id: string
          profile_id: string
          rendement_min_pct: number
          scoring_weights: Json | null
          strategy: Database["public"]["Enums"]["strategy_type"]
          taux_credit_pct: number
          tmi_pct: number
          tolerance_travaux: Database["public"]["Enums"]["travaux_tolerance"]
          updated_at: string
        }
        Insert: {
          apport?: number
          budget_max?: number | null
          created_at?: string
          duree_credit_ans?: number
          id?: string
          profile_id: string
          rendement_min_pct?: number
          scoring_weights?: Json | null
          strategy?: Database["public"]["Enums"]["strategy_type"]
          taux_credit_pct?: number
          tmi_pct?: number
          tolerance_travaux?: Database["public"]["Enums"]["travaux_tolerance"]
          updated_at?: string
        }
        Update: {
          apport?: number
          budget_max?: number | null
          created_at?: string
          duree_credit_ans?: number
          id?: string
          profile_id?: string
          rendement_min_pct?: number
          scoring_weights?: Json | null
          strategy?: Database["public"]["Enums"]["strategy_type"]
          taux_credit_pct?: number
          tmi_pct?: number
          tolerance_travaux?: Database["public"]["Enums"]["travaux_tolerance"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_params_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_events: {
        Row: {
          created_at: string
          digest_sent_at: string | null
          event_type: Database["public"]["Enums"]["watch_event_type"]
          id: string
          included_in_digest: boolean
          payload: Json
          watch_id: string
          watch_listing_id: string | null
          watch_run_id: string | null
        }
        Insert: {
          created_at?: string
          digest_sent_at?: string | null
          event_type: Database["public"]["Enums"]["watch_event_type"]
          id?: string
          included_in_digest?: boolean
          payload?: Json
          watch_id: string
          watch_listing_id?: string | null
          watch_run_id?: string | null
        }
        Update: {
          created_at?: string
          digest_sent_at?: string | null
          event_type?: Database["public"]["Enums"]["watch_event_type"]
          id?: string
          included_in_digest?: boolean
          payload?: Json
          watch_id?: string
          watch_listing_id?: string | null
          watch_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "watch_events_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_events_watch_listing_id_fkey"
            columns: ["watch_listing_id"]
            isOneToOne: false
            referencedRelation: "watch_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_events_watch_run_id_fkey"
            columns: ["watch_run_id"]
            isOneToOne: false
            referencedRelation: "watch_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_listings: {
        Row: {
          created_at: string
          current_dpe: string | null
          current_price: number
          current_score: number | null
          current_status: Database["public"]["Enums"]["watch_listing_status"]
          current_surface: number | null
          external_id: string
          first_seen_at: string
          id: string
          is_in_pipeline: boolean
          last_seen_at: string
          listing_id: string | null
          notified_at: string | null
          price_history: Json
          removed_since: string | null
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string
          title: string | null
          updated_at: string
          watch_id: string
        }
        Insert: {
          created_at?: string
          current_dpe?: string | null
          current_price: number
          current_score?: number | null
          current_status?: Database["public"]["Enums"]["watch_listing_status"]
          current_surface?: number | null
          external_id: string
          first_seen_at?: string
          id?: string
          is_in_pipeline?: boolean
          last_seen_at?: string
          listing_id?: string | null
          notified_at?: string | null
          price_history?: Json
          removed_since?: string | null
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string
          title?: string | null
          updated_at?: string
          watch_id: string
        }
        Update: {
          created_at?: string
          current_dpe?: string | null
          current_price?: number
          current_score?: number | null
          current_status?: Database["public"]["Enums"]["watch_listing_status"]
          current_surface?: number | null
          external_id?: string
          first_seen_at?: string
          id?: string
          is_in_pipeline?: boolean
          last_seen_at?: string
          listing_id?: string | null
          notified_at?: string | null
          price_history?: Json
          removed_since?: string | null
          source_site?: Database["public"]["Enums"]["listing_source"]
          source_url?: string
          title?: string | null
          updated_at?: string
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_listings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings_freemium_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_listings_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_runs: {
        Row: {
          apify_run_ids: string[]
          created_at: string
          drop_count: number
          duration_ms: number | null
          error_message: string | null
          estimated_cost_eur: number
          finished_at: string | null
          id: string
          items_scraped: number
          market_stats: Json
          new_count: number
          relisted_count: number
          removed_count: number
          signal_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["watch_run_status"]
          trigger_run_id: string | null
          truncated: boolean
          watch_id: string
        }
        Insert: {
          apify_run_ids?: string[]
          created_at?: string
          drop_count?: number
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_eur?: number
          finished_at?: string | null
          id?: string
          items_scraped?: number
          market_stats?: Json
          new_count?: number
          relisted_count?: number
          removed_count?: number
          signal_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["watch_run_status"]
          trigger_run_id?: string | null
          truncated?: boolean
          watch_id: string
        }
        Update: {
          apify_run_ids?: string[]
          created_at?: string
          drop_count?: number
          duration_ms?: number | null
          error_message?: string | null
          estimated_cost_eur?: number
          finished_at?: string | null
          id?: string
          items_scraped?: number
          market_stats?: Json
          new_count?: number
          relisted_count?: number
          removed_count?: number
          signal_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["watch_run_status"]
          trigger_run_id?: string | null
          truncated?: boolean
          watch_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_runs_watch_id_fkey"
            columns: ["watch_id"]
            isOneToOne: false
            referencedRelation: "watches"
            referencedColumns: ["id"]
          },
        ]
      }
      watches: {
        Row: {
          consecutive_truncated_runs: number
          created_at: string
          expiration_emails_sent: string[]
          expires_at: string | null
          frequency: Database["public"]["Enums"]["watch_frequency"]
          id: string
          is_active: boolean
          last_analysis_id: string | null
          last_run_at: string | null
          last_run_status:
            | Database["public"]["Enums"]["watch_run_status"]
            | null
          name: string
          next_run_at: string
          notify_email: boolean
          notify_push: boolean
          notify_telegram: boolean
          profile_id: string
          score_threshold: number
          search_filters: Json | null
          sensitivity: Database["public"]["Enums"]["watch_sensitivity"]
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url: string | null
          stats_7d: Json
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          consecutive_truncated_runs?: number
          created_at?: string
          expiration_emails_sent?: string[]
          expires_at?: string | null
          frequency?: Database["public"]["Enums"]["watch_frequency"]
          id?: string
          is_active?: boolean
          last_analysis_id?: string | null
          last_run_at?: string | null
          last_run_status?:
            | Database["public"]["Enums"]["watch_run_status"]
            | null
          name: string
          next_run_at?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_telegram?: boolean
          profile_id: string
          score_threshold?: number
          search_filters?: Json | null
          sensitivity?: Database["public"]["Enums"]["watch_sensitivity"]
          source_site: Database["public"]["Enums"]["listing_source"]
          source_url?: string | null
          stats_7d?: Json
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          consecutive_truncated_runs?: number
          created_at?: string
          expiration_emails_sent?: string[]
          expires_at?: string | null
          frequency?: Database["public"]["Enums"]["watch_frequency"]
          id?: string
          is_active?: boolean
          last_analysis_id?: string | null
          last_run_at?: string | null
          last_run_status?:
            | Database["public"]["Enums"]["watch_run_status"]
            | null
          name?: string
          next_run_at?: string
          notify_email?: boolean
          notify_push?: boolean
          notify_telegram?: boolean
          profile_id?: string
          score_threshold?: number
          search_filters?: Json | null
          sensitivity?: Database["public"]["Enums"]["watch_sensitivity"]
          source_site?: Database["public"]["Enums"]["listing_source"]
          source_url?: string | null
          stats_7d?: Json
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "watches_last_analysis_id_fkey"
            columns: ["last_analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      listings_freemium_view: {
        Row: {
          address_confidence: number | null
          adresse_geocoded: string | null
          adresse_raw: string | null
          analysis_id: string | null
          annee_construction: number | null
          ascenseur: boolean | null
          balcon: boolean | null
          cashflow_mensuel: number | null
          cave: boolean | null
          chambres: number | null
          charges_copro_annuelles: number | null
          code_postal: string | null
          description: string | null
          dpe: string | null
          ecart_prix_pct: number | null
          etage: number | null
          external_id: string | null
          financement_claude: string | null
          ges: string | null
          id: string | null
          is_exclusive: boolean | null
          is_masked: boolean | null
          is_new_construction: boolean | null
          is_passoire_dpe: boolean | null
          lat: number | null
          lng: number | null
          loyer_estime: number | null
          negociation_claude: string | null
          parking: boolean | null
          photos_urls: string[] | null
          pieces: number | null
          prix: number | null
          prix_marche_estime: number | null
          prix_negociation_cible: number | null
          published_at: string | null
          rendement_brut_pct: number | null
          rendement_net_pct: number | null
          resolution_source: string | null
          score_cashflow: number | null
          score_dpe: number | null
          score_prix: number | null
          score_quartier: number | null
          score_rendement: number | null
          score_risques: number | null
          score_total: number | null
          scraped_at: string | null
          source_site: Database["public"]["Enums"]["listing_source"] | null
          source_url: string | null
          surface: number | null
          taxe_fonciere: number | null
          terrasse: boolean | null
          these_claude: string | null
          title: string | null
          type: Database["public"]["Enums"]["bien_type"] | null
          verdict: Database["public"]["Enums"]["verdict_type"] | null
          ville: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      append_apify_run_id: {
        Args: { p_analysis_id: string; p_run_id: string }
        Returns: undefined
      }
      can_lookup_address: { Args: { p_profile_id: string }; Returns: Json }
      current_billing_period: {
        Args: { p_profile_id: string }
        Returns: {
          period_end: string
          period_start: string
        }[]
      }
      current_month_analyses_count: {
        Args: { p_profile_id: string }
        Returns: number
      }
      current_user_plan: {
        Args: never
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      dashboard_summary: {
        Args: { p_profile_id: string }
        Returns: Json
      }
      decrement_concurrent_analysis: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      ensure_usage_counter: {
        Args: { p_profile_id: string }
        Returns: {
          analyses_concurrent: number
          analyses_used: number
          created_at: string
          id: string
          paste_urls_reset_at: string | null
          paste_urls_used_today: number
          period_end: string
          period_start: string
          profile_id: string
          updated_at: string
          watch_runs_used: number
        }
        SetofOptions: {
          from: "*"
          to: "usage_counters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      increment_analysis_counter: {
        Args: { p_analysis_id: string; p_profile_id: string }
        Returns: Json
      }
      is_quota_exceeded: {
        Args: {
          p_action: string
          p_profile_id: string
          p_requested_count?: number
        }
        Returns: Json
      }
      is_user_paid: { Args: never; Returns: boolean }
      plan_limits: {
        Args: { p_plan: Database["public"]["Enums"]["subscription_plan"] }
        Returns: Json
      }
      purge_watch_listings: { Args: never; Returns: number }
      suspend_expired_watches: { Args: never; Returns: number }
      watches_to_dispatch: {
        Args: { p_schedule: string }
        Returns: {
          plan: Database["public"]["Enums"]["subscription_plan"]
          profile_id: string
          watch_id: string
        }[]
      }
    }
    Enums: {
      analysis_status:
        | "pending"
        | "scraping"
        | "enriching"
        | "scoring"
        | "generating"
        | "done"
        | "failed"
        | "canceled"
      bien_type: "appartement" | "maison" | "terrain" | "immeuble" | "autre"
      dpe_bin_type: "A_C" | "D_E" | "F_G" | "unknown"
      entitlement_status:
        | "pending"
        | "active"
        | "consumed"
        | "expired"
        | "refunded"
      entitlement_type:
        | "ppu_analysis"
        | "ppu_watch_bonus"
        | "addon_watch_unit"
        | "addon_watch_pack3"
        | "addon_watch_daily"
        | "addon_watch_pack3_daily"
        | "addon_seat"
      listing_source: "seloger" | "leboncoin" | "bienici" | "pap" | "logic_immo"
      pipeline_stage: "a_visiter" | "visite" | "offre" | "compromis" | "signe"
      strategy_type:
        | "locatif_nu"
        | "lmnp_meuble"
        | "mixte"
        | "colocation"
        | "courte_duree"
      subscription_plan: "free" | "pro" | "pro_plus" | "business"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "incomplete_expired"
        | "unpaid"
      travaux_tolerance: "aucun" | "leger" | "moyen" | "lourd"
      verdict_type: "a_visiter" | "sous_reserve" | "no_go"
      watch_event_type:
        | "new_match"
        | "price_drop"
        | "signal_to_verify"
        | "relisted"
        | "removed"
        | "price_rise"
      watch_frequency: "daily" | "three_days" | "weekly"
      watch_listing_status: "new" | "tracked" | "removed" | "gone"
      watch_run_status:
        | "pending"
        | "running"
        | "succeeded"
        | "failed"
        | "canceled"
      watch_sensitivity: "strict" | "moderate" | "permissive"
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
      analysis_status: [
        "pending",
        "scraping",
        "enriching",
        "scoring",
        "generating",
        "done",
        "failed",
        "canceled",
      ],
      bien_type: ["appartement", "maison", "terrain", "immeuble", "autre"],
      dpe_bin_type: ["A_C", "D_E", "F_G", "unknown"],
      entitlement_status: [
        "pending",
        "active",
        "consumed",
        "expired",
        "refunded",
      ],
      entitlement_type: [
        "ppu_analysis",
        "ppu_watch_bonus",
        "addon_watch_unit",
        "addon_watch_pack3",
        "addon_watch_daily",
        "addon_watch_pack3_daily",
        "addon_seat",
      ],
      listing_source: ["seloger", "leboncoin", "bienici", "pap", "logic_immo"],
      pipeline_stage: ["a_visiter", "visite", "offre", "compromis", "signe"],
      strategy_type: [
        "locatif_nu",
        "lmnp_meuble",
        "mixte",
        "colocation",
        "courte_duree",
      ],
      subscription_plan: ["free", "pro", "pro_plus", "business"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
      ],
      travaux_tolerance: ["aucun", "leger", "moyen", "lourd"],
      verdict_type: ["a_visiter", "sous_reserve", "no_go"],
      watch_event_type: [
        "new_match",
        "price_drop",
        "signal_to_verify",
        "relisted",
        "removed",
        "price_rise",
      ],
      watch_frequency: ["daily", "three_days", "weekly"],
      watch_listing_status: ["new", "tracked", "removed", "gone"],
      watch_run_status: [
        "pending",
        "running",
        "succeeded",
        "failed",
        "canceled",
      ],
      watch_sensitivity: ["strict", "moderate", "permissive"],
    },
  },
} as const
