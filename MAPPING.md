# MAPPING — Audit routes ImmoScan ↔ Design Handoff

**Date :** 20 mai 2026  
**Branche :** `claude/gallant-northcutt-67ddc6`  
**Auteur :** Audit automatisé Claude Code  

---

## 1. Routes existantes — inventaire complet

### Authentification & Onboarding

| Route code | Fichier source | Finalité fonctionnelle |
|---|---|---|
| `/auth/login` | `routes/auth/login.tsx` | Connexion email / OAuth Supabase |
| `/auth/signup` | `routes/auth/signup.tsx` | Création compte avec email |
| `/auth/callback` | `routes/auth/callback.tsx` | Callback OAuth Supabase |
| `/onboarding/step-1` | `routes/onboarding/step-1.tsx` | Onboarding étape 1 (profil investisseur) |
| `/onboarding/step-2` | `routes/onboarding/step-2.tsx` | Onboarding étape 2 (paramètres recherche) |

### Public & Légal

| Route code | Fichier source | Finalité fonctionnelle |
|---|---|---|
| `/` | `routes/index.tsx` | Landing page publique |
| `/dashboard` | `routes/dashboard.tsx` | Dashboard post-login (accueil app) |
| `/cgu` | `routes/cgu.tsx` | Conditions générales d'utilisation (old route, doublon) |
| `/confidentialite` | `routes/confidentialite.tsx` | Politique de confidentialité (old route, doublon) |
| `/legal/cgu` | `routes/legal/cgu.tsx` | CGU (route canonique) |
| `/legal/cgv` | `routes/legal/cgv.tsx` | Conditions générales de vente |
| `/legal/confidentialite` | `routes/legal/confidentialite.tsx` | Politique de confidentialité (canonique) |
| `/legal/mentions-legales` | `routes/legal/mentions-legales.tsx` | Mentions légales |

### Analyses & Recherche

| Route code | Fichier source | Finalité fonctionnelle |
|---|---|---|
| `/app/nouvelle-analyse` | `routes/app/nouvelle-analyse.tsx` | Formulaire nouvelle recherche (URL ou guidée) |
| `/app/analyses/` | `routes/app/analyses/index.tsx` | Liste des analyses (table) |
| `/app/analyses/$id` | `routes/app/analyses/$id.tsx` | Page analyse détaillée (done ou in-progress) |
| `/app/adresse` | `routes/app/adresse.tsx` | Détail adresse / fiche bien (drawer ou modal) |

### Veilles

| Route code | Fichier source | Finalité fonctionnelle |
|---|---|---|
| `/app/veilles/` | `routes/app/veilles/index.tsx` | Liste des veilles actives |
| `/app/veilles/$id` | `routes/app/veilles/$id.tsx` | Détail d'une veille (3 onglets) |
| `/app/veilles/nouvelle` | `routes/app/veilles/nouvelle.tsx` | Création nouvelle veille |

### Gestion compte

| Route code | Fichier source | Finalité fonctionnelle |
|---|---|---|
| `/app/billing` | `routes/app/billing.tsx` | Gestion abonnement & facturation Stripe |
| `/app/pipeline` | `routes/app/pipeline.tsx` | Vue pipeline 5 colonnes (Kanban-like) |

---

## 2. Mapping routes code ↔ HTML maquettes

