# ImmoValue — Schéma de base de données

Ce document décrit le schéma SQL `value` du projet Supabase `immoscan-app`
(projet `vztzzysrainmznjnurbl`, région eu-west-3). Tout vit dans ce projet
unique pour partager `auth.users` avec ImmoScan.

Migration : `supabase-app/supabase/migrations/20260521000000_value_schema.sql`.

## 1. Tables (8)

```
                                  ┌────────────────────────────────┐
                                  │ auth.users (Supabase Auth)     │
                                  └─────────────┬──────────────────┘
                                                │ user_id (FK)
                                                ▼
                ┌───────────────────────────────────────────────────────┐
                │                  value.biens                          │
                │  status (suivi/discret/public/vendu/retire)           │
                │  address, lat, lng, geom (PostGIS Point 4326)         │
                │  bien_data jsonb, photos_originales/floutees text[]   │
                │  user_provided_urls text[] (3 max) ⭐                 │
                │  valo_courante, valo_initiale jsonb                   │
                │  anon_settings, alert_threshold_pct, alert_frequency  │
                │  stripe_payment_id, paywall_unlocked_at               │
                └─┬────────┬────────┬────────┬────────┬────────┬───────┘
                  │        │        │        │        │        │
                  │        │        │        │        │        │ bien_id (FK CASCADE)
        ┌─────────┘        │        │        │        │        └────────┐
        ▼                  ▼        ▼        ▼        ▼                  ▼
┌──────────────┐ ┌─────────────────┐ ┌──────────┐ ┌──────────────────┐ ┌──────────────┐
│ valos_       │ │ user_provided_  │ │ favoris  │ │ consultation_    │ │ bien_stats   │
│ historique   │ │ comparables ⭐  │ │          │ │ events           │ │  (PK=bien_id)│
│  (audit)     │ │  (items jsonb)  │ │  unique  │ │  (events bruts)  │ │  (agrégats)  │
│              │ │                 │ │  (bien,  │ │                  │ │              │
│              │ │                 │ │   user)  │ │                  │ │              │
└──────────────┘ └─────────────────┘ └──────────┘ └──────────────────┘ └──────────────┘

                  ┌──────────────┐                ┌────────────────┐
                  │  contacts    │                │ packs_annonces │
                  │  (vendeur ↔  │                │  (Stripe paywall│
                  │   acheteur)  │                │   pack à publier│
                  │              │                │   ailleurs)    │
                  └──────────────┘                └────────────────┘
```

| Table | Rôle |
|---|---|
| `value.biens` | Objet pivot. Tous les états (suivi/discret/public/vendu/retire) du même bien. |
| `value.valos_historique` | Audit trail de chaque (re)valorisation IA, avec `trigger` et `delta_pct`. |
| `value.user_provided_comparables` ⭐ | Items scrapés depuis les 0-3 URLs SeLoger/LBC fournies par l'user. |
| `value.favoris` | Acheteurs intéressés. Type discret/public selon visibilité. |
| `value.consultation_events` | Events bruts (`view`, `long_view`, `share`...). Service_role only. |
| `value.bien_stats` | Agrégats matérialisés du worker `value-compute-stats`. PK = `bien_id`. |
| `value.contacts` | Messages acheteur → vendeur (mode public uniquement). |
| `value.packs_annonces` | Pack à publier ailleurs (Stripe payant). |

## 2. Fonctions d'anonymisation (CRITICAL — serveur uniquement)

Toutes en `SECURITY DEFINER` + `IMMUTABLE` + `search_path = public, pg_temp`.
Elles encapsulent le contrat "le user ne reçoit jamais les données sensibles
côté navigateur" — calqué sur le principe ImmoScan `listings_freemium_view`.

