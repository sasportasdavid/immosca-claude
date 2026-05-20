# WORDING_NOTES — Refonte DA + ImmoValue

> Sortie attendue par le README handoff §2. Liste les chaînes
> modifiées vs les maquettes, les incohérences terminologiques
> repérées dans le produit, et les arbitrages humains nécessaires.

**Date :** 20 mai 2026
**Périmètre :** PRs #13 → #20 (chantier DA ImmoScan + sous-produit ImmoValue)

---

## ✏️ Chaînes modifiées par rapport aux maquettes

### Sur la landing ImmoScan retenue (`Landing - Mix.html`)
- **Tarifs** : alignés sur `CLAUDE.md` §12 (Pro 49€/mois, Pro+ 99€/mois,
  Business 249€/mois) plutôt que sur le HTML handoff (39/99/449€). La
  spec produit reste source de vérité — si le marketing veut diverger,
  arbitrage PO requis.
- **Pay-per-use** : retiré de la landing (CLAUDE.md §12 le déclare
  "dormant" jusqu'à PR Stripe Billing).
- **Tarifs annuels** : non affichés, l'engagement n'est pas câblé V1.
- **Logo SVG ImmoScan** : remplacé le bloc logo legacy par un wordmark
  sérif italique fidèle au handoff (mark violet-grad + "Immoscan." avec
  point violet en suffixe).
- **Liens CTA pricing** : tous pointent vers `/auth/signup` avec
  `?plan=...`. Le routing du plan n'existe pas encore — wiring à
  ajouter en PR ultérieure quand Stripe Billing sera complet côté
  frontend.

### Sur le dashboard (`/dashboard`)
- Ajout du serif italique violet « prêt à scanner ? » dans le header
  (style `.greet h1 .it` du handoff).
- « Conclus ton 1er deal ⭐ » → « Conclus ton 1er deal » (suppression
  emoji décoratif, §2 handoff).
- « 1ère analyse » → « 1re analyse » (typographie française correcte).
- « 6,5% » → « 6,5 % » (espace insécable systématisé sur tous les
  pourcentages des KPI).
- Bouton secondaire `variant="outline"` → `variant="ghost"` (cohérence
  handoff : ghost neutre pour les CTA secondaires).

### Sur la page analyse (`/app/analyses/$id`)
- `analysis-progress.tsx` : titres contextualisés "Étape N / 4 —
  *croisement avec le marché.*" avec serif italic violet.
- "Cette page se rafraîchit toute seule" → "Tu peux fermer l'onglet et
  revenir plus tard — on garde tout côté serveur et on t'envoie une
  notif à la fin." (tutoiement + ton plus rassurant, cf maquette
  In-progress).
- Step 4 "Analyses Claude" → "Top 5 par Claude" (cohérence DA + Claude
  vs André, voir incohérences ci-dessous).
- TruncateBanner : "Ta recherche couvrait plus de N biens" gardé tel
  quel (déjà tutoyé, déjà avec espaces insécables).

### Sur la nouvelle analyse (`/app/nouvelle-analyse`)
- H1 reformulé : « Décris ta recherche. »
- "Pour t'y retrouver entre plusieurs analyses" (tutoiement préservé,
  reformulation plus claire).
- Erreur d'invocation worker formatée avec espace insécable : "Impossible
  de démarrer l'analyse :"
- Le sélecteur de 6 stratégies du handoff n'a pas été ajouté car le form
  Zod actuel n'a pas de champ `strategy` (la stratégie vient du profil
  via `userParams.data.strategy`). Cf §1 handoff "tu ne touches pas au
  useForm/Zod".

### Sur les veilles
- `gone` listing status mappé en `<VerdictPill verdict="bad">` (rouge)
  faute de variant `neutral`. Si le PO veut un gris pour "vendu/retiré",
  ajouter une variante.
- Countdown urgent veille Free → `<Badge variant="terra">` au lieu de
  `border-amber-400 text-amber-700`.

### Sur le drawer fiche bien (`Listing Drawer`)
- Pourcentages : virgule décimale française systématisée via
  `Intl.NumberFormat("fr-FR")` + NBSP (déjà natif Intl).