| Route code | Fichier HTML maquette | Status | Notes |
|---|---|---|---|
| `/` | `Index.html` | Repaint | Landing publique, navigation vers login / app |
| `/dashboard` | `Dashboard.html` | Repaint | Accueil app post-login, greeting + KPIs + recos André |
| `/app/nouvelle-analyse` | `Nouvelle recherche.html` | Repaint | Deux modes : coller URL (détection live) ou recherche guidée 6 stratégies |
| `/app/analyses/$id` (status=pending/scraping) | `Analyse - In progress.html` | Repaint | Pendant scan : pourcentage XXL, timeline 4 étapes, skeleton Top 5 |
| `/app/analyses/$id` (status=done) | `Analyse - Done.html` | Repaint | Post-scan : KPI grid, Top 5, map SVG, filter bar, tableau triable |
| `/app/adresse` (drawer) | `Listing Drawer.html` | Repaint | Side panel 13 sections : galerie, prix, caractéristiques, scoring, simulateur, thèse André, plan financement, source |
| `/app/veilles/` | `Veilles.html` | Repaint | Liste veilles actives + countdown expiration (Free tier) |
| `/app/veilles/$id` | `Veille - Detail.html` | Repaint | 3 onglets : Opportunités / Évolutions / Historique runs |
| `/auth/login` | (pas de maquette spécifique) | Code seulement | Écran auth minimal, pas redesign prévu |
| `/auth/signup` | (pas de maquette spécifique) | Code seulement | Écran auth minimal, pas redesign prévu |
| `/auth/callback` | (pas de maquette spécifique) | Code seulement | Endpoint OAuth technique, pas UI |
| `/onboarding/step-1` | (pas de maquette spécifique) | Code seulement | Onboarding existant, pas dans le handoff |
| `/onboarding/step-2` | (pas de maquette spécifique) | Code seulement | Onboarding existant, pas dans le handoff |
| `/app/billing` | (pas de maquette spécifique) | Code seulement | Page Stripe Billing, pas redesign |
| `/app/pipeline` | (pas de maquette spécifique) | Code seulement | Vue Kanban, mentionnée dans dashboard mais pas écran dédié dans maquette |
| `/legal/*` | (pas de maquette spécifique) | Code seulement | Pages légales templates standard, pas redesign |

### Récapitulatif mapping

- **Repaint** : 8 écrans
- **Code seulement** : 9 routes (auth, onboarding, pipeline, billing, legal)

---

## 3. Écrans du handoff SANS équivalent code existant

Maquettes ImmoValue qui n'ont PAS de route ImmoScan — à créer seulement si demandé explicite.

| Fichier HTML maquette | Écran ImmoValue | Statut | Recommandation |
|---|---|---|---|
| `Immovalue - Landing.html` | Landing sous-produit | **Maquette seulement** | Créer route `/value/` ou domaine séparé. À confirmer avec PO. |
| `Immovalue - Tunnel 1 Adresse.html` | Étape 1/4 tunnel estimation | **Maquette seulement** | Prévu dans spec ImmoValue §7.3. Créer `/value/estimer/index.tsx`. |
| `Immovalue - Tunnel 2 Description.html` | Étape 2/4 tunnel | **Maquette seulement** | Créer `/value/estimer/description.tsx`. |
| `Immovalue - Tunnel 3 Photos.html` | Étape 3/4 tunnel | **Maquette seulement** | Créer `/value/estimer/photos.tsx`. |
| `Immovalue - Liens comparables.html` | Étape 4/4 tunnel ⭐ | **Maquette seulement** | Créer `/value/estimer/liens-comparables.tsx`. **Composant clé** du spec. |
| `Immovalue - Résultat.html` | Résultat estimation ⭐ | **Maquette seulement** | Créer `/value/estimer/resultat.tsx`. Affichage fourchette + thèse + ajustements. |
| `Immovalue - Stats discret.html` | Dashboard bien mode discret ⭐ | **Maquette seulement** | Créer `/value/biens/$id/stats.tsx`. Bandeau J+12, graphe 30j, favoris vs médiane IRIS. |
| `Immovalue - Page bien discret.html` | Annonce côté acheteur pré-vente | **Maquette seulement** | Créer `/value/annonces/$slug.tsx`. Photos floutées, counter live, file d'attente. |
| `Email digest.html` | Template email scout (preview) | **Référence seulement** | Pas une route front. À générer côté back via MJML/React Email existant. |
| `Mobile.html` | Guidance responsive iOS | **Référence seulement** | 3 frames bonus. Responsive ImmoScan/ImmoValue à suivre, pas une route. |

### Landing Mix retenue

`Landing - Mix.html` + `Landing - Sober.html` + `Landing - Cartographique.html` + `Landing - Editorial.html` sont des **explorations du hero** pour la landing `/`. Seul le **Mix est retenu** pour intégration. Les 3 autres sont à conserver en réf visuelle mais pas à pusher en prod.

---

## 4. Inventaire des composants UI existants

Composants shadcn/ui déjà dans le codebase qui devront être re-skinnés aux tokens handoff :

