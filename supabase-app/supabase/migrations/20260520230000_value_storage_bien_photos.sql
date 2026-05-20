-- ════════════════════════════════════════════════════════════════════
-- Bucket Storage : bien-photos
-- ────────────────────────────────────────────────────────────────────
-- Stocke les photos uploadées par les vendeurs dans le tunnel ImmoValue.
-- Path convention : `{user_id_ou_draft}/{timestamp}-{n}.{ext}`
--   - user authentifié : `{auth.uid()}/...`
--   - user anonyme (tunnel sans compte) : `draft-{client_uuid}/...`
--
-- Politique d'accès :
--   - PRIVATE bucket (pas d'URL publique)
--   - Le worker `value-build-estimation` accède via service_role (bypass RLS)
--   - Le frontend génère une URL signée à l'upload (TTL 1h, suffit pour
--     que le worker fetch les images avant l'analyse Claude Vision)
--   - Authenticated user peut INSERT/SELECT/UPDATE/DELETE dans son scope
--     (path starts with `{auth.uid()}/`)
--   - User anonyme peut INSERT dans un scope `draft-*/` (path générique)
--     mais ne peut PAS lister/lire ces objets (URL signée uniquement)
--
-- Pré-requis : Anthropic Claude API doit pouvoir fetch les URLs signées.
-- Les URLs Supabase Storage signées ressemblent à :
-- https://{ref}.supabase.co/storage/v1/object/sign/bien-photos/{path}?token=...
-- Elles sont publiques durant le TTL, donc fetchables par Claude.
-- ════════════════════════════════════════════════════════════════════

-- 1) Création du bucket (privé)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bien-photos',
  'bien-photos',
  false,
  26214400, -- 25 Mo par fichier
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) RLS policies sur storage.objects pour ce bucket

-- a) Lecture : authenticated user lit ses propres photos (path commence par son auth.uid())
DROP POLICY IF EXISTS "bien_photos_select_own" ON storage.objects;
CREATE POLICY "bien_photos_select_own" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'bien-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- b) Insert : authenticated user upload dans son scope
DROP POLICY IF EXISTS "bien_photos_insert_own" ON storage.objects;
CREATE POLICY "bien_photos_insert_own" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'bien-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- c) Update / Delete : authenticated user gère ses propres photos
DROP POLICY IF EXISTS "bien_photos_update_own" ON storage.objects;
CREATE POLICY "bien_photos_update_own" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'bien-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "bien_photos_delete_own" ON storage.objects;
CREATE POLICY "bien_photos_delete_own" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bien-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- d) Insert anonyme : path commence par `draft-` (le frontend génère un client UUID)
-- Permet à un user non-authentifié d'uploader des photos avant de créer son compte.
-- Les photos draft-* sont nettoyées par un cron après 24h sans bien associé.
DROP POLICY IF EXISTS "bien_photos_insert_draft_anon" ON storage.objects;
CREATE POLICY "bien_photos_insert_draft_anon" ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'bien-photos'
    AND name LIKE 'draft-%'
  );

-- e) Service role : bypass complet (le worker accède via service_role key)
-- Pas de policy explicite nécessaire — service_role bypass RLS par défaut.

-- 3) Index pour accélérer la query path
CREATE INDEX IF NOT EXISTS idx_storage_objects_bien_photos_path
  ON storage.objects ((storage.foldername(name)[1]))
  WHERE bucket_id = 'bien-photos';

-- rollback:
-- DROP POLICY IF EXISTS "bien_photos_select_own" ON storage.objects;
-- DROP POLICY IF EXISTS "bien_photos_insert_own" ON storage.objects;
-- DROP POLICY IF EXISTS "bien_photos_update_own" ON storage.objects;
-- DROP POLICY IF EXISTS "bien_photos_delete_own" ON storage.objects;
-- DROP POLICY IF EXISTS "bien_photos_insert_draft_anon" ON storage.objects;
-- DROP INDEX IF EXISTS idx_storage_objects_bien_photos_path;
-- DELETE FROM storage.buckets WHERE id = 'bien-photos';
