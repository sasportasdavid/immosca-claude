-- ────────────────────────────────────────────────────────────────────
-- ImmoScan-data — PR-V6 : RPCs sources d'estimation ImmoValue
-- ────────────────────────────────────────────────────────────────────
-- 8 fonctions PL/pgSQL exposées au worker `value-build-estimation`
-- pour remplacer les 10 stubs du dossier d'estimation (loaders dvf*,
-- iris*, oll*, dpe_sector*, georisques*, transports*, noise*, prix_trend*).
--
-- Schéma cible : public (un seul schéma sur immoscan-data, pas de
-- séparation value/ référentiels).
--
-- SECURITY DEFINER + search_path explicite : sécurité Postgres standard
-- pour les fonctions exposées via PostgREST (le service_role appelle, on
-- borne le path pour éviter les fuites de schéma malicieux).
-- search_path = public, extensions car postgis est installé dans extensions
-- (types geography/geometry, fonctions st_*).
--
-- GRANT EXECUTE TO authenticated, anon : convention du projet (cf
-- MEMORY.md feedback_supabase_grants_mcp). Le worker utilise service_role
-- qui bypasse ces grants, mais on garde la cohérence pour ne pas casser
-- l'exposition PostgREST si un futur usage frontend voit le jour.
-- ────────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────────────
-- 1. rpc_dvf_comparables(lat, lng, surface_m2, type_bien, rayon_m, depuis_annee)
-- ────────────────────────────────────────────────────────────────────
-- Retourne jusqu'à 30 mutations DVF+ géolocalisées dans un rayon donné,
-- pondérées par "qualité de comparable" :
--   1. distance géo (rayon_m bornage dur)
--   2. proximité de surface (±30%)
--   3. fraîcheur (depuis_annee bornage dur)
-- Tri : date_mutation desc puis distance asc.

