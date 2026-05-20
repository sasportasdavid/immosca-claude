-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-B : table d'idempotence Stripe webhook
-- ────────────────────────────────────────────────────────────────────
-- Stripe peut renvoyer plusieurs fois le même event (rare mais arrive
-- en cas de timeout 5s). Cette table garde une trace des event.id déjà
-- traités pour éviter les doubles traitements (double création
-- d'entitlements PPU notamment).
-- ────────────────────────────────────────────────────────────────────

create table stripe_webhook_events (
  id text primary key,            -- evt_xxxxx (Stripe event.id)
  type text not null,             -- 'checkout.session.completed', ...
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index stripe_webhook_events_type_processed_idx
  on stripe_webhook_events(type, processed_at desc);

-- Pas de RLS : table interne service_role only. Pas de grant authenticated.
alter table stripe_webhook_events enable row level security;
-- Aucune policy → authenticated ne peut rien lire (RLS deny by default).

grant all on stripe_webhook_events to service_role;

comment on table stripe_webhook_events is
  'Log d''idempotence des events Stripe traités par l''Edge Function stripe-webhook. '
  'Tronquable après 90 jours (purge cron).';

-- ─── Rollback ───
-- drop table if exists stripe_webhook_events;
