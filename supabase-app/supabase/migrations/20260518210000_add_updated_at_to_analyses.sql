-- La table `analyses` a un trigger `analyses_updated_at` qui appelle
-- `set_updated_at()` (= NEW.updated_at := now()), mais la colonne
-- `updated_at` n'avait pas été créée dans la migration init.
-- Conséquence : tous les UPDATE sur `analyses` échouaient avec
-- "record \"new\" has no field \"updated_at\"" — le worker Trigger.dev
-- ne pouvait pas mettre à jour le statut d'une analyse (pending zombi
-- malgré la task qui tourne correctement).
--
-- Toutes les autres tables avec ce trigger (profiles, user_params,
-- subscriptions, watches, pipeline_items) avaient déjà cette colonne.
--
-- IF NOT EXISTS = idempotent (la migration a déjà été appliquée
-- manuellement via MCP en hot-fix, on garde ce fichier pour
-- traçabilité git + dev local).

ALTER TABLE public.analyses
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- rollback:
-- ALTER TABLE public.analyses DROP COLUMN IF EXISTS updated_at;
