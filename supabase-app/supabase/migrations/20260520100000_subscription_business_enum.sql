-- ────────────────────────────────────────────────────────────────────
-- ImmoScan — PR-A.1 : extend subscription_plan enum with 'business'
-- ────────────────────────────────────────────────────────────────────
-- Le nouveau BM 2026 introduit le palier Business (449€/mois).
-- L'enum SQL doit être étendu avant de pouvoir le référencer dans les
-- RPCs et les profiles. PG17 autorise ADD VALUE dans une transaction
-- mais la nouvelle valeur n'est utilisable qu'après commit — d'où le
-- découpage en migrations séparées.
-- ────────────────────────────────────────────────────────────────────

alter type subscription_plan add value if not exists 'business';

-- ─── Rollback (manuel, non automatique) ───
-- Postgres ne supporte pas DROP VALUE sur un enum. Pour rollback :
-- 1) UPDATE profiles SET subscription_plan = 'pro_plus' WHERE subscription_plan = 'business';
-- 2) CREATE TYPE subscription_plan_new AS ENUM ('free', 'pro', 'pro_plus');
-- 3) ALTER TABLE profiles ALTER COLUMN subscription_plan TYPE subscription_plan_new
--      USING subscription_plan::text::subscription_plan_new;
-- 4) DROP TYPE subscription_plan; ALTER TYPE subscription_plan_new RENAME TO subscription_plan;