- "2 pièces" au lieu de "2P" (lisibilité).
- "Cible :" avec espace insécable (typographie française).
- Footer sticky de la maquette (score + prix + cashflow + CTA fixés en
  bas) **non implémenté** car l'API `Sheet` actuelle de shadcn n'a pas
  de `<SheetFooter>` sticky. Bouton "Ajouter au pipeline" reste dans
  le header pour préserver l'API.

### Sur la landing ImmoValue (`/`)
- Headline brief : *"Estime ton bien, suis le marché, vends au bon
  moment."* au lieu de la headline alternative *"L'expertise
  immobilière, à grande échelle."*
- Suppression de la mention "13 sources" en partie Méthode (brief
  design §3.1 : "sans dire 13 sources"). La mention "13 sources de
  données publiques" reste **uniquement** sur l'écran Calcul (étape 6).

### Sur les emails value
- value-basculement.ts : "Bien que tu suivais le 8 mai" → "Bien que tu
  suivais depuis 12 jours" (humanisation relative, toujours juste).
- value-alerte.ts : sujets dynamiques avec NBSP + virgule décimale fr
  (📈 +X,X % vs maquette qui montrait juste +4,2%).
- Stable (delta=0) : "Mise à jour de la valeur de ton bien" (sujet
  ajouté qui n'était pas dans la maquette mais nécessaire pour les
  recomputes weekly sans variation).

---

## ❓ Chaînes pour lesquelles un arbitrage humain est nécessaire

1. **Tarifs landing ImmoScan** : on a aligné sur CLAUDE.md (49/99/249)
   plutôt que sur le HTML handoff (39/99/449). Confirmer source de
   vérité.

2. **Compteurs widget plan AppShell** : actuellement hardcodés "8/10
   analyses · 3/3 veilles · Renouvellement le 28 mai". À brancher sur
   `useDashboardSummary()` quand on aura le temps. Cf commentaire en
   bas du `components/app-shell.tsx`.

3. **"As seen on TechCrunch"** : pas dans la Mix retenue mais explicite
   dans le brief design §3 ("À NE PAS faire"). Confirmé absent.

4. **PostHog/Sentry projet séparé ImmoValue** : V1 utilise les mêmes
   instances qu'ImmoScan. Quand le PO sera prêt, ajouter
   `VITE_POSTHOG_KEY_VALUE` (ou équivalent) dans `apps/value-web/.env`.

