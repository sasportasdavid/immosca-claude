-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-G : suivi des emails d'expiration veille
-- ────────────────────────────────────────────────────────────────────
-- Idempotence du cron `watch-expiration-mailer` : on stocke la liste
-- des milestones d'expiration déjà notifiés pour cette watch, pour
-- éviter de re-envoyer le même email à chaque tick du cron.
--
-- Format : `{"free_warn_J10", "free_warn_J3", "free_suspended_J0"}`
-- ou `{"ppu_warn_J7", "ppu_warn_J2", "ppu_suspended_J0"}`
-- ────────────────────────────────────────────────────────────────────

alter table watches
  add column if not exists expiration_emails_sent text[] not null default array[]::text[];

comment on column watches.expiration_emails_sent is
  'Liste des milestones d''expiration déjà notifiées par email. '
  'Format : free_warn_J10 / free_warn_J3 / free_suspended_J0 / '
  'ppu_warn_J7 / ppu_warn_J2 / ppu_suspended_J0';

-- ─── Rollback ───
-- alter table watches drop column if exists expiration_emails_sent;