| Fonction | Rôle | Stub V1 / V2 |
|---|---|---|
| `value.anonymize_address(p_address, p_settings)` | Dispatch sur `quartier_displayed` (iris/commune/arrondissement). | V1 OK |
| `value.format_iris_label(p_address)` | "Le Chénay, Gagny (93)". | **Stub V1 = `extract_commune`**. V2 = join sur `immoscan-data.insee_iris`. |
| `value.extract_commune(p_address)` | Extrait ville + dept depuis le dernier segment. Regexp sur code postal `\m\d{5}\M`. | V1 OK |
| `value.extract_arrondissement(p_address)` | "Paris 19e", "Lyon 3e", "Marseille 8e". Détecte CP 75/690/130-131. | V1 OK |
| `value.snap_to_iris_centroid_lat/lng(p_lat, p_lng, p_code_iris)` | Arrondi à 0.005° (~500-550m). | **Stub V1**. V2 = lookup `insee_iris.centroid_*`. |
| `value.bucket_surface(p_surface)` | "60-70m²" (pas 10 jusqu'à 100, pas 20 jusqu'à 200, pas 50 jusqu'à 300). | V1 OK |
| `value.bucket_etage(p_etage)` | RDC / 1er / "2e à 4e" / "5e à 9e" / "≥10e". | V1 OK |
| `value.anonymize_bien_data(p_bien_data, p_status, p_anon_settings)` | Si `public` → identité. Si `discret` → applique bucket_surface/etage selon prefs + supprime `particularites_uniques`. | V1 OK |
| `value.format_valorisation_publique(p_valo, p_status)` | `public` → fourchette + estimation centrale + confiance. `discret` → fourchette + confiance (pas l'estimation centrale exacte). | V1 OK |

## 3. La vue `value.biens_publics`

Vue accessible publiquement (`anon` + `authenticated`) via le client REST
Supabase. Filtre `WHERE status IN ('discret', 'public')` → un bien `suivi`
ou `vendu` ne fuite jamais.

Pattern de sécurité (calqué sur `listings_freemium_view`) :

```sql
create or replace view value.biens_publics
with (security_invoker = off)   -- ← mode DEFINER, bypass RLS
as ...
```

- `security_invoker = off` → la vue tourne avec les droits du créateur
  (postgres) et bypass la RLS sur `value.biens` (qui filtre `user_id = auth.uid()`).
- Le filtre `WHERE status IN ('discret', 'public')` garantit la sécurité.
- L'anonymisation passe par les fonctions ci-dessus, donc impossible à
  contourner côté client.

Tous les champs sensibles passent par les fonctions :
- `address_display` → `anonymize_address` ou `address` brut si public
- `lat_display / lng_display` → `snap_to_iris_centroid_*` ou lat/lng brut si public
- `bien_data` → `anonymize_bien_data` (bucket surface/étage en discret)
- `photos` → `photos_floutees_urls` en discret, `photos_originales_urls` en public
- `prix_affiche` → masqué en discret, exposé en public
- `valorisation_publique` → `format_valorisation_publique`

## 4. RLS — récap

| Table | Authenticated | Anon | Service_role |
|---|---|---|---|
| `value.biens` | CRUD si `user_id = auth.uid()` | — | ALL |
| `value.valos_historique` | SELECT si propriétaire du bien | — | ALL |
| `value.user_provided_comparables` | SELECT si propriétaire | — | ALL |
| `value.favoris` | CRUD ses propres favoris | — | ALL |
| `value.bien_stats` | SELECT si propriétaire | — | ALL |
| `value.consultation_events` | **Aucune policy** = deny all | — | ALL (workers seuls écrivent) |
| `value.contacts` | SELECT+UPDATE si vendeur OU SELECT si acheteur. INSERT autorisé. | — | ALL |
| `value.packs_annonces` | CRUD ses packs | — | ALL |
| `value.biens_publics` (vue) | SELECT | SELECT | SELECT |

⚠️ **Sans `GRANT SELECT/INSERT/...`, même avec RLS active, l'authenticated
reçoit `permission denied for table`**. Migration include donc les grants
explicites pour chaque table accessible côté client.

## 5. Limitations V1 (à finir avant la publication PAP)

1. **`format_iris_label` est un stub** : retourne juste la commune. Pour le
   label "Le Chénay, Gagny (93)" il faudra un lookup table dans
   `immoscan-data.insee_iris` accessible depuis ce schema. Décision PO :
   matérialiser un mini-cache `value.iris_labels` dans `immoscan-app` ?
2. **`snap_to_iris_centroid_*` est un stub** : arrondi mathématique à 0.005°.
   Granularité utile pour V1 mais pas alignée sur le centroid IRIS réel.
   V2 = lookup `insee_iris.geom`.
3. **`bucket_surface` / `bucket_etage`** : seuils définis en dur. Pas de
   config par utilisateur. À discuter si les vendeurs demandent du contrôle.
4. **PostGIS** : `postgis` n'était pas activé sur `immoscan-app` avant cette
   migration. On l'a ajouté en `CREATE EXTENSION IF NOT EXISTS postgis` —
   premier consommateur. Si plus tard ImmoScan a besoin de PostGIS côté
   `immoscan-app` (analyses spatiales), c'est désormais disponible.
5. **`config.toml`** : la section `[api].schemas` a été étendue à
   `["public", "graphql_public", "value"]`. Le projet remote doit avoir
   cette config aussi (à appliquer via Dashboard ou `supabase db push`)
   pour que les clients REST/PostgREST exposent `value.*`.
6. **Types TS** : tant que le générateur `supabase gen types` n'a pas
   `value` dans `exposed_schemas` côté remote, les types sont maintenus à
   la main dans `packages/db/src/value.types.ts`. À chaque migration `value.*`,
   il faut updater ce fichier (ou regen une fois le remote configuré).

## 6. Indexes & PostGIS

- `biens_geom_idx` : GiST sur la colonne `geom` (`geometry(Point, 4326)`,
  générée à partir de `lat`/`lng`). Permet `ST_DWithin` pour recherche par
  proximité côté worker.
- `biens_status_visibles_idx` : index partiel sur `(status, code_iris)`
  filtré sur `status IN ('discret', 'public')`. Vitrine PAP performante.
- `biens_user_idx`, `biens_iris_idx` : index simples pour les requêtes
  propriétaire et les agrégats par IRIS.
- `valos_historique_bien_idx (bien_id, created_at desc)` : pour la timeline
  d'un bien.
- `consultation_events_bien_idx`, `consultation_events_visitor_idx` : stats
  temps-réel et déduplication anti-spam.

## 7. Rollback

```sql
DROP SCHEMA value CASCADE;
-- (l'extension postgis n'est PAS droppée, d'autres tables futures
--  peuvent en dépendre)
```
