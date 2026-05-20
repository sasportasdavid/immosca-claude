-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-A.3 : RPCs quotas + helpers entitlements
-- ────────────────────────────────────────────────────────────────────
-- Fonctions SECURITY DEFINER appelables :
--   - depuis le worker (service_role) avant de lancer une analyse/scout
--   - depuis le frontend (authenticated) avant de submit un form
-- Retournent du JSON normalisé { allowed, reason, limit, used, ... }
-- pour permettre l'affichage de modals d'upsell contextuels (cf BM §4.2).
-- ────────────────────────────────────────────────────────────────────

-- ─── Helper : limites par plan ───
-- Renvoie un jsonb avec les caps applicables au plan donné.
-- Source de vérité = grille tarifaire business-model-immoscan.md §2.1.

create or replace function plan_limits(p_plan subscription_plan)
returns jsonb
language sql
immutable
as $$
  select case p_plan
    when 'free' then jsonb_build_object(
      'analyses_per_month', 1,
      'items_max_per_analysis', 50,
      'watches_included', 1,
      'watch_total_cap', 1,
      'items_max_per_watch_run', 50,
      'paste_urls_max', 5,
      'concurrent_analyses_max', 1,
      'top_n', 5,
      'claude_model_top5', 'claude-sonnet-4-6',
      'claude_model_rest', 'claude-sonnet-4-6',
      'export_pdf', false,
      'export_csv', false,
      'seats', 1
    )
    when 'pro' then jsonb_build_object(
      'analyses_per_month', 10,
      'items_max_per_analysis', 300,
      'watches_included', 3,
      'watch_total_cap', 8,
      'items_max_per_watch_run', 100,
      'paste_urls_max', 30,
      'concurrent_analyses_max', 1,
      'top_n', 10,
      'claude_model_top5', 'claude-sonnet-4-6',
      'claude_model_rest', 'claude-sonnet-4-6',
      'export_pdf', true,
      'export_csv', false,
      'seats', 1
    )
    when 'pro_plus' then jsonb_build_object(
      'analyses_per_month', 25,
      'items_max_per_analysis', 500,
      'watches_included', 6,
      'watch_total_cap', 16,
      'items_max_per_watch_run', 200,
      'paste_urls_max', 100,
      'concurrent_analyses_max', 2,
      'top_n', 20,
      'claude_model_top5', 'claude-opus-4-7',
      'claude_model_rest', 'claude-sonnet-4-6',
      'export_pdf', true,
      'export_csv', true,
      'seats', 1
    )
    when 'business' then jsonb_build_object(
      'analyses_per_month', 80,
      'items_max_per_analysis', 1000,
      'watches_included', 15,
      'watch_total_cap', 30,
      'items_max_per_watch_run', 300,
      'paste_urls_max', null, -- illimité
      'concurrent_analyses_max', 3,
      'top_n', 30,
      'claude_model_top5', 'claude-opus-4-7',
      'claude_model_rest', 'claude-opus-4-7',
      'export_pdf', true,
      'export_csv', true,
      'seats', 1 -- V1 hard cap, multi-seats V1.5
    )
    else jsonb_build_object()
  end;
$$;

comment on function plan_limits(subscription_plan) is
  'Caps applicables par palier. Source : business-model-immoscan.md §2.1. '
  'Tout changement de pricing/limit doit être répercuté ici ET dans '
  'packages/shared/src/constants.ts (PLANS).';

-- ─── Helper : période courante ───
-- Retourne (period_start, period_end) basé sur le cycle Stripe du user.
-- Pour les Free et users sans sub active, on prend le mois calendaire
-- en cours (UTC).