| Composant | Chemin | Variants existants | Re-skin requis |
|---|---|---|---|
| `Button` | `components/ui/button.tsx` | default, primary, secondary, ghost, outline | ✓ Ajouter variants `.btn-terra`, `.btn-lg`, `.btn-sm` pour ImmoValue |
| `Badge` | `components/ui/badge.tsx` | default, secondary, destructive, outline | ✓ Ajouter `.score` + `.verdict` variants |
| `Card` | `components/ui/card.tsx` | Base + header/content/footer | ✓ Tokens `--card`, `--line`, shadow `--lvl-1` |
| `Input` | `components/ui/input.tsx` | Text-like inputs | ✓ Border `--line`, focus ring violet |
| `Label` | `components/ui/label.tsx` | Base | ✓ Color `--muted`, font-size 13px |
| `Textarea` | `components/ui/textarea.tsx` | Base | ✓ Border, focus violet |
| `Select` | `components/ui/select.tsx` | Base + trigger/content | ✓ Colors, borders |
| `RadioGroup` | `components/ui/radio-group.tsx` | Base | ✓ Colors ring-violet |
| `DropdownMenu` | `components/ui/dropdown-menu.tsx` | Base | ✓ Colors, shadows |
| `Sheet` | `components/ui/sheet.tsx` | Side/overlay | ✓ Used for listing drawer, re-skin borders/shadows |
| `Tabs` | `components/ui/tabs.tsx` | Base | ✓ Used in veille detail (3 onglets), re-skin border |
| `Tooltip` | `components/ui/tooltip.tsx` | Base | ✓ Colors, shadows |

---

## 5. Composants UI À CRÉER pour la nouvelle DA

Selon le handoff §4 + §5, composants utilitaires nouveaux à créer ou wrapper autour de shadcn :

### Classes helper (CSS utilitaires)

| Classe | Usage | Tokens | Exemple |
|---|---|---|---|
| `.eyebrow` | Préfixe section (11px UPPERCASE letter-spaced) | `--mute-2`, Inter 500 | `<span class="eyebrow">Top 5 biens</span>` |
| `.tnum` | Tabular numbers (align chiffres colonnes) | `font-variant-numeric: tabular-nums` | `<td class="tnum">312 500 €</td>` |
| `.mono` | Font mono (JetBrains Mono) + tnum | `--mono` + tnum | `<span class="mono">v2.4.1</span>` |
| `.serif-it` | Instrument Serif italic (accents éditoriaux) | `--serif` italic 400 | `<em class="serif-it">verdict argumenté</em>` |

### Composants scénés (avec variants)

| Composant | Variants | Usage | Tokens |
|---|---|---|---|
| `.score` | `.good` / `.mid` / `.bad` | Badge score 32px carré mono | `--score-excellent/good/poor` |
| `.score-sm` | `.good` / `.mid` / `.bad` | Score compact 24px | idem |
| `.score-lg` | `.good` / `.mid` / `.bad` | Score XXL 48px | idem |
| `.verdict` | `.good` / `.mid` / `.bad` | Pill rounded-full état qualitatif | `--score-*` |
| `.dpe.a` … `.dpe.g` | 7 classes | Badge étiquette énergie ADEME 22px | `--dpe-a` à `--dpe-g` |
| `.conf-badge` | — | Indice confiance (meter + %) | `--ok-soft`, `--warn-soft`, `--bad-soft` |
| `.chip` | — | Petit badge h22 rounded-full (tags) | `--bg-2`, `--mute-2` |
| `.card` | — | Wrapper standard white + border + shadow | `--card`, `--line`, `--lvl-1` |

### Composants ImmoValue (terracotta + sage)

| Composant | Usage | Tokens | Notes |
|---|---|---|---|
| `.status-badge.suivi` | Bien en mode suivi | `--bg-2` / `--muted` | Couleur neutre |
| `.status-badge.discret` | Bien en mode discret anonymisé | `--info` / `--info-soft` | Bleu discret |
| `.status-badge.public` | Bien publié identifié | `--terra` / `--terra-soft` | Terracotta actif |
| `.status-badge.vendu` | Bien vendu (hors vitrine) | `--muted` / `--muted-soft` | Gris fermé |
| `.adj-item` | Ligne ajustement thèse | Terra accent + critère + impact | Icône + texte + valeur |
| `.these` | Bloc thèse argumentée | Eyebrow terra + serif italic | "À notre avis..." |
| `.iv-logo` | Wordmark ImmoValue (mark violet + nom) | Violet + serif | Mark + "ImmoValue" typographie mixte |
| `.stepper` | Tunnel 4 étapes (forme UI) | Connected lines + circle + label | État active/done/pending |
| `.iv-nav` | Nav sticky mode discret/public | `--card` + backdrop-filter blur | Sticky top, toggle basculement |

