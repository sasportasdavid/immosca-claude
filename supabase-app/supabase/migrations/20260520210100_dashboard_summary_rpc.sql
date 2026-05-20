-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-K : RPC dashboard_summary
-- ────────────────────────────────────────────────────────────────────
-- Une seule requête côté frontend pour alimenter tout le dashboard.
-- Évite N×roundtrips pour 6 widgets indépendants.
--
-- Retourne un JSONB avec :
--   - top_opportunities : Top 5 biens score ≥75 (toutes veilles + analyses)
--   - watch_activity_7d : compteurs events sur les 7 derniers jours
--   - stats : analyses_used/limit + watches_active/effective_limit + ppu_balance
--   - pipeline_counts : compteurs par stage Kanban
--   - alerts : liste de signaux actionnables (veille proche expiration,
--              truncate chronique, quota proche, trial Pro fin de période)
--   - market_stats : médianes €/m² des 5 communes les plus surveillées
--   - empty_state_hint : "first_analysis" | "first_watch" | "first_pipeline" | null
-- ────────────────────────────────────────────────────────────────────

create or replace function dashboard_summary(p_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plan;
  v_limits jsonb;
  v_counter usage_counters%rowtype;
  v_ppu_balance int;
  v_addon_slots int;
  v_active_watches int;
  v_effective_watch_limit int;
  v_top_opportunities jsonb;
  v_watch_activity jsonb;
  v_pipeline_counts jsonb;
  v_alerts jsonb;
  v_market_stats jsonb;
  v_first_analysis_done boolean;
  v_first_watch_created boolean;
  v_first_pipeline_added boolean;
  v_empty_hint text;
begin
  -- 0) Plan + limits + counter (déjà filtré dans plan_limits)
  select subscription_plan into v_plan from profiles where id = p_profile_id;
  if v_plan is null then
    return jsonb_build_object('error', 'profile_not_found');
  end if;
  v_limits := plan_limits(v_plan);

  -- Counter du cycle courant (read-only ; pas d'upsert ici, on lit ce qui
  -- existe sans verrou). Reste null si pas encore d'usage ce cycle.
  select * into v_counter from usage_counters
    where profile_id = p_profile_id
    order by period_start desc
    limit 1;

  -- Solde PPU pending
  select coalesce(count(*), 0)::int into v_ppu_balance
    from entitlements
    where profile_id = p_profile_id
      and type = 'ppu_analysis'
      and status = 'pending';

  -- Add-on slots actifs (1 par addon_unit, 3 par pack3)
  select coalesce(sum(
    case type
      when 'addon_watch_unit' then 1
      when 'addon_watch_daily' then 1
      when 'addon_watch_pack3' then 3
      when 'addon_watch_pack3_daily' then 3
      else 0
    end
  ), 0)::int into v_addon_slots
    from entitlements
    where profile_id = p_profile_id
      and type in ('addon_watch_unit', 'addon_watch_pack3',
                   'addon_watch_daily', 'addon_watch_pack3_daily')
      and status = 'active';

  -- Veilles actives + cap effectif
  select count(*) into v_active_watches
    from watches
    where profile_id = p_profile_id
      and is_active = true
      and suspended_at is null;
  v_effective_watch_limit := least(
    (v_limits->>'watches_included')::int + v_addon_slots,
    (v_limits->>'watch_total_cap')::int
  );

  -- ─── 1) Top 5 opportunités : croise watch_listings + listing_scores ───
  -- Source unique : watch_listings (déjà scoré inline via scoring-batch).
  -- On peut aussi élargir aux listings_scores des analyses, mais ça
  -- complique la dédup. V1 : watch_listings uniquement (mieux ciblé).
  select coalesce(jsonb_agg(opp), '[]'::jsonb) into v_top_opportunities from (
    select jsonb_build_object(
      'watch_listing_id', wl.id,
      'watch_id', wl.watch_id,
      'watch_name', w.name,
      'title', wl.title,
      'source_site', wl.source_site,
      'source_url', wl.source_url,
      'current_price', wl.current_price,
      'current_surface', wl.current_surface,
      'current_dpe', wl.current_dpe,
      'current_score', wl.current_score,
      'first_seen_at', wl.first_seen_at,
      'last_seen_at', wl.last_seen_at,
      'is_in_pipeline', wl.is_in_pipeline
    ) as opp
    from watch_listings wl
    join watches w on w.id = wl.watch_id
    where w.profile_id = p_profile_id
      and wl.current_score >= 75
      and wl.current_status in ('new', 'tracked')
      and wl.is_in_pipeline = false
    order by wl.current_score desc nulls last, wl.last_seen_at desc
    limit 5
  ) t;

  -- ─── 2) Activité veilles 7 derniers jours ───
  select coalesce(jsonb_object_agg(event_type, n), '{}'::jsonb)
    into v_watch_activity
    from (
      select we.event_type::text, count(*) as n
      from watch_events we
      join watches w on w.id = we.watch_id
      where w.profile_id = p_profile_id
        and we.created_at >= now() - interval '7 days'
        and we.event_type in ('new_match', 'price_drop', 'signal_to_verify', 'relisted', 'removed')
      group by we.event_type
    ) t;

  -- ─── 3) Pipeline counts ───
  select coalesce(jsonb_object_agg(stage, n), '{}'::jsonb)
    into v_pipeline_counts
    from (
      select stage::text, count(*) as n
      from pipeline_items
      where profile_id = p_profile_id
      group by stage
    ) t;

  -- ─── 4) Alertes ───
  with all_alerts as (
    -- Veille expire bientôt (Free / PPU, J≤10)
    select 'watch_expiring' as kind,
      'Ta veille "' || w.name || '" expire dans ' ||
        greatest(0, ceil(extract(epoch from (w.expires_at - now())) / 86400))::int || ' jour(s)' as label,
      '/app/billing' as cta_link,
      ceil(extract(epoch from (w.expires_at - now())) / 86400)::int as priority_score
    from watches w
    where w.profile_id = p_profile_id
      and w.is_active = true
      and w.suspended_at is null
      and w.expires_at is not null
      and w.expires_at < now() + interval '10 days'
      and w.expires_at > now()

    union all
    -- Veille avec truncate chronique
    select 'watch_truncated' as kind,
      '3 runs truncate consécutifs sur "' || w.name || '"' as label,
      '/app/veilles/' || w.id::text as cta_link,
      0 as priority_score
    from watches w
    where w.profile_id = p_profile_id
      and w.is_active = true
      and w.consecutive_truncated_runs >= 3

    union all
    -- Quota analyses proche atteint (≥ 80%)
    select 'quota_analyses' as kind,
      'Quota analyses à ' ||
        round(coalesce(v_counter.analyses_used, 0) * 100.0 /
              nullif((v_limits->>'analyses_per_month')::int, 0))::int || '%' as label,
      '/app/billing' as cta_link,
      100 - round(coalesce(v_counter.analyses_used, 0) * 100.0 /
                  nullif((v_limits->>'analyses_per_month')::int, 0))::int as priority_score
    where coalesce(v_counter.analyses_used, 0) >= 0.8 * (v_limits->>'analyses_per_month')::int
      and (v_limits->>'analyses_per_month')::int > 0

    union all
    -- Trial Pro qui se termine dans <3j
    select 'trial_ending' as kind,
      'Ton essai gratuit se termine dans ' ||
        greatest(0, ceil(extract(epoch from (p.trial_ends_at - now())) / 86400))::int || ' jour(s)' as label,
      '/app/billing' as cta_link,
      ceil(extract(epoch from (p.trial_ends_at - now())) / 86400)::int as priority_score
    from profiles p
    where p.id = p_profile_id
      and p.subscription_status = 'trialing'
      and p.trial_ends_at is not null
      and p.trial_ends_at > now()
      and p.trial_ends_at < now() + interval '3 days'
  )
  select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'label', label, 'cta_link', cta_link)
                  order by priority_score asc), '[]'::jsonb)
    into v_alerts
    from all_alerts;

  -- ─── 5) Stats marché des communes surveillées ───
  -- Top 5 communes par fréquence d'apparition dans les watch_listings du user
  with user_communes as (
    select l.code_insee, l.ville, count(*) as n
    from watch_listings wl
    join watches w on w.id = wl.watch_id
    join listings l on l.id = wl.listing_id
    where w.profile_id = p_profile_id
      and l.code_insee is not null
      and l.ville is not null
    group by l.code_insee, l.ville
    order by n desc
    limit 5
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'city', uc.ville,
      'median_eur_m2', msc.median_eur_m2,
      'delta_pct', null
    )), '[]'::jsonb) into v_market_stats
    from user_communes uc
    join market_stats_cache msc
      on msc.commune_insee = uc.code_insee
      and msc.bien_type = 'appartement'
      and msc.dpe_bin = 'unknown';

  -- ─── 6) Empty state hint ───
  select exists (select 1 from analyses where profile_id = p_profile_id and status = 'done')
    into v_first_analysis_done;
  select exists (select 1 from watches where profile_id = p_profile_id)
    into v_first_watch_created;
  select exists (select 1 from pipeline_items where profile_id = p_profile_id)
    into v_first_pipeline_added;

  v_empty_hint := case
    when not v_first_analysis_done then 'first_analysis'
    when not v_first_watch_created then 'first_watch'
    when not v_first_pipeline_added then 'first_pipeline'
    else null
  end;

  -- ─── Assemble la réponse ───
  return jsonb_build_object(
    'plan', v_plan,
    'top_opportunities', v_top_opportunities,
    'watch_activity_7d', v_watch_activity,
    'stats', jsonb_build_object(
      'analyses_used', coalesce(v_counter.analyses_used, 0),
      'analyses_limit', (v_limits->>'analyses_per_month')::int,
      'watches_active', v_active_watches,
      'watches_effective_limit', v_effective_watch_limit,
      'ppu_balance', v_ppu_balance,
      'period_end', v_counter.period_end
    ),
    'pipeline_counts', v_pipeline_counts,
    'alerts', v_alerts,
    'market_stats', v_market_stats,
    'empty_state_hint', v_empty_hint
  );
end;
$$;

grant execute on function dashboard_summary(uuid) to authenticated, service_role;

comment on function dashboard_summary(uuid) is
  'Agrège en une seule query toutes les données du dashboard /dashboard. '
  'Source : PR-K dashboard riche.';

-- ─── Rollback ───
-- drop function if exists dashboard_summary(uuid);