create or replace function current_billing_period(p_profile_id uuid)
returns table (period_start timestamptz, period_end timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sub_start timestamptz;
  v_sub_end timestamptz;
begin
  -- Cherche le cycle Stripe actif
  select s.current_period_start, s.current_period_end
    into v_sub_start, v_sub_end
    from subscriptions s
    where s.profile_id = p_profile_id
      and s.status in ('active', 'trialing')
    order by s.current_period_start desc
    limit 1;

  if v_sub_start is not null and v_sub_end is not null then
    period_start := v_sub_start;
    period_end := v_sub_end;
  else
    -- Free : mois calendaire UTC
    period_start := date_trunc('month', now() at time zone 'utc');
    period_end := period_start + interval '1 month';
  end if;
  return next;
end;
$$;

-- ─── Helper : upsert + lock du usage_counters de la période courante ───

create or replace function ensure_usage_counter(p_profile_id uuid)
returns usage_counters
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period record;
  v_counter usage_counters%rowtype;
begin
  select * into v_period from current_billing_period(p_profile_id);

  insert into usage_counters (profile_id, period_start, period_end)
    values (p_profile_id, v_period.period_start, v_period.period_end)
    on conflict (profile_id, period_start) do nothing;

  select * into v_counter from usage_counters
    where profile_id = p_profile_id
      and period_start = v_period.period_start
    for update;

  return v_counter;
end;
$$;

-- ─── RPC : is_quota_exceeded ───
-- Appel : select is_quota_exceeded(auth.uid(), 'analysis');
-- Actions supportées :
--   'analysis'              → quota mensuel analyses
--   'concurrent_analysis'   → analyses simultanées en cours
--   'watch_create'          → cap total veilles (incluses + add-on)
--   'paste_urls'            → max URLs par mode coller (cap journalier)
-- Renvoie { allowed: bool, reason?: text, used?: int, limit?: int, upgrade_to?: text }

create or replace function is_quota_exceeded(
  p_profile_id uuid,
  p_action text,
  p_requested_count int default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plan;
  v_limits jsonb;
  v_counter usage_counters%rowtype;
  v_active_watches int;
  v_ppu_balance int;
  v_addon_watch_slots int;
begin
  -- 1) Charge le plan du user
  select subscription_plan into v_plan from profiles where id = p_profile_id;
  if v_plan is null then
    return jsonb_build_object('allowed', false, 'reason', 'profile_not_found');
  end if;
  v_limits := plan_limits(v_plan);

  -- 2) Charge le counter (avec lock)
  v_counter := ensure_usage_counter(p_profile_id);

  -- ─── Action : analysis ───
  if p_action = 'analysis' then
    -- Free a 1/mois, mais peut acheter PPU pour débloquer
    select count(*) into v_ppu_balance
      from entitlements
      where profile_id = p_profile_id
        and type = 'ppu_analysis'
        and status = 'pending';

    declare
      v_limit int := (v_limits->>'analyses_per_month')::int;
    begin
      if v_counter.analyses_used + p_requested_count <= v_limit then
        return jsonb_build_object('allowed', true, 'source', 'plan');
      end if;
      -- Plan saturé : tente sur PPU
      if v_ppu_balance >= p_requested_count then
        return jsonb_build_object('allowed', true, 'source', 'ppu',
          'ppu_remaining', v_ppu_balance);
      end if;
      return jsonb_build_object(
        'allowed', false,
        'reason', 'analysis_quota_exceeded',
        'used', v_counter.analyses_used,
        'limit', v_limit,
        'ppu_balance', v_ppu_balance,
        'upgrade_to', case v_plan
          when 'free' then 'pro'
          when 'pro' then 'pro_plus'
          when 'pro_plus' then 'business'
          else null
        end
      );
    end;
  end if;

  -- ─── Action : concurrent_analysis ───
  if p_action = 'concurrent_analysis' then
    declare
      v_limit int := (v_limits->>'concurrent_analyses_max')::int;
    begin
      if v_counter.analyses_concurrent + p_requested_count <= v_limit then
        return jsonb_build_object('allowed', true);
      end if;
      return jsonb_build_object(
        'allowed', false,
        'reason', 'concurrent_analyses_exceeded',
        'used', v_counter.analyses_concurrent,
        'limit', v_limit
      );
    end;
  end if;

  -- ─── Action : watch_create ───
  if p_action = 'watch_create' then
    select count(*) into v_active_watches
      from watches
      where profile_id = p_profile_id
        and is_active = true;

    -- Compte les add-on slots actifs (chaque addon_watch_unit = 1 slot,
    -- chaque addon_watch_pack3 = 3 slots, etc.)
    select coalesce(sum(
      case type
        when 'addon_watch_unit' then 1
        when 'addon_watch_daily' then 1
        when 'addon_watch_pack3' then 3
        when 'addon_watch_pack3_daily' then 3
        else 0
      end
    ), 0)::int into v_addon_watch_slots
      from entitlements
      where profile_id = p_profile_id
        and type in ('addon_watch_unit', 'addon_watch_pack3',
                     'addon_watch_daily', 'addon_watch_pack3_daily')
        and status = 'active';

    declare
      v_included int := (v_limits->>'watches_included')::int;
      v_total_cap int := (v_limits->>'watch_total_cap')::int;
      v_effective_limit int := least(v_included + v_addon_watch_slots, v_total_cap);
    begin
      if v_active_watches + p_requested_count <= v_effective_limit then
        return jsonb_build_object('allowed', true,
          'effective_limit', v_effective_limit,
          'included', v_included,
          'addon_slots', v_addon_watch_slots);
      end if;
      return jsonb_build_object(
        'allowed', false,
        'reason', 'watch_quota_exceeded',
        'used', v_active_watches,
        'limit', v_effective_limit,
        'included', v_included,
        'addon_slots', v_addon_watch_slots,
        'total_cap', v_total_cap,
        'can_buy_addon', v_active_watches < v_total_cap
      );
    end;
  end if;

  -- ─── Action : paste_urls ───
  if p_action = 'paste_urls' then
    declare
      v_limit int := nullif(v_limits->>'paste_urls_max', 'null')::int;
    begin
      if v_limit is null then
        -- Business : illimité
        return jsonb_build_object('allowed', true);
      end if;
      if p_requested_count <= v_limit then
        return jsonb_build_object('allowed', true);
      end if;
      return jsonb_build_object(
        'allowed', false,
        'reason', 'paste_urls_exceeded',
        'requested', p_requested_count,
        'limit', v_limit,
        'upgrade_to', case v_plan
          when 'free' then 'ppu'
          when 'pro' then 'pro_plus'
          when 'pro_plus' then 'business'
          else null
        end
      );
    end;
  end if;

  return jsonb_build_object('allowed', false, 'reason', 'unknown_action');