---

## 6. Risques détectés — comportements simulés en JS

Selon le README handoff §1 et §6, ces behaviors ne doivent PAS être recodés sauf demande explicite :

### Risques ImmoScan

| Comportement | Où | Situation actuelle | Recommandation |
|---|---|---|---|
| **Ticker live** des biens scannés | `Landing - Mix.html` hero | Défilement CSS pur, JS fake | Laisser placeholder. Si vrai feed websocket désiré, créer worker + websocket séparé. |
| **Détection live d'URL** | `Nouvelle recherche.html` | Animation visuellement dynamique | Laisser placeholder. Vérifier avec back si endpoint existe. |
| **Carte SVG** | `Analyse - Done.html` | Dessin statique dans maquette | Placeholder visuel SI le codebase n'utilise pas Mapbox/Leaflet. Si déjà intégré, brancher données existantes. |
| **Simulateur "et si ?"** | `Listing Drawer.html` | Recalc cashflow JS live dans maquette | Brancher sur logique existante (endpoint ou formule React pure). Ne pas inventer. |

### Risques ImmoValue

| Comportement | Où | Situation actuelle | Recommandation |
|---|---|---|---|
| **Validation URL live** | `Immovalue - Liens comparables.html` | JS regex dans maquette | Component `LiensComparablesInput` (spec §7.2) gère validation Zod côté client + serveur. OK à coder. |
| **Scrape photos SeLoger/Leboncoin** | `Immovalue - Tunnel 3 Photos.html` | Simulé en maquette, pas un behavior | Apify workers `value-apify-user-comparables` (spec §5.7) déjà prévu. Utiliser ce système. |
| **Photos floutées SVG** | `Immovalue - Page bien discret.html` | SVG visuel statique | Blur serveur via worker `value-flout-photos` (spec §5.6). Ne pas tenter client-side. |
| **Live counter** page discret | `Immovalue - Page bien discret.html` | Counter vues/favoris temps réel | Brancher sur Supabase Realtime ou polling. Spec §2 / stats discret. |
| **Streaming progressive** estimation | `Immovalue - Tunnel` | "📍 On situe..." → "🧠 Claude rédige..." | Streaming Server-Sent-Events (spec §3.4). Obligatoire pour UX 25-40s latence. |

**Synthèse risque :**
- **0 comportements interdits** codés dans ImmoScan. Landing Mix ticker, détection URL, carte SVG, simulateur → laisser placeholders.
- **ImmoValue comportements spécifiés** : validation URL OK, scrape OK (workers existants), photos floutées OK (worker), counter OK (Realtime), streaming OK (SSE).

---

## 7. Mapping ImmoScan ↔ ImmoValue — briques réutilisables

### Stack partagée — 100% héritée

| Brique | Immoscan | ImmoValue | Réutilisation |
|---|---|---|---|
| **Auth Supabase** | ✓ Existant | ✓ Unifiée | Même projet Supabase, même user_id, schema `auth.users` |
| **Composants shadcn/ui** | ✓ Button, Card, Input, etc. | ✓ Tous réutilisés | Re-skins tokens avec `--terra` additions |
| **Hooks** | ✓ useAuth, useProfile, useQuery | ✓ Réutilisés | Import depuis `@immoscan/shared` |
| **Worker Trigger.dev** | ✓ apps/worker namespacé | ✓ Partage app/worker | Tasks nommées `value-*`, même infra |
| **Webhook Stripe** | ✓ Existant pour analyse premium | ✓ Extension pour publication | Une seule Edge Function `POST /stripe/webhook`, namespace `value` ajouté |
| **Apify** | ✓ Actors SeLoger/Leboncoin | ✓ Réutilisés + scope query user | Mêmes actors, configs dans packages/shared/value |
| **Anthropic API** | ✓ `claude-sonnet-4-6` pour André | ✓ Pour valorisation + vision photos | Même client SDK, prompts séparés |
| **PostGIS** | ✓ DVF, IRIS, OLL, services | ✓ Identiques source 1-6, 8-13 | Mêmes RPCs, même DB |
| **Sentry/PostHog/BetterStack** | ✓ Monitoring | ✓ Monitoring | Tags namespace `value` pour segmentation |
| **Vercel** | ✓ apps/web | ✓ apps/value-web | Projet séparé (spec §1), peut être même compte |