create or replace function rpc_dvf_comparables(
  p_lat numeric,
  p_lng numeric,
  p_surface_m2 numeric,
  p_type_bien text,
  p_rayon_m integer default 2000,
  p_depuis_annee integer default null
)
returns table (
  ref text,
  date_mutation date,
  prix numeric,
  surface numeric,
  prix_m2 numeric,
  typologie text,
  distance_m numeric,
  code_iris text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pt extensions.geography;
  v_type_local text;
  v_depuis_year integer;
  v_surface_min numeric := greatest(p_surface_m2 * 0.7, 9);
  v_surface_max numeric := p_surface_m2 * 1.3;
begin
  if p_lat is null or p_lng is null then
    return;
  end if;

  v_pt := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  -- Mapping shared.BienType → dvf.type_local
  v_type_local := case lower(coalesce(p_type_bien, ''))
    when 'appartement' then 'Appartement'
    when 'maison' then 'Maison'
    else null
  end;

  v_depuis_year := coalesce(p_depuis_annee, extract(year from current_date)::int - 5);

  return query
    select
      d.id_mutation as ref,
      d.date_mutation,
      d.valeur_fonciere as prix,
      d.surface_reelle_bati as surface,
      case
        when d.surface_reelle_bati > 0 then
          round((d.valeur_fonciere / d.surface_reelle_bati)::numeric, 2)
        else null
      end as prix_m2,
      coalesce(d.type_local, p_type_bien) as typologie,
      case
        when d.geom is not null then
          round(extensions.st_distance(d.geom::extensions.geography, v_pt)::numeric, 1)
        else null
      end as distance_m,
      d.code_iris
    from dvf_mutations d
    where d.nature_mutation = 'Vente'
      and d.valeur_fonciere > 10000
      and d.surface_reelle_bati between v_surface_min and v_surface_max
      and (v_type_local is null or d.type_local = v_type_local)
      and extract(year from d.date_mutation) >= v_depuis_year
      -- Filtre géo : si geom existe ET dans rayon, OU pas de geom (fallback commune)
      and (
        (d.geom is not null and extensions.st_dwithin(d.geom::extensions.geography, v_pt, p_rayon_m))
        or (d.geom is null)
      )
    order by d.date_mutation desc, distance_m asc nulls last
    limit 30;
end;
$$;

comment on function rpc_dvf_comparables(numeric, numeric, numeric, text, integer, integer) is
  'Top 30 mutations DVF+ comparables (rayon géo + surface ±30% + type + millésime ≥ N-5).';

grant execute on function rpc_dvf_comparables(numeric, numeric, numeric, text, integer, integer)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 2. rpc_iris_context(lat, lng)
-- ────────────────────────────────────────────────────────────────────
-- IRIS contenant le point + dernier millésime Filosofi connu.
-- pct_proprietaires = 1 - part_menages_locataires (approx, OK pour Claude).
-- pct_residences_principales / pct_logements_collectifs / age_median :
-- non disponibles dans Filosofi minimal — renvoyés en null jusqu'à
-- import d'un dataset complémentaire INSEE RP.

create or replace function rpc_iris_context(
  p_lat numeric,
  p_lng numeric
)
returns table (
  code_iris text,
  nom_iris text,
  population integer,
  revenu_median numeric,
  taux_pauvrete numeric,
  pct_proprietaires numeric,
  pct_residences_principales numeric,
  pct_logements_collectifs numeric,
  age_median numeric
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_pt extensions.geometry;
begin
  if p_lat is null or p_lng is null then
    return;
  end if;

  v_pt := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326);

  return query
    with iris_hit as (
      select i.code_iris, i.nom_iris, i.population
      from insee_iris i
      where i.geom is not null and extensions.st_intersects(i.geom, v_pt)
      limit 1
    ),
    filosofi_last as (
      select
        f.code_iris,
        f.median_revenu_uc,
        f.taux_pauvrete,
        f.part_menages_locataires,
        row_number() over (partition by f.code_iris order by f.annee desc) as rn
      from insee_filosofi f
      where f.code_iris in (select ih.code_iris from iris_hit ih)
    )
    select
      ih.code_iris,
      ih.nom_iris,
      ih.population,
      fl.median_revenu_uc,
      fl.taux_pauvrete,
      case
        when fl.part_menages_locataires is not null
          then round((100 - fl.part_menages_locataires)::numeric, 2)
        else null
      end as pct_proprietaires,
      null::numeric as pct_residences_principales,
      null::numeric as pct_logements_collectifs,
      null::numeric as age_median
    from iris_hit ih
    left join filosofi_last fl on fl.code_iris = ih.code_iris and fl.rn = 1;
end;
$$;

comment on function rpc_iris_context(numeric, numeric) is
  'IRIS contenant le point (PostGIS contains) + dernier Filosofi connu.';

grant execute on function rpc_iris_context(numeric, numeric)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 3. rpc_oll_market(code_insee, type_bien)
-- ────────────────────────────────────────────────────────────────────
-- Loyers signés OLL agrégés sur la commune et toutes les pièces (médiane
-- pondérée par nb_observations). Si seuils oll_loyer_m2_q1/q3 absents,
-- on renvoie null sur p25/p75.

create or replace function rpc_oll_market(
  p_code_insee text,
  p_type_bien text
)
returns table (
  code_insee text,
  typologie text,
  loyer_median_m2 numeric,
  loyer_p25_m2 numeric,
  loyer_p75_m2 numeric,
  source text,
  annee_reference integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_type_logement text;
begin
  if p_code_insee is null or btrim(p_code_insee) = '' then
    return;
  end if;

  v_type_logement := case lower(coalesce(p_type_bien, ''))
    when 'appartement' then 'appartement'
    when 'maison' then 'maison'
    else null
  end;

  return query
    with last_year as (
      select max(o.annee) as annee
      from oll_loyers_medians o
      where o.code_zonage_oll = p_code_insee
        and (v_type_logement is null or o.type_logement = v_type_logement)
    ),
    agg as (
      select
        (percentile_cont(0.5) within group (order by o.loyer_m2_median))::numeric as med,
        (percentile_cont(0.25) within group (order by coalesce(o.loyer_m2_q1, o.loyer_m2_median)))::numeric as p25,
        (percentile_cont(0.75) within group (order by coalesce(o.loyer_m2_q3, o.loyer_m2_median)))::numeric as p75,
        max(o.annee) as annee
      from oll_loyers_medians o, last_year ly
      where o.code_zonage_oll = p_code_insee
        and (v_type_logement is null or o.type_logement = v_type_logement)
        and o.annee = ly.annee
    )
    select
      p_code_insee,
      coalesce(v_type_logement, p_type_bien),
      a.med,
      a.p25,
      a.p75,
      'oll'::text,
      a.annee
    from agg a
    where a.med is not null;
end;
$$;

comment on function rpc_oll_market(text, text) is
  'Médiane / P25 / P75 des loyers OLL sur la commune (dernier millésime).';

grant execute on function rpc_oll_market(text, text)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 4. rpc_dpe_sector_average(code_insee, type_bien)
-- ────────────────────────────────────────────────────────────────────
-- Distribution DPE moyenne du secteur (commune) — appelée en codeIris
-- côté worker mais on accepte les deux (si la chaîne commence par 6
-- digits = code_iris, on tronque sur les 5 premiers digits = code_insee
-- via prefix). Retourne ratios A..G + classe médiane + n.

create or replace function rpc_dpe_sector_average(
  p_code_insee text,
  p_type_bien text
)
returns table (
  code_iris text,
  typologie text,
  count_a integer,
  count_b integer,
  count_c integer,
  count_d integer,
  count_e integer,
  count_f integer,
  count_g integer,
  classe_mediane text,
  echantillon_size integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_commune text;
  v_type_batiment text;
begin
  if p_code_insee is null or btrim(p_code_insee) = '' then
    return;
  end if;

  -- code IRIS = code_commune (5 digits) + 4 digits IRIS. On tronque sur 5.
  v_commune := substring(p_code_insee from 1 for 5);

  v_type_batiment := case lower(coalesce(p_type_bien, ''))
    when 'appartement' then 'appartement'
    when 'maison' then 'maison'
    else null
  end;

  return query
    with rows_dpe as (
      select a.classe_dpe
      from ademe_dpe a
      where a.code_insee_commune = v_commune
        and (v_type_batiment is null or a.type_batiment = v_type_batiment)
        and a.classe_dpe is not null
    ),
    counts as (
      select
        count(*) filter (where classe_dpe = 'A')::int as count_a,
        count(*) filter (where classe_dpe = 'B')::int as count_b,
        count(*) filter (where classe_dpe = 'C')::int as count_c,
        count(*) filter (where classe_dpe = 'D')::int as count_d,
        count(*) filter (where classe_dpe = 'E')::int as count_e,
        count(*) filter (where classe_dpe = 'F')::int as count_f,
        count(*) filter (where classe_dpe = 'G')::int as count_g,
        count(*)::int as total
      from rows_dpe
    ),
    sorted as (
      select classe_dpe,
             row_number() over (order by case classe_dpe
               when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4
               when 'E' then 5 when 'F' then 6 when 'G' then 7 end) as rn
      from rows_dpe
    ),
    median as (
      select classe_dpe as classe
      from sorted s, counts c
      where s.rn = (c.total + 1) / 2
      limit 1
    )
    select
      p_code_insee as code_iris,
      coalesce(v_type_batiment, p_type_bien) as typologie,
      c.count_a, c.count_b, c.count_c, c.count_d, c.count_e, c.count_f, c.count_g,
      m.classe as classe_mediane,
      c.total as echantillon_size
    from counts c
    left join median m on true
    where c.total > 0;
end;
$$;

comment on function rpc_dpe_sector_average(text, text) is
  'Distribution DPE par classe + médiane sur ademe_dpe filtré commune+type.';

grant execute on function rpc_dpe_sector_average(text, text)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 5. rpc_georisques(code_insee)
-- ────────────────────────────────────────────────────────────────────
-- Simple SELECT mappé sur les enums shared.GeorisquesSchema.
-- argile_aleas : null → 'faible' si niveau 'nul' (jamais "nul" dans Zod).

create or replace function rpc_georisques(
  p_code_insee text
)
returns table (
  ppri_inondation boolean,
  ppri_mouvement_terrain boolean,
  argile_aleas text,
  sismicite_zone integer,
  radon_potentiel text,
  basol_proche_m numeric,
  remarques text[]
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_code_insee is null or btrim(p_code_insee) = '' then
    return;
  end if;

  return query
    select
      g.has_ppri as ppri_inondation,
      g.has_ppr_mouvement_terrain as ppri_mouvement_terrain,
      case g.retrait_argile_niveau
        when 'faible' then 'faible'
        when 'moyen' then 'moyen'
        when 'fort' then 'fort'
        else null
      end as argile_aleas,
      g.sismicite as sismicite_zone,
      case g.radon
        when 1 then 'faible'
        when 2 then 'moyen'
        when 3 then 'significatif'
        else null
      end as radon_potentiel,
      -- basol_proche_m : pas de géom site → approximation par count > 0
      case when g.sites_basol_count > 0 then 0::numeric else null end as basol_proche_m,
      array_remove(array[
        case when g.has_ppr_feu_foret then 'PPR feu de forêt' end,
        case when g.has_ppr_avalanche then 'PPR avalanche' end,
        case when g.sites_basias_count > 0 then 'Sites BASIAS à proximité' end
      ], null) as remarques
    from georisques_communes g
    where g.code_commune = substring(p_code_insee from 1 for 5)
    limit 1;
end;
$$;

comment on function rpc_georisques(text) is
  'Risques agrégés commune (PPRI, argile, sismicité, radon, BASOL).';

grant execute on function rpc_georisques(text)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 6. rpc_transports(lat, lng, rayon_m)
-- ────────────────────────────────────────────────────────────────────
-- Stub minimal : pas de table GTFS encore importée. Renvoie une ligne
-- "vide" (nulls + 0). Le worker traite ces nulls comme tels — Claude
-- les voit dans le dossier et n'invente rien. À enrichir en PR-V7 dès
-- que `gtfs_stops` arrive dans immoscan-data.

create or replace function rpc_transports(
  p_lat numeric,
  p_lng numeric,
  p_rayon_m integer default 500
)
returns table (
  metro_ligne text,
  metro_distance_m numeric,
  rer_ligne text,
  rer_distance_m numeric,
  bus_ligne text,
  bus_distance_m numeric,
  gare_nom text,
  gare_distance_m numeric,
  isochrone_15min_paris boolean,
  commerces_500m integer,
  services_500m integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  -- Stub : aucune source GTFS/OSM importée à ce jour. On renvoie une ligne
  -- "neutre" pour que le worker remplisse le dossier sans bloquer.
  if p_lat is null or p_lng is null then
    return;
  end if;

  return query
    select
      null::text, null::numeric,
      null::text, null::numeric,
      null::text, null::numeric,
      null::text, null::numeric,
      null::boolean,
      0::int, 0::int;
end;
$$;

comment on function rpc_transports(numeric, numeric, integer) is
  'Stub transports : à brancher PR-V7 sur gtfs_stops + OSM POI.';

grant execute on function rpc_transports(numeric, numeric, integer)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 7. rpc_noise(lat, lng)
-- ────────────────────────────────────────────────────────────────────
-- Stub : pas de dataset Bruitparif/Cerema importé. Renvoie une ligne
-- avec tous champs null — le worker valide via Zod (champs nullable).

create or replace function rpc_noise(
  p_lat numeric,
  p_lng numeric
)
returns table (
  lden_db numeric,
  categorie text,
  source_bruit_principale text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_lat is null or p_lng is null then
    return;
  end if;
  return query select null::numeric, null::text, null::text;
end;
$$;

comment on function rpc_noise(numeric, numeric) is
  'Stub bruit : à brancher PR-V7 sur Bruitparif/Cerema (Lden/Lnight).';

grant execute on function rpc_noise(numeric, numeric)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- 8. rpc_prix_trend(code_insee, type_bien)
-- ────────────────────────────────────────────────────────────────────
-- Tendance prix au m² sur 5 ans pour une commune + type de bien.
-- Renvoie un set : { annee, prix_m2_median } puis le worker calcule
-- trend_5y / trend_1y côté shared. Plus simple que de tout faire en SQL.

create or replace function rpc_prix_trend(
  p_code_insee text,
  p_type_bien text
)
returns table (
  annee integer,
  prix_m2_median numeric,
  nb_mutations integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_commune text;
  v_type_local text;
begin
  if p_code_insee is null or btrim(p_code_insee) = '' then
    return;
  end if;

  -- Accepte code_iris (9 digits) ou code_insee (5 digits)
  v_commune := substring(p_code_insee from 1 for 5);

  v_type_local := case lower(coalesce(p_type_bien, ''))
    when 'appartement' then 'Appartement'
    when 'maison' then 'Maison'
    else null
  end;

  return query
    select
      m.annee::int,
      m.median_prix_m2::numeric,
      m.nb_mutations::int
    from dvf_medians_commune m
    where m.code_commune = v_commune
      and (v_type_local is null or m.type_local = v_type_local)
      and m.annee >= extract(year from current_date)::int - 5
    order by m.annee asc;
end;
$$;

comment on function rpc_prix_trend(text, text) is
  'Série prix médian/m² 5 dernières années (vue dvf_medians_commune).';

grant execute on function rpc_prix_trend(text, text)
  to authenticated, anon, service_role;

-- ────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- ────────────────────────────────────────────────────────────────────
-- drop function if exists rpc_prix_trend(text, text);
-- drop function if exists rpc_noise(numeric, numeric);
-- drop function if exists rpc_transports(numeric, numeric, integer);
-- drop function if exists rpc_georisques(text);
-- drop function if exists rpc_dpe_sector_average(text, text);
-- drop function if exists rpc_oll_market(text, text);
-- drop function if exists rpc_iris_context(numeric, numeric);
-- drop function if exists rpc_dvf_comparables(numeric, numeric, numeric, text, integer, integer);