end;
$$;

comment on function is_quota_exceeded(uuid, text, int) is
  'Vérifie si une action est autorisée pour un profile. '
  'Appelé par le worker avant analyze/scout et par le frontend avant submit.';

-- ─── RPC : increment_analysis_counter ───
-- Appelé par le worker au démarrage d'une analyse pour incrémenter le counter
-- et consommer un PPU si plan saturé. Retourne le mode de facturation utilisé.

create or replace function increment_analysis_counter(
  p_profile_id uuid,
  p_analysis_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan subscription_plan;
  v_limits jsonb;
  v_counter usage_counters%rowtype;
  v_limit int;
  v_ppu_id uuid;
begin
  select subscription_plan into v_plan from profiles where id = p_profile_id;
  if v_plan is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;
  v_limits := plan_limits(v_plan);
  v_limit := (v_limits->>'analyses_per_month')::int;

  v_counter := ensure_usage_counter(p_profile_id);

  -- Si dans le quota inclus → incrément simple
  if v_counter.analyses_used + 1 <= v_limit then
    update usage_counters
      set analyses_used = analyses_used + 1,
          analyses_concurrent = analyses_concurrent + 1
      where profile_id = p_profile_id
        and period_start = v_counter.period_start;
    return jsonb_build_object('billed_via', 'plan',
      'analyses_used', v_counter.analyses_used + 1,
      'analyses_limit', v_limit);
  end if;

  -- Sinon consomme un PPU
  select id into v_ppu_id
    from entitlements
    where profile_id = p_profile_id
      and type = 'ppu_analysis'
      and status = 'pending'
    order by granted_at asc
    limit 1
    for update skip locked;

  if v_ppu_id is null then
    raise exception 'quota_exceeded_no_ppu' using errcode = 'P0001';
  end if;

  update entitlements
    set status = 'consumed',
        consumed_at = now(),
        consumed_resource_id = p_analysis_id
    where id = v_ppu_id;

  update usage_counters
    set analyses_concurrent = analyses_concurrent + 1
    where profile_id = p_profile_id
      and period_start = v_counter.period_start;

  return jsonb_build_object('billed_via', 'ppu',
    'entitlement_id', v_ppu_id);
end;
$$;

-- ─── RPC : decrement_concurrent_analysis ───
-- Appelé en fin de run (done OU failed) pour libérer le slot concurrent.

create or replace function decrement_concurrent_analysis(p_profile_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update usage_counters
    set analyses_concurrent = greatest(0, analyses_concurrent - 1)
    where profile_id = p_profile_id
      and period_start <= now()
      and period_end > now();
$$;

-- ─── Grants ───
-- Les RPCs sont SECURITY DEFINER, callables par authenticated (frontend)
-- ou service_role (worker). On grant EXECUTE explicitement.

grant execute on function plan_limits(subscription_plan) to authenticated, service_role;
grant execute on function current_billing_period(uuid) to authenticated, service_role;
grant execute on function ensure_usage_counter(uuid) to service_role;
grant execute on function is_quota_exceeded(uuid, text, int) to authenticated, service_role;
grant execute on function increment_analysis_counter(uuid, uuid) to service_role;
grant execute on function decrement_concurrent_analysis(uuid) to service_role;

-- ─── Rollback ───
-- drop function if exists decrement_concurrent_analysis(uuid);
-- drop function if exists increment_analysis_counter(uuid, uuid);
-- drop function if exists is_quota_exceeded(uuid, text, int);
-- drop function if exists ensure_usage_counter(uuid);
-- drop function if exists current_billing_period(uuid);
-- drop function if exists plan_limits(subscription_plan);
