# DESIGN_OUT_OF_SCOPE.md — Écrans hors PR1

Tous les écrans présents dans le handoff Claude Design (référence
`5jVqiHW-V-eVo-xuYc1JhA`, archivé localement dans
`/tmp/immoscan-design/extract/immoscan/project/`) qui **ne sont pas livrés
en PR1**. Plus les écrans **absents du handoff** mais identifiés comme
nécessaires.

PR1 livre exclusivement : signup → onboarding (2 steps) → dashboard vide →
logout → reconnexion. Tout le reste est ici, classé par PR cible.

> **Convention** : pour chaque écran, j'indique les composants Design à
> créer **avant** de pouvoir brancher le container Code. La règle reste
> "pas de composant local dans `features/`", cf
> [docs/design-integration.md](docs/design-integration.md).

---

## PR2 — Référentiel data + Polish design tokens

Pas de nouvel écran utilisateur. PR2 est essentiellement worker / DB.
Côté Design :

### Tâches design seules

- **Aligner les tokens manquants** : soft semantic backgrounds, tertiary
  foreground, palier radius 12px, border input stone-300, tailles Button
  28/44px (cf DESIGN_SPEC §7).
- **Extraire `<DpeBadge />`** (aujourd'hui inline dans ListingCard) et
  ajouter `showWarning` (Loi Climat 2028).
- **Extraire `<BlurCell />`** comme pattern, harmoniser blur 5px.
- **Ajouter `photoUrl` à `<ListingCard />`**.
- **Refactor `<Badge />`** : variants soft sur tokens, plus de palettes
  Tailwind brutes.
- **Refactor fonts** : `<link rel="preload">` dans `index.html` au lieu
  du `@import` Google Fonts (perf FOIT — cf DESIGN_FEEDBACK).
- **Créer `<AppShell />`** : sidebar 232px + topbar 48px (composé de
  `<AppSidebar />` + `<AppTopbar />` + `<Command />` palette ⌘K).
- Renommer `<AppHeader />` actuel en `<MarketingHeader />` (réservé
  pages signed-out / onboarding / partage public).

### Primitives shadcn à installer en PR2

`<Sheet />`, `<Dialog />`, `<Tooltip />`, `<Avatar />`, `<Separator />`,
`<ScrollArea />`, `<Command />` (cmdk).

---

## PR3 — Ingestion scraping (premier vrai flux utilisateur)

### Écran : Nouvelle analyse — `/app/nouvelle-analyse`

Layout 2 colonnes (handoff écran 4 step-3) :
- Gauche : `<UrlInput />` avec auto-détection live (badge SeLoger rouge /
  Leboncoin orange), live preview "X annonces · ≈ N min",
  3 `<ExampleRow />` (Gagny 661, Montreuil 1042, Saint-Denis 487).
- Droite : récap des 6 paramètres utilisateur read-only + lien "Modifier".

**Composants Design à créer** :
- `<UrlInput />` : input avec icône globe + détection regex + badge source.
- `<ExampleRow />` : card cliquable ville/zip/count/est + badge "Recommandé".
- `<ParamsRecap />` : grille read-only des 6 params + lien retour onboarding.

### Écran : Onboarding step-3 (variante du même flux)

Pour les nouveaux users : `/onboarding/step-3` réutilise la moitié gauche
de l'écran ci-dessus, sans le récap params (déjà saisis aux steps 1+2).

### Écran : Progression analyse — `/app/analyses/[id]/progression`

Animation 5 phases (handoff écran 4 frame Progression) :
1. Détection annonces (≈3s) — "Page 12/26 · 311 annonces extraites"
2. Croisement DVF (≈1.8s) — "4 821 transactions chargées"
3. Calcul rendements (≈2.2s)
4. Top 5 IA (≈2.5s)
5. Finalisation (≈1.2s)

En prod : lire `analyses.status` + `progress_pct` via Supabase Realtime
(cf docs/architecture.md §2-3). L'UX du shimmer + check vert reste.

**Composants Design à créer** :
- `<AnalysisProgress />` : barre principale + shimmer + liste 5 phases.
  Props : `phases: Array<{label, status: 'pending'|'active'|'done', detail?}>`,
  `progressPct: number`, `elapsedSeconds?: number`, `onSkip?: () => void`.
- `<PhaseRow />` : ligne phase avec icône state + label + détail dynamique.

### Écran : Rapport prêt — `/app/analyses/[id]/done`

Page success avec 3 KPI teaser + CTA "Ouvrir mon rapport".

**Composants Design à créer** :
- `<DoneScreen />` : illustration check + h2 + 3 mini-KPIs + CTA primary.

### Écran : Mes analyses — `/app/analyses`

Liste de toutes les analyses passées (handoff écran 6 droite). Filtres
status + recherche + tri. Cards rectangulaires avec mini-map SVG par ville.

**Composants Design à créer** :
- `<AnalysisCard />` : photo `<MiniMap city={ville} />` 200×160 à gauche +
  meta (titre, date, source) + `<StatusPill />` + 4 micro-KPIs.
- `<MiniMap />` : SVG paramétrique par ville (8 variants au minimum :
  gagny, montreuil, saint-denis, paris-19, marseille, lyon-7, romainville,
  le-raincy).
- `<StatusPill />` : pill outline (`terminée` / `en cours` / `en veille` /
  `brouillon`).
- `<AnalysisFilters />` : barre filtre status + search + tri.

### Écran : Rapport — onglet Tableau — `/reports/[id]?tab=tableau`

LE composant central (handoff écran 2-3). 14 colonnes, lignes 56px,
`min-width: 1400px` avec scroll horizontal interne. Hover row reveals
actions pin/more.

**Composants Design à créer** (gros morceau) :
- `<ReportHeader />` : breadcrumb + h1 ville+zip + actions (Export CSV /
  Partager / Mettre en veille / more) + `<Tabs />` Tableau/Top10/Synthèse/Carte.
- `<KpiBar />` : 4 `<KpiCard />` côte à côte avec sparkline + delta vs DVF.
- `<KpiCard />` : variants accent / pos / neg / neutral avec sparkline.
- `<Sparkline />` : SVG area + dot final.
- `<FilterBar />` : search + n `<FilterPill />` + bouton "+ Ajouter" + compteur.
- `<FilterPill />` : pill h-8 active (accent-soft) vs idle, value optionnel,
  popover dropdown.
- `<ListingTable />` : 14 colonnes triables. Variantes lignes Free (3 floutées).
- `<ListingRow />` : row 56px avec hover state + actions.
- `<Th />` : header cell avec sort indicators.
- `<Thumb />` : placeholder SVG 14 teintes (déjà mentionné en PR3).
- `<Pagination />` : numérotation custom mono tnum.

### Écran : Empty Dashboard (premier launch)

Surchargé sur `/dashboard` quand aucune analyse n'existe (handoff écran 8
frame A).

