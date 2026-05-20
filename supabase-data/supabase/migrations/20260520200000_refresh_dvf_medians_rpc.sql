-- ────────────────────────────────────────────────────────────────────
-- ImmoScan-data — PR-E : RPC refresh_dvf_medians
-- ────────────────────────────────────────────────────────────────────
-- Refresh des vues matérialisées DVF après chaque import.
-- Appelée par worker task `imports.dvf` en fin de run.
--
-- CONCURRENTLY pour ne pas bloquer les SELECTs en cours sur la vue
-- (nécessite l'index UNIQUE déjà créé dans init_data.sql).
-- ────────────────────────────────────────────────────────────────────

create or replace function refresh_dvf_medians()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently dvf_medians_commune;
  refresh materialized view concurrently dvf_medians_iris;
end;
$$;

grant execute on function refresh_dvf_medians() to service_role;

comment on function refresh_dvf_medians() is
  'Refresh CONCURRENTLY les vues matérialisées DVF (commune + iris). '
  'Appelée par worker `imports.dvf` après chaque bulk insert.';

-- ─── Rollback ───
-- drop function if exists refresh_dvf_medians();