5. **PR-V1 statut 'anonymous_draft'** : le brief design §3.1 écran 6
   prévoit un mode "estimation anonyme" (l'user crée son compte
   APRÈS avoir lancé l'estimation). Le CHECK constraint actuel sur
   `value.biens.status` ne whitelist pas `'anonymous_draft'`. Choix V1 :
   forcer login en step 5 du tunnel. Migration V2 si on veut vraiment
   l'estimation anonyme : `ALTER TABLE value.biens DROP CONSTRAINT
   biens_status_check; ... ADD CHECK status IN (...'anonymous_draft')`
   + relâcher `user_id NULL when status='anonymous_draft'`.

6. **WatchListingStatus `gone`** : mappé en VerdictPill rouge. Confirmer
   si on veut un variant `neutral` (gris) plus tard.

---

## ⚠️ Incohérences terminologiques repérées dans le produit

### 1. "Claude" vs "André" comme persona IA

Le HTML handoff utilise **"André"** comme persona IA narratif (cf
`Analyse - Done.html`, `Listing Drawer.html`, `Dashboard.html`).
Le code ImmoScan utilise **"Claude"** (cf `CLAUDE.md` §15, le composant
`<TheseBlock attribution="Claude">`).

**Décision V1 :** conservé "Claude" partout pour cohérence interne
(spec produit > design). Si le PO veut basculer en "André" pour
distinguer l'agent éditorial du LLM technique, c'est :
- 1 changement dans `<TheseBlock attribution>`
- ~5 occurrences "Claude" dans le code à remplacer
- Mise à jour des prompts (Claude continue de signer "André" dans le
  prompt système)

### 2. "Veille" vs "scout" vs "scan"

Le code utilise **"veille"** pour le monitoring continu d'une
recherche (table `watches`, route `/app/veilles`) et **"scout"** comme
verbe d'action ("le scout tourne 3×/sem"). **"Scan"** est plus
ponctuel (une seule analyse).

**Cohérent.** Pas d'action nécessaire.

### 3. "Bien" vs "annonce" vs "listing"

- **"Bien"** : objet immobilier physique (côté propriétaire / DVF /
  ImmoValue). Table `value.biens`.
- **"Annonce"** : représentation publique d'un bien sur la vitrine
  (ImmoValue route `/annonces`). Aussi utilisé côté SeLoger/LBC.
- **"Listing"** : code historique ImmoScan pour les biens scrapés
  (table `listings`).

**Décision V1 :** gardé tel quel. Le contexte fait la différence (page
côté propriétaire = "bien", page côté acheteur = "annonce", données
scrapées = "listing"). À harmoniser en V2 si confusion utilisateurs.

### 4. "Thèse" vs "analyse" vs "verdict"

- **"Thèse"** : paragraphe argumenté généré par Claude (200-350 mots
  dans ImmoValue, ~200 mots dans ImmoScan Top 5).
- **"Analyse"** : le rapport complet d'une recherche ImmoScan.
- **"Verdict"** : conclusion qualitative (à visiter / sous réserve /
  no go) — c'est un enum SQL `verdict_type`.

**Cohérent.** Pas d'action.

### 5. "Discret" vs "off-market" vs "pré-vente"

ImmoValue : **"discret"** dans le code (status SQL), **"Pré-vente
discrète"** sur la vitrine acheteur (watermark photos + bandeau),
**jamais "off-market"** dans le user-facing (snobisme à éviter).

**Cohérent.** Pas d'action.

### 6. Espaces insécables

Appliqué systématiquement avant `?` `!` `:` `;` `€` `%` `k€` dans tous
les écrans repaintés. Le shortcut ` ` est utilisé inline (lisible
dans le source). Les libs de format (Intl.NumberFormat fr-FR, Intl
.RelativeTimeFormat) gèrent natif les NBSP.

Pas d'occurrence "5€" (sans espace) trouvée post-repaint. Les vieux
fichiers non touchés (auth/login, onboarding) gardent le wording
existant.

### 7. Tutoiement / vouvoiement

**Tutoiement systématique** appliqué dans tous les écrans repaintés et
les nouveaux ImmoValue. Aucune occurrence de "vous" résiduelle
identifiée.

---

## 🔢 Vérification des nombres

Tous les chiffres dans les maquettes (87 biens, 24/30, 312k€, 84% de
confiance) ont été identifiés comme **mock** et soit :
- Branchés sur le back via `useDashboardSummary()`, `useBien()`,
  `useBienStats()`, etc.
- Laissés en mock V1 hardcodé dans `apps/value-web/src/lib/mock-annonces.ts`
  et `DiscretStatsDashboard.tsx` avec fallback vers vraies données dès
  que le worker `value-compute-stats` peuplera `value.bien_stats`.

**Aucun nombre business-critique (prix, scores, taux) n'est hardcodé
dans le code applicatif.**

---

## 📋 Récapitulatif des PRs créées

| # | Branche | Description |
|---|---|---|
| #13 | `feat/da-foundations-tokens` | Tokens stone+violet+terra+sage + MAPPING.md |
| #14 | `feat/da-foundations-components` | Re-skin 14 shadcn + 9 atoms |
| #15 | `feat/da-repaint-screens` | 7 écrans ImmoScan repaint |
| #16 | `feat/value-backend-schema` | Schema SQL value.* + RLS + anonymisation |
| #17 | `feat/value-backend-workers` | 7 workers Trigger.dev + claude-vision |
| #18 | `feat/value-backend-edge-fns` | 3 Edge Functions + extension stripe-webhook |
| #19 | `feat/value-frontend-web` | Workspace value-web + 18 écrans |
| #20 | `feat/value-emails-templates` | Templates email value-alerte + basculement |

8 PRs au total pour ce chantier (refonte DA + sous-produit ImmoValue).

---

## ✅ Conformité §2 README handoff

- ✏️ Modifications wording : listées ci-dessus
- ❓ Chaînes à arbitrer : 6 points listés (tarifs, compteurs widget,
  anonymous_draft, PostHog ImmoValue, persona André, variant neutral)
- ⚠️ Incohérences terminologiques : 7 axes analysés, dont 1 nécessite
  arbitrage (Claude vs André)

Document à mettre à jour à chaque PR si nouveau wording.