**Composants Design à créer** :
- `<EmptyState />` : hero illustration SVG (3 buildings + sparkle) + h2 +
  p + CTA primary + section 3 examples cliquables (Paris 19e, Lyon 7,
  Marseille). Props : `title`, `body`, `cta`, `examples?`.

### Écrans : États d'erreur (overlays sur Nouvelle analyse)

Handoff écran 8 frames B à G : captcha SeLoger, URL invalide, 0 résultat,
> 1000 résultats avec stratification, file d'attente, Apify down.

**Composants Design à créer** :
- `<ErrorState />` : icône tonifiée + titre + sub + actions + meta footer.
  Props : `tone: 'warning' | 'danger' | 'info'`, `icon`, `title`, `subtitle`,
  `actions: Array<{label, onClick, variant?}>`, `meta?`, `inputErr?: boolean`,
  `extra?: ReactNode` (pour stratification ou queue).
- `<QueueStepper />` : 6 cercles numérotés avec position "Toi" + ETA.
- `<StratificationCards />` : 3 cards tranche prix + count.

### Primitives shadcn à installer en PR3

`<Tabs />`, `<Slider />`, `<Progress />`, `<Popover />`, `<Checkbox />`,
`<Skeleton />`.

---

## PR4 — Scoring + Claude (cœur produit)

### Écran : Fiche bien — Sheet 640px droite

Handoff écran 2-3 droite. Animation translateX 200ms ease-out. Mobile :
plein écran. Sections :