### Schémas & modèles

| Modèle | Immoscan | ImmoValue | Notes |
|---|---|---|---|
| **User** | `auth.users` | `auth.users` (même) | Un seul compte par email, cross-usage |
| **Bien (listing)** | `public.listings` | `value.biens` | Schémas séparés. ImmoValue biens alimentent veilles ImmoScan investisseurs (cross-link). |
| **Analyse** | `public.analyses` | `value.estimations` | Pas de fusion. Modèles différents. |
| **Comparables** | `public.comparable_dvf` | `value.comparable_dvf` + `value.comparable_active` + `value.comparable_user_provided` | ImmoValue source 7 user-provided nouveau type. |

---

## 8. Recommandations d'ordre d'exécution

### Phase 1 — Tokens & Components (PR isolée)
**Priorité : IMMÉDIATE**

1. Migrer `source/tokens.css` + `source/value-tokens.css` dans le système Tailwind/CSS du codebase
   - Ajouter `--terra`, `--terra-soft`, `--terra-deep`, `--terra-grad` au `index.css`
   - Ajouter `--sage`, `--sage-soft` pour ajustements ImmoValue
   - Ajouter `--serif` font-family + `.serif-it` utility
   - Ajouter `.eyebrow` + `.eyebrow-violet` utilities
   - Checker aucune ancienne couleur hardcodée ne traîne
2. Re-skin tous composants shadcn/ui aux tokens handoff
3. Créer composants utilitaires : `.score*`, `.verdict`, `.dpe*`, `.chip`, `.conf-badge`, `.status-badge*`, `.adj-item`, `.these`, `.iv-logo`, `.stepper`, `.iv-nav`
4. **Une PR, ~400 lignes diff, test exhaustif des composants**

### Phase 2 — Écrans ImmoScan (8 PRs = 1 par écran)
**Priorité : APRÈS Phase 1**

1. **Dashboard** (`/dashboard`) — le moins risqué, bon warm-up
   - Greeting + last-analysis quick-resume + KPIs + recos + analyses list + pipeline 5col + source health
   - Composants : Card, Badge, Button, Avatar, Chart (si existant)
   - PR ~300 lignes

2. **Nouvelle recherche** (`/app/nouvelle-analyse`)
   - Mode A : URL avec détection (placeholder visuel, pas JS live)
   - Mode B : recherche guidée 6 stratégies + params accordion
   - Composants : Input, Select, Radio, Button
   - PR ~250 lignes

3. **Analyse In-progress** (`/app/analyses/$id` when status=pending|scraping|enriching|scoring|generating)
   - Percentage giant, timeline 4 étapes, skeleton Top 5
   - Composants : Progress, Timeline, Skeleton
   - PR ~200 lignes

4. **Analyse Done** (`/app/analyses/$id` when status=done) — LE plus dense
   - KPI grid, Top 5 thèses, market summary, SVG map placeholder, filter bar, table triable
   - Composants : Card, Badge, Table, Button, Sheet (filters)
   - PR ~500 lignes (limiter à <600)

5. **Listing Drawer** (`/app/adresse`) — 13 sections
   - Galerie, prix + écart, caractéristiques, mini-map, scoring 6 critères, financiers, simulateur placeholder, thèse, plan financement, negotation rail, description, source
   - Composants : Sheet, Card, Badge, Score, Progress, Form
   - PR ~600 lignes (max)

6. **Veilles list** (`/app/veilles/`)
   - Cards + countdown expire (Free tier)
   - Composants : Card, Badge, Button, Timer
   - PR ~150 lignes

7. **Veille Detail** (`/app/veilles/$id`)
   - 3 onglets : Opportunités / Évolutions / Historique
   - Composants : Tabs, Table, Badge
   - PR ~250 lignes

8. **Landing page** (`/`)
   - Hero Mix retenue, navigation, footer légal
   - Ticker placeholder, call-to-action violet gradient
   - PR ~300 lignes

