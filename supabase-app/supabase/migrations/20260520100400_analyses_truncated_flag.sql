-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-C : flag truncated sur analyses
-- ────────────────────────────────────────────────────────────────────
-- Quand l'actor Apify renvoie exactement `cap + 1` items, ça signifie
-- que la recherche couvrait plus de biens que le cap du plan. On garde
-- l'info pour pouvoir afficher dans l'UI une banner "Ta recherche
-- couvrait plus de N biens, on a analysé les N plus récents".
-- ────────────────────────────────────────────────────────────────────

alter table analyses
  add column if not exists was_truncated boolean not null default false,
  add column if not exists items_cap_applied integer;

comment on column analyses.was_truncated is
  'true si l''actor Apify a renvoyé exactement (cap_palier + 1) items, '
  'indiquant que la recherche dépassait le cap d''items du plan.';
comment on column analyses.items_cap_applied is
  'Cap d''items effectivement appliqué (snapshot du plan au moment du run).';

-- ─── Rollback ───
-- alter table analyses drop column if exists was_truncated;
-- alter table analyses drop column if exists items_cap_applied;
