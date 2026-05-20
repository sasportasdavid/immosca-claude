-- Fix : la vue `listings_freemium_view` était créée avec
-- `security_invoker=true` (default Supabase) → elle tournait avec les
-- droits de `authenticated`, bloqué par la policy `listings_no_direct_read`
-- (USING false) → 0 rows visibles côté frontend.
--
-- Solution : passer en `security_invoker=off` (mode DEFINER). La vue
-- exécute alors les SELECT underlying avec les droits du créateur
-- (postgres), qui bypass RLS sur listings/listing_scores.
--
-- Sécurité préservée :
--   1) La vue contient déjà son propre filter ownership :
--      WHERE EXISTS (SELECT 1 FROM analyses a
--                    WHERE a.id = l.analysis_id AND a.profile_id = auth.uid())
--      → un user ne voit QUE les listings de SES analyses.
--   2) Le masquage colonnes free/payant (CASE WHEN is_user_paid()...)
--      reste appliqué dans la vue.
--   3) La policy `listings_no_direct_read` reste en place → empêche
--      le SELECT direct sur listings (sécurité défense en profondeur).
--
-- Pattern Supabase officiel pour les vues qui ont besoin de bypass RLS
-- tout en gardant le filter `auth.uid()` côté vue :
-- https://supabase.com/docs/guides/database/postgres/row-level-security

ALTER VIEW public.listings_freemium_view SET (security_invoker = off);

-- rollback:
-- ALTER VIEW public.listings_freemium_view SET (security_invoker = on);
