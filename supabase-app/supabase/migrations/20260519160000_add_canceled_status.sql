-- Permet à l'utilisateur d'arrêter une analyse en cours. Status distinct
-- de "failed" pour la traçabilité (failed = erreur worker, canceled =
-- choix utilisateur).

ALTER TYPE analysis_status ADD VALUE IF NOT EXISTS 'canceled' AFTER 'failed';

-- rollback impossible sur ADD VALUE (Postgres ne supporte pas REMOVE
-- VALUE sur un enum sans recréer le type complètement).