1. Header : titre + prix XL + badge décote DVF + `<ScoreBadge size="lg" />`
   + actions ("Voir l'annonce" / bookmark / more).
2. `<PhotoLarge />` + strip thumbnails 4 photos.
3. Specs grid 2×3 : €/m², Surface, Pièces, DPE, Construction, Étage.
4. Rendement KPIs (6 tiles) : Rdt brut, Rdt net, Rdt net-net, Cashflow,
   Plus-value 10 ans, Coût total.
5. Thèse Claude : 3 paragraphes (DVF / quartier / locataire-risques).
6. Plan financement : `<FinancePlanTable />` calculé (apport, emprunté,
   taux, mensualité, durée, coût crédit total).
7. Stratégie négo : `<NegoLevers />` prix cible + 3 leviers contextualisés.
8. Sources.
9. Footer sticky : "Comparer" + "Épingler dans mon pipeline".

**Composants Design à créer** :
- `<SidePanel />` / `<Sheet>` wrapper avec backdrop + close Esc + transition.
- `<FicheBien />` : composition des sections ci-dessus.
- `<PhotoLarge />` : SVG paramétrique 14 teintes + glyph.
- `<FinancePlanTable />` : table 2 colonnes zebra léger.
- `<NegoLevers />` : liste ordonnée 3 leviers + prix cible chiffré.
- `<ThesisBlock />` : typo éditoriale, eyebrow "Thèse Claude", texte 14px.

### Écran : Rapport — onglet Top 10 — `/reports/[id]?tab=top10`