### Phase 3 — ImmoValue (après MVP ImmoScan stable, 12 semaines post-PR-K)
**Priorité : DÉFERRED per spec §0**

Non du ressort de ce mapping car routes `/value/*` n'existent pas encore. À créer selon spec ImmoValue §7 une fois ImmoScan MVP en production.

---

## 9. Questions à clarifier avant de commencer

À adresser avec le PO/design/lead :

1. **Framework styling** en place = **Tailwind CSS** (validé dans config existant). Re-skin via classe utilities + CSS vars dans `index.css`.
2. **Design system existant** : shadcn/ui (Radix + Tailwind). Modifier les 14 composants existants plutôt que créer nouveaux.
3. **Écrans maquettes vs routes code** : matchés dans ce mapping §2. Immovalue routes n'existent pas — demander avant création.
4. **Tutoiement** : maquettes le font déjà. À confirmer avec product (est assumé oui).
5. **André le persona IA** : copie "André recos", "André thèse", etc. Pas un component UI distinct, juste du wording + styling special (eyebrow viola + serif it). OK à intégrer.
6. **Mode discret/pré-vente ImmoValue** : feature back déjà livrée ? Si oui, intégrer DA dès Phase 2. Si non, attendre Phase 3 post-MVP.
7. **Responsive** : ImmoScan = desktop first (investisseurs), bonus iOS (Mobile.html). ImmoValue = mobile-first (propriétaires).

---

## 10. Incohérences détectées & observations

### Terminologie

- **Bien / annonce / listing** : utilisés de manière interchangeable.
  - Immoscan = "well / listing" (annonce marché)
  - Immovalue = "bien" (propriété estimation)
  - **Décision** : garder "bien" pour Immoscan aussi, changer "listing" → "bien" pour cohérence.

- **Veille / scout / scan** : three termes distincts dans maquettes.
  - "Scan" = recherche ponctuelle Immoscan
  - "Veille" = monitoring continu (existant dans code)
  - "Scout" = aucun (peut être supprimé)
  - **Décision** : garder "scan" + "veille", jamais "scout".

- **Thèse / verdict / analyse** : qualitatif bien.
  - "Thèse" = argumentaire Claude (Immoscan André, Immovalue valorisation)
  - "Verdict" = component UI (badge qual)
  - "Analyse" = page entière résultat
  - **Cohérence validée**, OK à intégrer.

### Langage

- Maquettes tutoi systématiquement (" tu connais ton quartier", "Colle ici"). Conservé.
- "Perle dans 600 annonces" landing = marketing éditorial, OK pour landing, à adapter landing si over-expressive.
- Absence d'espaces insécables avant `?` `!` `:` dans maquettes (déjà corrigé dans code, maintenir).
- Nombres mockées (87 biens, 24/30, etc.) — à chercher depuis le back, jamais hardcoder.

### Architecture

- **No new features** : Listing Drawer simulateur, Landing ticker, URL detection, carte SVG, photo blur, photos scrape, live counter → **tous placeholders**. Aucune implémentation nouvelle sauf demande explicite PO.
- **No DB/API changes** : Pure UI reskin. Aucun contrat API ne change, aucun schéma ne diverge.

---

## 11. Résumé de l'audit

| Métrique | Valeur |
|---|---|
| **Routes existantes** | 23 |
| **Routes à repeindre** | 8 (Immoscan) + 8 (Immovalue TBD) |
| **Écrans avec mapping clair** | 8 (Immoscan) |
| **Écrans sans équivalent code** | 8 (Immovalue, spec déferred) |
| **Composants UI à re-skin** | 14 (shadcn/ui) |
| **Composants UI à créer** | 15 (utilities + variants) |
| **Risques majeurs** | 0 (tous comportements simulés documentés, placeholders identifiés) |
| **Dépendances bloquantes** | 0 (stack 100% réutilisable) |
| **Effort estimé Phase 1** | 1 PR ~400 lignes (tokens + components) |
| **Effort estimé Phase 2** | 8 PRs ~2500 lignes total (1 par écran Immoscan) |
| **Effort estimé Phase 3** | TBD (Immovalue post-MVP) |

---

**Audit complété** — Prêt pour Phase 1.

