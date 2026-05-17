# Infra Feedback

Journal des points d'attention et arbitrages **infra** (Supabase, CLI,
Trigger.dev, Sentry, hosting, CI…) soulevés pendant l'implémentation,
à traiter dans une PR ultérieure quand le sujet redevient prioritaire.

Pendant que `docs/DESIGN_FEEDBACK.md` est strictement centré sur le
visuel (composants, tokens, photos, layout), ce fichier consigne tout
ce qui touche aux briques techniques en dessous : configurations de
projets cloud, divergences entre conventions locales et conventions
distantes, comportements CLI surprenants, contraintes de déploiement.

Format d'entrée : date · contexte · point · recommandation.

---

## 2026-05-17 — Divergences `config.toml` local vs remote sur les 2 projets Supabase

**Contexte** : Phase Code PR1, étape link Supabase. Après
`pnpm exec supabase link --project-ref ... --workdir supabase-app`
(idem pour `supabase-data`), la CLI v1.226.4 a affiché un avertissement
`WARNING: Local config differs from linked project` pour les deux
projets. Les `config.toml` locaux ont été générés par
`supabase init` (CLI v1.226.4) avec des defaults Supabase v1, alors que
les projets distants ont été créés via le Dashboard avec les defaults
Supabase v2 actuels.

**Point** : 5 divergences identiques sur la section `[auth]` des deux
configs locales :

| Clé | Local (notre config.toml) | Remote (projet réel) |
|---|---|---|
| `site_url` | `http://127.0.0.1:3000` | `http://localhost:3000` |
| `additional_redirect_urls` | `["https://127.0.0.1:3000"]` | absent |
| `enable_confirmations` | `false` | `true` |
| `max_frequency` | `1s` | `1m0s` |
| `otp_length` | `6` | `8` |

Ces 5 divergences sont strictement identiques entre `supabase-app` et
`supabase-data` parce que les deux `config.toml` proviennent du même
template `supabase init`. Aucun impact sur le `db push` (ces clés
concernent uniquement l'auth, pas le schéma DB).

**Distinction projet par projet** :

- **`immoscan-app`** : projet où l'auth Supabase sera **activement
  utilisée** dès la PR1 étape Auth (signup, login, magic link, Google
  OAuth). Les divergences sont **pertinentes** et devront être traitées
  avant cette étape pour éviter un comportement auth inattendu (`http://`
  vs `https://`, confirmation email obligatoire ou non, longueur OTP).
- **`immoscan-data`** : projet **sans auth utilisée** (référentiels
  publics, accédé uniquement par le worker en `service_role`, jamais
  par un user). Les divergences sont **cosmétiques** sur ce projet — à
  aligner pour cohérence d'audit, pas pour fonctionnement.

**Recommandation** :

Au moment d'attaquer l'étape Auth de PR1, arbitrer une fois pour
toutes la source de vérité :

1. **Option A — Le remote est source de vérité** : mettre à jour les
   `config.toml` locaux pour matcher les defaults Supabase v2
   actuels. Avantage : suit les évolutions Supabase. Inconvénient :
   si on veut un comportement spécifique (ex:
   `enable_confirmations = false` pour accélérer le signup en dev),
   on perd la maîtrise.
2. **Option B — Le local est source de vérité** : pousser nos
   `config.toml` vers le remote via `supabase config push`
   (CLI v2 uniquement, ou via Dashboard manuellement en v1).
   Avantage : la config est versionnée dans le repo, reproductible
   en CI. Inconvénient : il faut être sûr de ce qu'on veut.

**Décision PO : Option B pour les deux projets**, par discipline et
pour éviter une asymétrie qui serait mal comprise plus tard. Sur
`immoscan-app`, c'est fonctionnel (l'auth est activement utilisée).
Sur `immoscan-data`, c'est du formalisme (l'auth y est désactivée
mais on versionne quand même pour cohérence d'audit et
reproductibilité CI).

À traiter dans l'étape Auth de PR1.

---

## 2026-05-17 — Piège bash : redirection `>` truncate avant exécution de commande

**Contexte** : Phase Code PR1, ÉTAPE 6 (gen types). Le script
`db:types:app` a échoué (manque `--linked` en CLI v1, corrigé depuis)
mais la redirection `> packages/db/src/app.types.ts` avait déjà
truncated le fichier à 0 lignes avant que la commande ne crashe.
Restauré via `git checkout HEAD -- ...`.

**Point** : tous les scripts du `package.json` racine qui font
`commande > fichier` sont vulnérables à ce piège. Si la commande
crash, le fichier est perdu silencieusement parce que bash ouvre le
fichier en mode truncate **avant** de lancer la commande.

**Scripts concernés actuellement** :
- `db:types:app` (corrigé via `--linked`)
- `db:types:data` (corrigé via `--linked`)

**Recommandation** : dans une PR cosmétique future, refactorer les
scripts pour utiliser le pattern :

```
commande --output /tmp/temp.ts && mv /tmp/temp.ts dest.ts
```

ou un wrapper `set -o pipefail` équivalent qui n'écrase pas la
destination en cas d'échec. Pas urgent puisque les sources sont
versionnées dans Git (restaurable via `git checkout HEAD --
<fichier>`), mais à traiter avant qu'on introduise des scripts plus
critiques (ex: génération de seed data, export de backup, etc.).