Handoff écran 5 partie 1. Cards dépliantes (#1 ouverte par défaut),
#1-#2-#3 floutées Free (score ≥80) avec `<LockedExpanded />` overlay.
Chaque card étendue : thèse + négo + finance + verdict.

**Composants Design à créer** :
- `<TopCard />` / `<Top10Card />` : header (#rank + photo + titre + Score +
  4 KpiInline + chevron) + body collapsable.
- `<LockedExpanded />` : overlay teasing freemium (variante de `<BlurCell />`).
- `<Verdict />` : pastille GO / À étudier / Passe.

### Écran : Rapport — onglet Synthèse marché — `/reports/[id]?tab=synthese`

**100 % Free** (preuve de valeur — règle freemium handoff). Handoff
écran 5 partie 2. 4 KPI macro + 3 charts SVG + 4 quartiers gagnants +
3 recommandations.

**Composants Design à créer** :
- `<MarketSynthesis />` : composition des sections.
- `<HistogramChart />` : barres verticales custom (bins prix ou rdt).
- `<DPEDonut />` : donut chart 7 segments ADEME + total au centre.
- `<QuartierCard />` : rank + nom + `<MiniMap />` silhouette + €/m² + delta
  vs médiane.
- `<RecoCard />` : kicker accent + titre + body + stat + CTA "Affiner".
- `<SparkCallout />` : bandeau accent-soft "Synthèse marché 100 % Free".

### Écran : Rapport — onglet Carte — `/reports/[id]?tab=carte`

**SVG inline 720×540 stylisé Gagny** (handoff écran 5 partie 3). Pas
Leaflet en V1 (cf DESIGN_SPEC §6.3).

**Composants Design à créer** :
- `<GagnyMap />` / `<MapView />` : SVG paramétrable par ville (forêt,
  rivière, routes, RER, quartiers labels), markers cliquables, layers
  `plan|heatmap|quartier`. Props : `rows`, `selectedId?`, `onSelect`,
  `onHover`, `layer: 'plan'|'heatmap'|'quartier'`, `cityTemplate: string`.
- `<MapControls />` : zoom in/out + layers + scale bar.
- `<BienMiniCard />` : photo + score + titre + 4 mini KPIs + CTA "Ouvrir".

### Écran : Modal upgrade contextuelle

Déclenchée au clic sur un bien flouté. Pas un mur intrusif global, une
modal élégante qui montre la valeur spécifique débloquée : "Débloque cette
opportunité — Score 87/100, décote estimée 31 000 €".

**Composants Design à créer** :
- `<PricingModal />` : `<Dialog />` avec 3 plans côte à côte, toggle
  Mensuel/Annuel (-20%), 7 jours gratuits Pro. **Aligné CLAUDE.md**
  (Free / Pro 49 / Pro+ 99, pas de Business).
- `<PlanCard />` : utilisé aussi dans Plan & facturation PR6.

### Écran : Email "Rapport prêt"

Template HTML Resend (handoff écran 8 frame H).

**Composants Design à créer** :
- `<EmailTemplate />` : layout 600px + header brand + body slot + footer
  mentions légales + lien désabonnement.
- `<EmailTopRow />` : row Top N avec rank/score/titre/sub/rdt.

### Primitives shadcn à installer en PR4

(la plupart déjà là) `<Tooltip />` étendu, `<Avatar />` extrait,
`<Switch />` pour le toggle Mensuel/Annuel modal pricing.

---

## PR5 — Loyers + Risques

Pas de nouvel écran net. Enrichissement visuel :
- Variant `<Badge />` "Loyer encadré 11e Paris" (à tokeniser).
- Warning "loyer estimé > loyer de référence majoré".
- `<DpeBadge showWarning />` activé pour F/G (Loi Climat 2028).

---

## PR6+ (backlog non priorisé)

### Pipeline Kanban + Liste — `/app/pipeline`

Handoff écran 7. 5 colonnes Kanban (À visiter / Visité / Offre faite /
Compromis / Signé) + vue alternative Liste.

**Composants Design à créer** :
- `<Kanban />`, `<KanbanColumn />`, `<KanbanCard />` (dnd-kit).
- `<PipelineList />` : vue tableau alternative.
- `<StatusPill />` : déjà créé en PR3.
- `<PipelineKpiBar />` : 5 KPI macro (valeur totale, offre engagée,
  cashflow projeté, décote moy, ancienneté).
- `<PersonalNoteBlock />` : zone notes manuscrites.
- `<PhotoUploader />` : drag-drop photos perso.

### Veilles — `/app/veilles`

Handoff écran 7 milieu. Master-detail : liste 320px + détail timeline.

**Composants Design à créer** :
- `<WatchList />` : colonne 320px de `<WatchCard />` + dashed CTA.
- `<WatchCard />` : header + badge "+N" accent + grille 3 params.
- `<WatchDetail />` : header + actions + 4 params + `<EvolutionChart />` +
  `<Timeline />`.
- `<EvolutionChart />` : bar chart "n nouveautés par run".
- `<TimelineRun />` : accordion par exécution (status new/drop/idle).

### Plan & facturation — `/app/plan`

Handoff écran 7 droite. **À aligner CLAUDE.md** : 3 plans (Free / Pro 49 /
Pro+ 99) + pay-per-use, pas de Business.

**Composants Design à créer** :
- `<PlanCard />` : déjà en PR4 (modal upgrade).
- `<UsageQuota />` : bar `used/total` + couleur si maxed.
- `<BillingHistory />` : table factures + state vide.
- `<PaygSku />` : card pay-per-use (single 9€ / pack 5 39€ / pack 20 119€) —
  **ajout vs handoff** (PAYG absent du handoff).
- `<DangerZone />` : zone "Supprimer mon compte" bordée destructive.

### Paramètres compte — `/app/parametres`

**Absent du handoff**, à demander à Claude Design en itération 2. Onglets :
Profil / Paramètres d'investissement / Notifications / Plan & Facturation /
Équipe (Business retiré) / API (Business retiré).

### Page partage publique — `/shared/[token]`

Handoff écran 8 frame J. Read-only avec banner accent fixe "Tu regardes
une démo", synthèse 100% visible, tableau et Top floutés avec gradient
mask, CTA inscription final.

**Composants Design à créer** :
- `<PublicShareLayout />` : layout dédié (pas l'AppShell).
- `<PublicHeader />` : logo + branding subtil + CTA "Crée ton compte".
- `<LockedTeaser />` : placeholder flouté + overlay centré.

### Email "Nouvelle opportunité veille"

Handoff écran 8 frame I. Template Resend.

**Composants Design à créer** :
- Réutilise `<EmailTemplate />` de PR4 + un `<EmailListingPreview />`
  (photo + score + KPIs + lien).

### Mode mobile responsive

Handoff écran 9. 4 écrans clés : Dashboard / Nouvelle analyse / Rapport
(cards empilées) / Modal Upgrade (bottom sheet).

**Composants Design à créer** :
- `<MobileShell />` : header sticky + bottom safe area.
- `<MobileBottomTabs />` : 4 onglets sticky en bas (Tableau / Top 10 /
  Synthèse / Carte) avec safe-area padding 20px.
- `<MobileListingCard />` : photo 88×88 gauche + body avec score top-right
  + prix mono + DPE + rdt/cashflow inline.
- `<MobileKPI />` : version compacte du KpiCard.
- `<MobileUpgradeSheet />` : bottom sheet (rounded-top 24) avec drag
  handle + KPIs teasing + 3 PlanRow + CTA Pro 7j gratuits.

> Note : le tableau ne descend **jamais** en scroll horizontal sur mobile —
> il se transforme en stack vertical de `<MobileListingCard />`. Pas de
> compromis.

### Export PDF / CSV

Pas un écran web : génération côté worker. CSV trivial. PDF via puppeteer
ou react-pdf, consommant les mêmes tokens (mode print à ajouter dans
`index.css` au passage).

### Mode chasseur / Whitelabel (CGP) — post-PMF

Hors scope total. À anticiper côté tokens : `--primary` doit pouvoir être
surchargé par CSS vars custom par tenant (déjà OK structure HSL).

---

## Pages absentes du handoff (à demander en itération 2)

Brief original : 28 écrans. Handoff livré : 22 écrans uniques + 9 frames
système. **Manquent 6 écrans** :

| #  | Écran                              | Route prévue          | Bloc | Priorité  |
|----|------------------------------------|-----------------------|------|-----------|
| A1 | Landing publique                   | `/`                   | A    | PR3 (avant beta) |
| A2 | Pricing détaillé                   | `/pricing`            | A    | PR6+      |
| A3 | Exemple de rapport public          | `/exemple/[id]`       | A    | PR4       |
| A4 | Comment ça marche                  | `/comment-ca-marche`  | A    | PR6+      |
| A5 | Méthodologie                       | `/methodologie`       | A    | PR6+      |
| B1 | Sign up                            | `/auth/signup`        | B    | **PR1**   |
| B2 | Sign in                            | `/auth/login`         | B    | **PR1**   |
| C7 | Paramètres compte                  | `/app/parametres`     | C    | PR6+      |
| C8 | Détail bien depuis pipeline        | `/app/pipeline/[lid]` | C    | PR6+      |

> Pour **Sign up / Sign in PR1** : on construit à la main à partir des
> tokens et primitives du Design System. Formulaire centré sur
> `<AuthLayout />`, pas de visuel marketing à droite en PR1. Si on veut un
> visuel plus fini avec social proof (cf brief original Bloc B), demander
> à Claude Design en parallèle de PR2.

---

## Récapitulatif des primitives shadcn par PR

| Primitive       | PR  | Raison                                |
|-----------------|-----|---------------------------------------|
| Input, Label    | PR1 | Formulaires auth + onboarding         |
| Select          | PR1 | Picker stratégie / tri                |
| RadioGroup      | PR1 | StrategyCards (sémantique radio)      |
| Form            | PR1 | react-hook-form + zodResolver         |
| Sonner (Toast)  | PR1 | Feedback auth + erreurs               |
| Sheet           | PR2 | Préparation Fiche bien                |
| Dialog          | PR2 | Préparation modal upgrade             |
| Tooltip         | PR2 | BlurCell, kbd, sort icons             |
| Avatar          | PR2 | Extraction depuis AppTopbar           |
| Separator       | PR2 | Toolbars, sections                    |
| ScrollArea      | PR2 | Sheet contenu long                    |
| Command (cmdk)  | PR2 | Palette ⌘K                            |
| Tabs            | PR3 | Onglets rapport                       |
| Slider          | PR3 | Budget/apport/taux/rdt                |
| Progress        | PR3 | AnalysisProgress, usage quotas        |
| Popover         | PR3 | FilterPill dropdowns                  |
| Checkbox        | PR3 | Multi-select quartiers                |
| Skeleton        | PR3 | Loading states                        |
| Switch          | PR4 | Toggle Mensuel/Annuel                 |
| Accordion       | PR6+| Timeline runs veille                  |
