// ─────────────────────────────────────────────────────────────────────
// ImmoValue — Types TypeScript pour le schéma SQL `value` de immoscan-app
// ─────────────────────────────────────────────────────────────────────
// Ces types ne sont PAS regenerés par `supabase gen types` tant que la
// config `[api].schemas` du projet remote n'inclut pas `value`
// (cf supabase-app/supabase/config.toml — update appliqué localement,
//  à appliquer côté Dashboard pour le projet remote).
//
// En attendant, on maintient ces types à la main, synchronisés avec la
// migration `20260521000000_value_schema.sql`.
// ─────────────────────────────────────────────────────────────────────

import type { Json } from "./app.types.js"

export type ValueDatabase = {
  value: {
    Tables: {
      biens: {
        Row: {
          id: string
          user_id: string
          status: "suivi" | "discret" | "public" | "vendu" | "retire"
          address: string
          address_hash: string
          lat: number
          lng: number
          geom: unknown // PostGIS geometry — opaque côté JS
          code_insee: string
          code_iris: string
          bien_data: Json
          photos_originales_urls: string[]
          photos_floutees_urls: string[] | null
          user_provided_urls: string[] | null
          valo_courante: Json | null
          valo_initiale: Json | null
          valo_updated_at: string | null
          valo_confiance: number | null
          prix_affiche: number | null
          prix_affiche_updated_at: string | null
          prix_history: Json
          description_publique: string | null
          contact_settings: Json | null
          alert_threshold_pct: number
          alert_frequency:
            | "never"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "on_significant_change"
          anon_settings: Json
          published_at: string | null
          discret_started_at: string | null
          sold_at: string | null
          withdrawn_at: string | null
          stripe_payment_id: string | null
          paywall_unlocked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: "suivi" | "discret" | "public" | "vendu" | "retire"
          address: string
          address_hash: string
          lat: number
          lng: number
          code_insee: string
          code_iris: string
          bien_data: Json
          photos_originales_urls?: string[]
          photos_floutees_urls?: string[] | null
          user_provided_urls?: string[] | null
          valo_courante?: Json | null
          valo_initiale?: Json | null
          valo_updated_at?: string | null
          valo_confiance?: number | null
          prix_affiche?: number | null
          prix_affiche_updated_at?: string | null
          prix_history?: Json
          description_publique?: string | null
          contact_settings?: Json | null
          alert_threshold_pct?: number
          alert_frequency?:
            | "never"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "on_significant_change"
          anon_settings?: Json
          published_at?: string | null
          discret_started_at?: string | null
          sold_at?: string | null
          withdrawn_at?: string | null
          stripe_payment_id?: string | null
          paywall_unlocked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: "suivi" | "discret" | "public" | "vendu" | "retire"
          address?: string
          address_hash?: string
          lat?: number
          lng?: number
          code_insee?: string
          code_iris?: string
          bien_data?: Json
          photos_originales_urls?: string[]
          photos_floutees_urls?: string[] | null
          user_provided_urls?: string[] | null
          valo_courante?: Json | null
          valo_initiale?: Json | null
          valo_updated_at?: string | null
          valo_confiance?: number | null
          prix_affiche?: number | null
          prix_affiche_updated_at?: string | null
          prix_history?: Json
          description_publique?: string | null
          contact_settings?: Json | null
          alert_threshold_pct?: number
          alert_frequency?:
            | "never"
            | "weekly"
            | "monthly"
            | "quarterly"
            | "on_significant_change"
          anon_settings?: Json
          published_at?: string | null
          discret_started_at?: string | null
          sold_at?: string | null
          withdrawn_at?: string | null
          stripe_payment_id?: string | null
          paywall_unlocked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      valos_historique: {
        Row: {
          id: string
          bien_id: string
          valo: Json
          delta_pct: number | null
          trigger:
            | "initial"
            | "weekly_recompute"
            | "monthly_recompute"
            | "manual_refresh"
            | "photo_updated"
            | "bien_data_updated"
            | "user_links_updated"
          alert_sent: boolean
          alert_sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          bien_id: string
          valo: Json
          delta_pct?: number | null
          trigger:
            | "initial"
            | "weekly_recompute"
            | "monthly_recompute"
            | "manual_refresh"
            | "photo_updated"
            | "bien_data_updated"
            | "user_links_updated"
          alert_sent?: boolean
          alert_sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          bien_id?: string
          valo?: Json
          delta_pct?: number | null
          trigger?:
            | "initial"
            | "weekly_recompute"
            | "monthly_recompute"
            | "manual_refresh"
            | "photo_updated"
            | "bien_data_updated"
            | "user_links_updated"
          alert_sent?: boolean
          alert_sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "valos_historique_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      user_provided_comparables: {
        Row: {
          id: string
          bien_id: string
          url_source: string
          marketplace: "seloger" | "leboncoin"
          scraped_at: string
          scraped_count: number
          truncated: boolean
          items: Json
          apify_run_id: string | null
        }
        Insert: {
          id?: string
          bien_id: string
          url_source: string
          marketplace: "seloger" | "leboncoin"
          scraped_at?: string
          scraped_count?: number
          truncated?: boolean
          items?: Json
          apify_run_id?: string | null
        }
        Update: {
          id?: string
          bien_id?: string
          url_source?: string
          marketplace?: "seloger" | "leboncoin"
          scraped_at?: string
          scraped_count?: number
          truncated?: boolean
          items?: Json
          apify_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_provided_comparables_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      favoris: {
        Row: {
          id: string
          bien_id: string
          user_id: string
          favori_type: "discret" | "public"
          notify_on_public: boolean
          notify_on_price_drop: boolean
          notify_on_price_drop_threshold_pct: number
          buyer_profile_snapshot: Json | null
          added_at: string
          last_viewed_at: string | null
          notified_at: string | null
        }
        Insert: {
          id?: string
          bien_id: string
          user_id: string
          favori_type?: "discret" | "public"
          notify_on_public?: boolean
          notify_on_price_drop?: boolean
          notify_on_price_drop_threshold_pct?: number
          buyer_profile_snapshot?: Json | null
          added_at?: string
          last_viewed_at?: string | null
          notified_at?: string | null
        }
        Update: {
          id?: string
          bien_id?: string
          user_id?: string
          favori_type?: "discret" | "public"
          notify_on_public?: boolean
          notify_on_price_drop?: boolean
          notify_on_price_drop_threshold_pct?: number
          buyer_profile_snapshot?: Json | null
          added_at?: string
          last_viewed_at?: string | null
          notified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favoris_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_events: {
        Row: {
          id: string
          bien_id: string
          visitor_hash: string
          visitor_user_id: string | null
          event_type:
            | "view"
            | "long_view"
            | "favorite_add"
            | "favorite_remove"
            | "share"
            | "return_visit"
            | "photo_carousel_open"
            | "map_zoom"
            | "contact_intent"
            | "price_history_view"
          duree_sec: number | null
          source: string | null
          buyer_profile_snapshot: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          bien_id: string
          visitor_hash: string
          visitor_user_id?: string | null
          event_type:
            | "view"
            | "long_view"
            | "favorite_add"
            | "favorite_remove"
            | "share"
            | "return_visit"
            | "photo_carousel_open"
            | "map_zoom"
            | "contact_intent"
            | "price_history_view"
          duree_sec?: number | null
          source?: string | null
          buyer_profile_snapshot?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          bien_id?: string
          visitor_hash?: string
          visitor_user_id?: string | null
          event_type?:
            | "view"
            | "long_view"
            | "favorite_add"
            | "favorite_remove"
            | "share"
            | "return_visit"
            | "photo_carousel_open"
            | "map_zoom"
            | "contact_intent"
            | "price_history_view"
          duree_sec?: number | null
          source?: string | null
          buyer_profile_snapshot?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_events_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      bien_stats: {
        Row: {
          bien_id: string
          vues_total: number
          vues_uniques: number
          vues_7j: number
          vues_30j: number
          favoris_actifs: number
          favoris_total_historique: number
          partages_total: number
          retours_visiteurs: number
          duree_consultation_mediane_sec: number | null
          taux_long_view: number | null
          pct_vues_investisseurs: number | null
          pct_vues_primo: number | null
          pct_vues_secundo: number | null
          score_moyen_acheteurs: number | null
          trend_vues_7j_vs_30j_pct: number | null
          trend_favoris_7j: number | null
          vues_vs_mediane_iris_pct: number | null
          favoris_vs_mediane_iris_pct: number | null
          computed_at: string
        }
        Insert: {
          bien_id: string
          vues_total?: number
          vues_uniques?: number
          vues_7j?: number
          vues_30j?: number
          favoris_actifs?: number
          favoris_total_historique?: number
          partages_total?: number
          retours_visiteurs?: number
          duree_consultation_mediane_sec?: number | null
          taux_long_view?: number | null
          pct_vues_investisseurs?: number | null
          pct_vues_primo?: number | null
          pct_vues_secundo?: number | null
          score_moyen_acheteurs?: number | null
          trend_vues_7j_vs_30j_pct?: number | null
          trend_favoris_7j?: number | null
          vues_vs_mediane_iris_pct?: number | null
          favoris_vs_mediane_iris_pct?: number | null
          computed_at?: string
        }
        Update: {
          bien_id?: string
          vues_total?: number
          vues_uniques?: number
          vues_7j?: number
          vues_30j?: number
          favoris_actifs?: number
          favoris_total_historique?: number
          partages_total?: number
          retours_visiteurs?: number
          duree_consultation_mediane_sec?: number | null
          taux_long_view?: number | null
          pct_vues_investisseurs?: number | null
          pct_vues_primo?: number | null
          pct_vues_secundo?: number | null
          score_moyen_acheteurs?: number | null
          trend_vues_7j_vs_30j_pct?: number | null
          trend_favoris_7j?: number | null
          vues_vs_mediane_iris_pct?: number | null
          favoris_vs_mediane_iris_pct?: number | null
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bien_stats_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: true
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          id: string
          bien_id: string
          acheteur_user_id: string | null
          acheteur_email: string | null
          acheteur_telephone: string | null
          message: string
          vendeur_reply: string | null
          vendeur_replied_at: string | null
          status: "pending" | "read" | "replied" | "archived" | "spam"
          spam_score: number | null
          created_at: string
        }
        Insert: {
          id?: string
          bien_id: string
          acheteur_user_id?: string | null
          acheteur_email?: string | null
          acheteur_telephone?: string | null
          message: string
          vendeur_reply?: string | null
          vendeur_replied_at?: string | null
          status?: "pending" | "read" | "replied" | "archived" | "spam"
          spam_score?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          bien_id?: string
          acheteur_user_id?: string | null
          acheteur_email?: string | null
          acheteur_telephone?: string | null
          message?: string
          vendeur_reply?: string | null
          vendeur_replied_at?: string | null
          status?: "pending" | "read" | "replied" | "archived" | "spam"
          spam_score?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
      packs_annonces: {
        Row: {
          id: string
          bien_id: string
          user_id: string
          targets: string[]
          content: Json
          stripe_payment_id: string | null
          generated_at: string
          downloaded_at: string | null
        }
        Insert: {
          id?: string
          bien_id: string
          user_id: string
          targets: string[]
          content: Json
          stripe_payment_id?: string | null
          generated_at?: string
          downloaded_at?: string | null
        }
        Update: {
          id?: string
          bien_id?: string
          user_id?: string
          targets?: string[]
          content?: Json
          stripe_payment_id?: string | null
          generated_at?: string
          downloaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "packs_annonces_bien_id_fkey"
            columns: ["bien_id"]
            isOneToOne: false
            referencedRelation: "biens"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      biens_publics: {
        Row: {
          id: string | null
          status: string | null
          address_display: string | null
          lat_display: number | null
          lng_display: number | null
          code_iris: string | null
          code_insee: string | null
          bien_data: Json | null
          photos: string[] | null
          prix_affiche: number | null
          valorisation_publique: Json | null
          description_publique: string | null
          favoris_actifs: number | null
          vues_total: number | null
          vues_7j: number | null
          discret_started_at: string | null
          published_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      anonymize_address: {
        Args: { p_address: string; p_settings: Json }
        Returns: string
      }
      anonymize_bien_data: {
        Args: { p_bien_data: Json; p_status: string; p_anon_settings: Json }
        Returns: Json
      }
      format_valorisation_publique: {
        Args: { p_valo: Json; p_status: string }
        Returns: Json
      }
      format_iris_label: {
        Args: { p_address: string }
        Returns: string
      }
      extract_commune: {
        Args: { p_address: string }
        Returns: string
      }
      extract_arrondissement: {
        Args: { p_address: string }
        Returns: string
      }
      snap_to_iris_centroid_lat: {
        Args: { p_lat: number; p_lng: number; p_code_iris: string }
        Returns: number
      }
      snap_to_iris_centroid_lng: {
        Args: { p_lat: number; p_lng: number; p_code_iris: string }
        Returns: number
      }
      bucket_surface: {
        Args: { p_surface: number }
        Returns: string
      }
      bucket_etage: {
        Args: { p_etage: number }
        Returns: string
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Helpers raccourcis pour l'usage côté apps/web et apps/worker
export type ValueTables = ValueDatabase["value"]["Tables"]
export type ValueBien = ValueTables["biens"]["Row"]
export type ValueBienInsert = ValueTables["biens"]["Insert"]
export type ValueBienUpdate = ValueTables["biens"]["Update"]
export type ValueBienPublic = ValueDatabase["value"]["Views"]["biens_publics"]["Row"]
export type ValueValoHistorique = ValueTables["valos_historique"]["Row"]
export type ValueUserProvidedComparable = ValueTables["user_provided_comparables"]["Row"]
export type ValueFavori = ValueTables["favoris"]["Row"]
export type ValueConsultationEvent = ValueTables["consultation_events"]["Row"]
export type ValueBienStats = ValueTables["bien_stats"]["Row"]
export type ValueContact = ValueTables["contacts"]["Row"]
export type ValuePackAnnonce = ValueTables["packs_annonces"]["Row"]

export type ValueBienStatus =
  | "suivi"
  | "discret"
  | "public"
  | "vendu"
  | "retire"

export type ValueAlertFrequency =
  | "never"
  | "weekly"
  | "monthly"
  | "quarterly"
  | "on_significant_change"

export type ValueValoTrigger =
  | "initial"
  | "weekly_recompute"
  | "monthly_recompute"
  | "manual_refresh"
  | "photo_updated"
  | "bien_data_updated"
  | "user_links_updated"

export type ValueConsultationEventType =
  | "view"
  | "long_view"
  | "favorite_add"
  | "favorite_remove"
  | "share"
  | "return_visit"
  | "photo_carousel_open"
  | "map_zoom"
  | "contact_intent"
  | "price_history_view"

export type ValueContactStatus =
  | "pending"
  | "read"
  | "replied"
  | "archived"
  | "spam"

export type ValueMarketplace = "seloger" | "leboncoin"
