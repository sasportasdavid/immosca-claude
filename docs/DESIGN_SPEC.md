# DESIGN_SPEC.md — ImmoScan Design System

> Sources :
> - Handoff Claude Design `5jVqiHW-V-eVo-xuYc1JhA` (9 fichiers HTML + chat
>   transcript, archivé localement dans `/tmp/immoscan-design/extract/immoscan/`).
> - Code déjà intégré : commit `5c93df1 design: PR1 phase Design — tokens
>   ImmoScan + 3 composants + démo` (tokens CSS, 4 primitives shadcn, 3
>   composants applicatifs, page démo `/dev/components`).
> - Conventions discipline Design/Code : `docs/design-integration.md`.

Direction artistique validée : **Linear (ossature) · Attio (vues data) · Qonto
(ton FR)**. Stone warm-neutral + violet brand `#5B47E0`, Inter (UI) +
JetBrains Mono (chiffres tabulaires), mode clair uniquement (itération 1).

---

## 1. Tokens canoniques

Définis en CSS variables HSL dans [apps/web/src/index.css](apps/web/src/index.css)
et exposés en utilitaires Tailwind via
[apps/web/tailwind.config.ts](apps/web/tailwind.config.ts). **Jamais de hex
en dur dans les composants**, sauf les couleurs DPE qui sont officielles ADEME.

### 1.1 Surfaces & texte

| Token              | HSL              | Hex        | Usage                                 |
|--------------------|------------------|------------|---------------------------------------|
| `--background`     | `60 9% 98%`      | `#FAFAF9`  | Fond app                              |
| `--card`           | `0 0% 100%`      | `#FFFFFF`  | Surface élevée (cards, panels)        |
| `--foreground`     | `24 10% 10%`     | `#1C1917`  | Texte primaire                        |
| `--muted-foreground` | `33 5% 32%`    | `#57534E`  | Texte secondaire                      |
| **`--tertiary-foreground`** ⚠️ | — | `#A8A29E` | Texte tertiaire (captions discrètes) — **à ajouter** |
| `--border`         | `20 6% 90%`      | `#E7E5E4`  | Bordures fines                        |
| **`--border-strong`** ⚠️ | —          | `#D6D3D1`  | Bordure input (stone-300) — **à ajouter** ou ajuster `--input` |
| `--ring`           | `28 6% 25%`      | `#44403C`  | Focus ring (3px @ 12% opacity)        |
| `--secondary`      | `60 5% 96%`      | `#F5F5F4`  | Stone-100 — surface neutre douce      |

> ⚠️ Le repo actuel mappe `--input` sur la même valeur que `--border` (stone-200
> `#E7E5E4`), alors que le handoff utilise visiblement stone-300 (`#D6D3D1`)
> pour les bordures d'input. À aligner en PR2 (cf §7 Tâches design ouvertes).

### 1.2 Accent (brand violet) & soft

| Token                  | HSL             | Hex       | Usage                              |
|------------------------|-----------------|-----------|------------------------------------|
| `--primary` (accent)   | `248 71% 58%`   | `#5B47E0` | CTA principal, marque, liens       |
| `--primary-foreground` | `0 0% 100%`     | `#FFFFFF` | Texte sur primary                  |
| `--primary-hover`      | `250 56% 50%`   | `#4A38C7` | Hover CTA                          |
| `--primary-soft`       | `251 67% 95%`   | `#EEEBFB` | Backgrounds doux, pills accent     |

**Gradient subtil autorisé** (et utilisé) sur le CTA primaire :
`background: linear-gradient(180deg, #6452E3 0%, #5B47E0 100%);` — c'est la
seule exception à la règle "no gradient". Hover passe à `#4A38C7` plat.

### 1.3 Sémantique d'état

| Token                | HSL              | Hex        | Usage                            |
|----------------------|------------------|------------|----------------------------------|
| `--success`          | `142 76% 36%`    | `#16A34A`  | Rdt ≥ 6 %, score ≥ 75            |
| **`--success-soft`** ⚠️ | —             | `#DCFCE7`  | Fond doux success — **à ajouter** |
| `--warning`          | `21 90% 48%`     | `#EA580C`  | Score 50-74, DPE D-E             |
| **`--warning-soft`** ⚠️ | —             | `#FFEDD5`  | Fond doux warning — **à ajouter** |
| `--destructive`      | `0 73% 50%`      | `#DC2626`  | Score < 50, DPE F-G, erreurs     |
| **`--destructive-soft`** ⚠️ | —          | `#FEE2E2`  | Fond doux danger — **à ajouter**  |
| `--info`             | `217 91% 53%`    | `#2563EB`  | Info, états neutres bleu          |
| **`--info-soft`** ⚠️ | —                | `#DBEAFE`  | Fond doux info — **à ajouter**    |

> ⚠️ Le repo a `--destructive` et `--primary-soft` tokenisés, mais pas les
> autres soft semantic backgrounds. Le composant `<Badge>` du repo utilise
> directement `emerald-50 / orange-50 / red-50 / blue-50` Tailwind, ce qui
> est **non conforme** à la règle "tokens uniquement". À corriger en PR2.

### 1.4 Scoring sémantique (`<ScoreBadge />`)

Seuils figés par le handoff :

| Token                | HSL              | Hex       | Score     | Label          |
|----------------------|------------------|-----------|-----------|----------------|
| `--score-excellent`  | `142 76% 36%`    | `#16A34A` | ≥ 75      | "Opportunité"  |
| `--score-good`       | `21 90% 48%`     | `#EA580C` | 50–74     | "Correct"      |
| `--score-poor`       | `0 73% 50%`      | `#DC2626` | < 50      | "No-go"        |

Rendu : `min-width: 36px; height: 24px; padding: 0 6px;` (taille md),
`rounded: 4px`, `font-family: 'JetBrains Mono'; font-weight: 600;
font-size: 13px; font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
color: white;`. Variantes `sm` (28×20) et `lg` (52×32) attendues.

> Le repo actuel implémente exactement ces dimensions. ✅

### 1.5 DPE — couleurs ADEME officielles

| Token      | Hex       | Classe | Consommation       |
|------------|-----------|--------|--------------------|
| `--dpe-a`  | `#319834` | A      | < 70 kWh/m²        |
| `--dpe-b`  | `#50B848` | B      | 71–110             |
| `--dpe-c`  | `#AED136` | C      | 111–180            |
| `--dpe-d`  | `#FFF200` | D      | 181–250            |
| `--dpe-e`  | `#FDB913` | E      | 251–330            |
| `--dpe-f`  | `#F36F21` | F      | 331–420            |
| `--dpe-g`  | `#ED1C24` | G      | ≥ 421              |

**Texte blanc sur A, B, F, G** ; **texte foreground sur C, D, E**. Forme :
étiquette pentagonale en flèche via `clip-path: polygon(0 0, 75% 0, 100% 50%,
75% 100%, 0 100%);`, taille **28×28px**, font Inter (NOT mono), bold 13px.

**Badges complémentaires sur F et G** (à implémenter en PR3) :
- "Loi Climat 2028" — pill destructive-soft + icône AlertTriangle
- "Interdit à la location 2025" — pill destructive-soft

### 1.6 Typographie

| Famille          | Token              | Stack                                    |
|------------------|--------------------|------------------------------------------|
| Sans (UI)        | `--font-sans`      | `Inter, system-ui, sans-serif`           |
| Mono (chiffres)  | `--font-mono`      | `'JetBrains Mono', ui-monospace, monospace` |

OpenType actives sur body : `cv11`, `ss01`. Utility `.tnum`
(`font-variant-numeric: tabular-nums`) sur **tous** les nombres dans
tableaux, KPIs, prix, scores, dates.

Échelle (confirmée par l'écran 1) :

| Rôle                    | Taille | Line-height | Poids | Letter-spacing |
|-------------------------|--------|-------------|-------|----------------|
| Display                 | 48px   | 1.05        | 600   | -0.025em       |
| H1                      | 32px   | 1.1         | 600   | -0.02em        |
| H2                      | 24px   | 1.2         | 600   | -0.015em       |
| H3                      | 18px   | 1.3         | 600   | -0.01em        |
| Body                    | 14px   | 1.5         | 400   | 0              |
| Body sm                 | 13px   | 1.5         | 400   | 0              |
| Caption                 | 12px   | 1.4         | 400   | 0              |
| Mono body               | 14px   | 1.4         | 500   | 0              |
| Eyebrow mono uppercase  | 11px   | 1.4         | 500   | +0.16em        |

### 1.7 Espacement

Base 4px, échelle Tailwind par défaut. Densité Linear/Attio :

| Token   | Px  | Usage                          |
|---------|-----|--------------------------------|
| gap-1   | 4   | Micro                          |
| gap-2   | 8   | Éléments connexes              |
| gap-3   | 12  | Inputs & champs                |
| gap-4   | 16  | Blocs internes                 |
| gap-6   | 24  | Sections proches               |
| gap-8   | 32  | Entre sections                 |
| py-16   | 64  | Padding-y de section           |

### 1.8 Radius

| Classe          | Px  | Usage                       |
|-----------------|-----|-----------------------------|
| `rounded`       | 4   | Badges, pills, tags         |
| `rounded-md`    | 6   | Inputs, boutons             |
| `rounded-lg`    | 8   | Cards, panels               |
| **`rounded-xl`** ⚠️ | 12 | Modals, sheets — **à ajouter** |
| `rounded-full`  | —   | Avatars, dots               |

> ⚠️ Le repo a `--radius: 0.5rem` (8px) et dérive sm/md de calc. Il manque le
> palier 12px pour modales/sheets. À ajouter en PR2.

### 1.9 Élévation (4 niveaux)

| Token         | Valeur                              | Usage                          |
|---------------|-------------------------------------|--------------------------------|
| Niveau 0      | Border 1px `#E7E5E4`, pas d'ombre   | Cards par défaut               |
| `shadow-lvl-1`| `0 1px 2px rgba(0,0,0,0.04)`        | Cards interactives, CTA primary|
| `shadow-lvl-2`| `0 4px 12px rgba(0,0,0,0.06)`       | Dropdowns, popovers            |
| `shadow-lvl-3`| `0 16px 48px rgba(0,0,0,0.12)`      | Modals, sheets                 |

**Aucune ombre colorée. Aucun glow. Pas de gradient sauf le subtil CTA
primaire.**

### 1.10 Layout

- Container max-width : **1280px**, padding horizontal `px-8` (32px).
- Topbar app (signed-in) : **48px** (h-12) sticky, `bg-card/85 backdrop-blur`.
- Topbar rapport (sans sidebar) : **56px** (h-14) sticky.
- **Sidebar app : 232px fixe** à gauche (AppShell — cf §3.1).
- Sheet fiche bien : **640px** à droite, animation translateX 200ms ease-out.

### 1.11 Iconographie

**Lucide outline uniquement** (`lucide-react`, déjà installé). Tailles :

- `w-3 h-3` (12px) — micro icônes inline dans badges
- `w-3.5 h-3.5` (14px) — boutons sm, inputs
- `w-4 h-4` (16px) — boutons md, nav items
- `w-5 h-5` (20px) — sidebar nav, headers

**Pas d'emojis dans l'UI finale** (règle du brief, confirmée handoff).

---

## 2. Primitives shadcn

### 2.1 Déjà implémentées dans le repo

[apps/web/src/components/ui/](apps/web/src/components/ui) — 4 primitives :

- **`<Button />`** — variants `default`/`outline`/`ghost`/`destructive`/`link`,
  tailles `sm`/`default`/`lg`/`icon`. Voir
  [ui/button.tsx](apps/web/src/components/ui/button.tsx).
  > ⚠️ Tailles du repo (`sm h-8 32px`, `default h-9 36px`, `lg h-10 40px`)
  > divergent du handoff (`sm 28px`, `md 36px`, `lg 44px`). À aligner en PR2.
- **`<Badge />`** — variants `default`/`outline`/`success`/`warning`/`danger`/`info`.
  > ⚠️ Les variants soft utilisent `emerald/orange/red/blue-50` Tailwind brut,
  > pas les tokens `--*-soft`. À tokenizer en PR2.
- **`<Card />`** + sous-composants (`CardHeader/Title/Description/Content/Footer`).
- **`<DropdownMenu />`** — wrap Radix complet.

### 2.2 À installer en PR1 (formulaires auth + onboarding)

| Primitive          | Radix base                 | Usage immédiat                           |
|--------------------|----------------------------|------------------------------------------|
| `<Input />`        | natif                      | Email, password, URL, budget…            |
| `<Label />`        | `@radix-ui/react-label`    | Tous les inputs                          |
| `<Textarea />`     | natif                      | Notes longues (PR2+)                     |
| `<Form />` helpers | react-hook-form + zodResolver | Validation auth/onboarding             |
| `<Select />`       | `@radix-ui/react-select`   | Tris, picker DPE, stratégie              |
| `<RadioGroup />`   | `@radix-ui/react-radio-group` | StrategyCard (sémantique radio)       |
| `<Sonner />`       | `sonner` (déjà installé)   | Toasts erreurs auth + feedback           |

### 2.3 À installer plus tard

| Primitive       | Radix base                     | PR cible | Usage                          |
|-----------------|--------------------------------|----------|--------------------------------|
| `<Sheet />`     | `@radix-ui/react-dialog` side  | PR2      | Fiche bien 640px, mobile sheet |
| `<Dialog />`    | `@radix-ui/react-dialog`       | PR2      | Modal upgrade, confirmations   |
| `<Tabs />`      | `@radix-ui/react-tabs`         | PR3      | Onglets rapport, toggle vues   |
| `<Tooltip />`   | `@radix-ui/react-tooltip`      | PR2      | BlurCell, kbd ⌘K, sort icons   |
| `<Avatar />`    | `@radix-ui/react-avatar`       | PR2      | Initiales user (déjà inline)   |
| `<Slider />`    | `@radix-ui/react-slider`       | PR3      | Budget/apport/taux/rdt min     |
| `<Progress />`  | `@radix-ui/react-progress`     | PR3      | AnalysisProgress, usage quotas |
| `<Skeleton />`  | div animé                      | PR3      | Loading states tableau         |
| `<ScrollArea />`| `@radix-ui/react-scroll-area`  | PR2      | Sheet contenu long             |
| `<Command />`   | `cmdk`                         | PR2      | Palette ⌘K topbar              |
| `<Switch />`    | `@radix-ui/react-switch`       | PR6+     | Toggle Mensuel/Annuel billing  |
| `<Separator />` | `@radix-ui/react-separator`    | PR2      | Toolbars, sections             |
| `<Popover />`   | `@radix-ui/react-popover`      | PR3      | FilterPill dropdowns           |
| `<Accordion />` | `@radix-ui/react-accordion`    | PR5      | Timeline runs de veille        |
| `<Checkbox />`  | `@radix-ui/react-checkbox`     | PR3      | Multi-select quartiers         |

**Non nécessaires** pour le scope actuel (à ne pas installer prématurément) :
Calendar/DatePicker, ContextMenu, HoverCard, Carousel, NavigationMenu,
Resizable.

---

## 3. Composants applicatifs ImmoScan

Tous dans [apps/web/src/components/](apps/web/src/components). **Composants
présentationnels purs** — reçoivent par props, aucun fetch, callbacks pour
les actions (cf [docs/design-integration.md](docs/design-integration.md)).

### 3.1 Layout / shell — à créer en PR2

#### `<AppShell />`

Wrapper sidebar + topbar + main. **Le shell de toute l'app authentifiée**.

```ts
type AppShellProps = {
  user: { email: string; name?: string; plan: "free" | "pro" | "pro_plus" };
  currentRoute?: "dashboard" | "analyses" | "veilles" | "pipeline" | "params" | "billing";
  recents?: Array<{ id: string; label: string; href: string }>;
  planUsage?: { used: number; total: number };
  notifs?: { count: number };
  onNavigate?: (route: string) => void;
  onUpgradeClick?: () => void;
  onLogout?: () => void;
  onNewAnalysis?: () => void;
  onSearch?: (q: string) => void;
  children: React.ReactNode;
};
```

Compose `<AppSidebar />` + `<AppTopbar />` + `<main>`.

#### `<AppSidebar />`

Sidebar fixe 232px à gauche. Sections :
- Logo + version chip
- CTA "Nouvelle analyse" violet plein largeur (kbd `N`)
- Nav primary (Dashboard / Mes analyses N / Veilles N+dot / Pipeline N)
- Section "Récents" (4 villes dernières analyses)
- Nav bottom (Paramètres / Plan)
- Widget plan : barre usage + CTA upgrade si Free

#### `<AppTopbar />`

Topbar 48px sticky. Boutons back/forward, command bar ⌘K (palette
`<Command />`), bell avec dot rouge si notifs, avatar initiales + chevron
DropdownMenu (compte / déconnexion).

#### `<AppHeader />` (existant) — à **renommer** ou **réutiliser**

[components/app-header.tsx](apps/web/src/components/app-header.tsx) actuel
implémente une topbar 56px **avec logo + nav horizontale**, utilisée hors
shell (auth, onboarding, /dev/components).

**Décision à acter** (cf §6.1) : faut-il une topbar marketing horizontale
pour les pages publiques + onboarding (`<MarketingHeader />`) en plus de
l'`<AppTopbar />` 48px du shell ? Pour l'instant on garde l'`<AppHeader />`
existant pour les pages signed-out, et `<AppTopbar />` sera créé pour le shell.

#### `<AuthLayout />` — à créer PR1

Coquille centrée pour `/auth/login` et `/auth/signup` : fond `--background`,
logo en haut, card centrée max 480px, footer mentions légales discret.

```ts
type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};
```

#### `<OnboardingLayout />` + `<OnboardingStepper />` — à créer PR1

```ts
type OnboardingLayoutProps = {
  step: 1 | 2;            // PR1 = 2 étapes (cf §6.2)
  totalSteps: number;     // = 2 en PR1, 3 en PR3
  stepLabels: string[];   // ["Stratégie", "Paramètres"]
  onStepClick?: (s: number) => void;
  children: React.ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
};
```

Stepper : 3 dots reliés, dot actif `pulse-accent`, dot done = accent + check.

### 3.2 Primitives métier transversales

#### `<ScoreBadge />` ✅ déjà fait

[components/score-badge.tsx](apps/web/src/components/score-badge.tsx) —
voir §1.4. API conforme handoff.

#### `<DpeBadge />` — à extraire (inline dans ListingCard aujourd'hui)

Actuellement défini en interne dans
[components/listing-card.tsx:34](apps/web/src/components/listing-card.tsx).
À extraire dans `components/dpe-badge.tsx` dès qu'un 2e usage apparaît (PR3
prévoit le tableau).

```ts
type DpeBadgeProps = {
  dpe: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  size?: "sm" | "md";        // 24×24 ou 28×28
  showWarning?: boolean;     // affiche les badges Loi Climat 2028 si F/G
};
```

#### `<ListingCard />` ✅ déjà fait

[components/listing-card.tsx](apps/web/src/components/listing-card.tsx).
Variante carte avec photo silhouette + score + prix + DPE + freemium gate.
Manque la prop `photoUrl` (à ajouter PR2 selon DESIGN_FEEDBACK).

#### `<BlurCell />` — pattern à formaliser PR2

Wrap un enfant avec `filter: blur(5px); user-select: none;` + overlay
cadenas violet centré (`<Lock>` lucide, stroke `--primary`). Tooltip
"Débloque cette opportunité avec Pro — 7 jours offerts."

```ts
type BlurCellProps = {
  children: React.ReactNode;
  tooltip?: string;
  onClick?: () => void;       // ouvre PricingModal
};
```

> Note : la `<ListingCard />` actuelle implémente sa propre logique de blur
> (sur title + prix). À harmoniser avec `<BlurCell />` en PR2 (extraire le
> pattern).

#### `<Sparkline />` — PR3

Mini courbe area SVG, dot final coloré. Utilisée dans les `<KpiCard />` du
dashboard et la KpiBar du rapport.

```ts
type SparklineProps = {
  data: number[];
  color?: string;
  dotColor?: string;
  width?: number;       // 60 par défaut
  height?: number;      // 22 par défaut
};
```

#### `<KpiCard />` — PR3

Title eyebrow mono uppercase, value mono tnum 22-32px, sub optionnel,
delta optionnel (✓/✗ + %), sparkline optionnel. Variantes `accent`/`pos`/
`neg`/`neutral`.

```ts
type KpiCardProps = {
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  delta?: { value: string; tone: "pos" | "neg" | "neutral" };
  sparkData?: number[];
  tone?: "accent" | "pos" | "neg" | "neutral";
};
```

#### `<Thumb />` — PR3

Placeholder SVG paramétrique (14 teintes muted) avec glyph maison/appartement.
Photos réelles `photoUrl` overridable.

```ts
type ThumbProps = {
  tint: number;                 // 0..13
  type: "maison" | "appart";
  size?: number;                // default 40
  photoUrl?: string | null;
};
```

#### `<MiniMap />` — PR3

SVG 200×160 stylisé par ville (`gagny`/`montreuil`/`saint-denis`/`paris-19`/
`marseille`/`lyon-7`/`romainville`/`le-raincy`), avec routes + dots colorés
selon score. Utilisé dans `<AnalysisCard />` de "Mes analyses" et dans la
hero card "Continuer où tu en étais" du dashboard.

### 3.3 Composants à créer ultérieurement (résumé par PR)

| Composant                          | PR cible | Bloc handoff |
|------------------------------------|----------|--------------|
| `FilterPill`, `FilterBar`          | PR3      | Rapport tableau |
| `ListingTable`, `ListingRow`, `Th` | PR3      | Rapport tableau |
| `Pagination`                       | PR3      | Rapport tableau |
| `UrlInput`, `ExampleRow`           | PR3      | Nouvelle analyse |
| `AnalysisProgress`, `DoneScreen`   | PR3      | Progression |
| `SidePanel`, `FicheBien`, `FinancePlanTable`, `NegoLevers` | PR4 | Fiche bien |
| `TopCard`, `Verdict`, `ThesisBlock`| PR4      | Top 10 |
| `HistogramChart`, `DPEDonut`, `QuartierCard`, `RecoCard` | PR4 | Synthèse marché |
| `GagnyMap`/`MapView` SVG inline, `BienMiniCard`, `MapControls` | PR4 | Carte |
| `Greeting`, `AnalysisCard`, `ActivityFeed`, `QuickAction`, `ReferralCard` | PR6+ | Dashboard |
| `Kanban`, `KanbanColumn`, `KanbanCard`, `PipelineList`, `StatusPill` | PR6+ | Pipeline |
| `WatchList`, `WatchCard`, `WatchDetail`, `EvolutionChart`, `TimelineRun` | PR6+ | Veilles |
| `PlanCard`, `UsageQuota`, `DangerZone` | PR6+ | Billing |
| `EmptyState`, `ErrorState`, `QueueStepper`, `StratificationCards` | PR3-PR6 | États système |
| `EmailTemplate`, `EmailTopRow`     | PR6+     | Emails Resend |
| `PublicShareLayout`, `LockedTeaser`| PR6+     | Page partage |
| `MobileShell`, `MobileBottomTabs`, `MobileUpgradeSheet` | PR6+ | Mobile |

Détail dans [docs/DESIGN_OUT_OF_SCOPE.md](docs/DESIGN_OUT_OF_SCOPE.md).

---

## 4. Inventaire complet des pages

Le handoff couvre **22 écrans uniques sur 28 du brief initial**. Les 6
manquants sont les 5 pages marketing publiques (Landing, Pricing détaillé,
Exemple rapport, Comment ça marche, Méthodologie) + la page Paramètres
compte — à demander à Claude Design en itération 2.

### 4.1 Pages présentes dans le handoff

| # | Écran                              | Route prévue                    | Bloc | Scope PR1 |
|---|------------------------------------|----------------------------------|------|-----------|
| 1 | Design System (interne)            | `/dev/design-system` (ou suppr.) | —    | ✅ démo   |
| 2 | Rapport — onglet Tableau           | `/reports/[id]?tab=tableau`     | C    | ❌ PR3    |
| 3 | Fiche bien (Sheet droite 640px)    | `/reports/[id]?listing=[lid]`   | C    | ❌ PR4    |
| 4 | Rapport — onglet Top 10            | `/reports/[id]?tab=top10`       | C    | ❌ PR4    |
| 5 | Rapport — onglet Synthèse          | `/reports/[id]?tab=synthese`    | C    | ❌ PR4    |
| 6 | Rapport — onglet Carte             | `/reports/[id]?tab=carte`       | C    | ❌ PR4    |
| 7 | Onboarding step 1 — Stratégie      | `/onboarding/step-1`            | B    | ✅        |
| 8 | Onboarding step 2 — Paramètres     | `/onboarding/step-2`            | B    | ✅        |
| 9 | Onboarding step 3 — Première analyse | `/onboarding/step-3` ou `/app/nouvelle-analyse` | B/C | ❌ PR3 (cf §6.2) |
|10 | Nouvelle analyse (in-app)          | `/app/nouvelle-analyse`         | C    | ❌ PR3    |
|11 | Progression analyse                | `/app/analyses/[id]/progression`| C    | ❌ PR3    |
|12 | Rapport prêt (success)             | `/app/analyses/[id]/done`       | C    | ❌ PR3    |
|13 | Dashboard                          | `/dashboard`                    | C    | ✅ coquille |
|14 | Mes analyses                       | `/app/analyses`                 | C    | ❌ PR3    |
|15 | Pipeline Kanban                    | `/app/pipeline`                 | C    | ❌ PR6+   |
|16 | Pipeline Liste                     | `/app/pipeline?view=list`       | C    | ❌ PR6+   |
|17 | Veilles                            | `/app/veilles`                  | C    | ❌ PR6+   |
|18 | Plan & facturation                 | `/app/plan`                     | C    | ❌ PR6+   |
|19 | Empty Dashboard (premier launch)   | overlay `/dashboard`            | D    | ✅ coquille |
|20 | Erreur captcha SeLoger             | overlay `/app/nouvelle-analyse` | D    | ❌ PR3    |
|21 | Erreur URL invalide                | overlay                         | D    | ❌ PR3    |
|22 | Erreur 0 résultat                  | overlay                         | D    | ❌ PR3    |
|23 | Erreur >1000 résultats             | overlay                         | D    | ❌ PR3    |
|24 | File d'attente                     | overlay                         | D    | ❌ PR3    |
|25 | Apify down                         | overlay                         | D    | ❌ PR3    |
|26 | Email "Rapport prêt"               | déclenché fin job               | D    | ❌ PR4    |
|27 | Email "Nouvelle opportunité"       | déclenché veille                | D    | ❌ PR6+   |
|28 | Page partage publique              | `/shared/[token]`               | D    | ❌ PR6+   |
|29 | Mobile Dashboard                   | responsive                      | E    | ❌ PR6+   |
|30 | Mobile Nouvelle analyse            | responsive                      | E    | ❌ PR6+   |
|31 | Mobile Rapport (cards empilées)    | responsive                      | E    | ❌ PR6+   |
|32 | Mobile Modal Upgrade (bottom sheet)| overlay mobile                  | E    | ❌ PR6+   |

### 4.2 Pages absentes du handoff (à produire en itération 2 Design)

| Écran                              | Route prévue          | Bloc |
|------------------------------------|-----------------------|------|
| Landing publique                   | `/`                   | A    |
| Pricing détaillé                   | `/pricing`            | A    |
| Exemple de rapport public          | `/exemple/[id]`       | A    |
| Comment ça marche                  | `/comment-ca-marche`  | A    |
| Méthodologie                       | `/methodologie`       | A    |
| Sign up                            | `/auth/signup`        | B    |
| Sign in                            | `/auth/login`         | B    |
| Paramètres compte                  | `/app/parametres`     | C    |
| Détail bien depuis pipeline        | `/app/pipeline/[lid]` | C    |

> ⚠️ Sign up / Sign in (`/auth/login`, `/auth/signup`) sont
> **hors handoff** mais **dans le scope PR1**. Pour ces deux pages on
> construit "à la main" à partir des tokens et primitives du DS — c'est
> assez simple (formulaires centrés sur `<AuthLayout />`) pour ne pas
> nécessiter de handoff dédié. À demander à Claude Design en parallèle
> de PR2 si on veut un visuel plus fini avec illustrations sociales.

---

## 5. Composants ImmoScan déjà codés

État au début de PR1 phase Code (commit `5c93df1`) :

| Composant                                                                  | Statut | Source                                  |
|----------------------------------------------------------------------------|--------|-----------------------------------------|
| `<ScoreBadge />`                                                           | ✅     | [components/score-badge.tsx](apps/web/src/components/score-badge.tsx) |
| `<ListingCard />` + `<DpeBadge />` inline                                  | ✅     | [components/listing-card.tsx](apps/web/src/components/listing-card.tsx) |
| `<AppHeader />` (topbar 56px signed-out / signed-in)                       | ✅     | [components/app-header.tsx](apps/web/src/components/app-header.tsx) |
| `<Button />`, `<Badge />`, `<Card />`, `<DropdownMenu />`                   | ✅     | [components/ui/](apps/web/src/components/ui) |
| Page démo `/dev/components`                                                | ✅     | [routes/dev/components.tsx](apps/web/src/routes/dev/components.tsx) |

Tout le reste est à créer.

---

## 6. Décisions d'intégration à acter

### 6.1 Coexistence AppShell sidebar vs header inline

Le handoff utilise **deux chromes différents** :
- Écrans 6 et 7 (Dashboard / Mes analyses / Pipeline / Veilles / Plan) :
  **AppShell** = sidebar 232px + topbar 48px.
- Écrans 2-3 et 5 (rapports) : **header marketing horizontal** = logo +
  nav inline + badge plan + CTA Pro + avatar (PAS de sidebar).

**Décision proposée** (à valider en PR2) : tout l'app authentifié passe par
l'`<AppShell />`. Les rapports sont une route enfant de l'AppShell — pas
une page plein écran. On garde l'`<AppHeader />` existant uniquement pour
les routes signed-out (landing, auth, onboarding, partage public).

### 6.2 Onboarding : 2 étapes (PR1) ou 3 étapes (PR1+PR3)

Le handoff a **3 étapes** : Stratégie / Paramètres / Première analyse.
TASKS.md PR1 mentionne **2 étapes** uniquement. L'étape 3 (saisie URL +
exemples cliquables) suppose le worker scraping opérationnel — c'est PR3.

**Décision proposée** : PR1 livre `/onboarding/step-1` (Stratégie) et
`/onboarding/step-2` (Paramètres financiers), puis redirige vers
`/dashboard` (état vide). PR3 ajoute `/app/nouvelle-analyse` qui réutilise
l'UI de l'étape 3 handoff, **et** un onboarding-step-3 facultatif pour
les nouveaux users qui n'ont pas encore lancé d'analyse.

### 6.3 Carte = SVG inline ou Leaflet ?

Le handoff fait la carte **en SVG inline pur** (720×540 dessiné à la main,
forêt + rivière + routes + RER + 5 quartiers labelisés). C'est cohérent
avec l'absence de coordonnées BAN réelles en V1.

**Décision proposée** : on garde SVG inline en PR4 (carte par ville,
template paramétrique), Leaflet/MapLibre viendra plus tard en PR6+ quand
on aura BAN + tiles OSM. Les `<MiniMap />` du dashboard suivent le même
principe.

### 6.4 Pricing handoff vs pricing CLAUDE.md

Le handoff affiche **4 plans** : Free / Pro 39€ / Pro+ 79€ / Business 249€.
CLAUDE.md §12 stipule **3 plans** : Free / Pro 49€ / Pro+ 99€ (Business
retiré). Modal upgrade mobile contient aussi un PlanRow Business.

**CLAUDE.md gagne**. À l'intégration des composants Billing (PR6+) :
- Supprimer la PlanCard Business
- Corriger Pro 39 → 49, Pro+ 79 → 99
- Ajouter le pay-per-use (single 9€ / pack 5 39€ / pack 20 119€) absent
  du handoff

### 6.5 DPE F/G — badges Loi Climat

Le handoff signale des badges complémentaires sur DPE F/G : "Loi Climat
2028", "Interdit à la location 2025". Pas dans le composant actuel.

**Décision** : ajouter `showWarning?: boolean` à `<DpeBadge />` quand on
l'extrait en PR3, qui affiche les pills destructive-soft adjacentes si F/G.

### 6.6 Blur freemium — 5px uniforme

Le handoff utilise `filter: blur(5px)` uniforme sur titre, prix, lien, lat/lng.
Le repo actuel utilise `blur-sm` (4px) sur le titre et `blur-md` (12px) sur
le prix. À harmoniser en PR2 sur **5px partout** + `<BlurCell />` extrait.

---

## 7. Tâches design ouvertes (PR2)

Mises à jour depuis [docs/DESIGN_FEEDBACK.md](docs/DESIGN_FEEDBACK.md) à la
lumière du handoff complet :

1. **Ajouter tokens manquants** : `--success-soft`, `--warning-soft`,
   `--destructive-soft`, `--info-soft`, `--tertiary-foreground`, paliers
   radius 12px (`rounded-xl`), borders `--input` à stone-300.
2. **Aligner les tailles Button** : `sm` à 28px, `lg` à 44px (handoff)
   au lieu de 32/40px (repo actuel).
3. **Refactor variants Badge** : remplacer `emerald-50/orange-50/red-50/
   blue-50` par `bg-success-soft / bg-warning-soft / bg-destructive-soft /
   bg-info-soft`.
4. **Extraire `<DpeBadge />`** dans son propre fichier + ajouter
   `showWarning` (Loi Climat).
5. **Extraire `<BlurCell />`** comme pattern réutilisable, harmoniser le
   blur à 5px partout.
6. **Créer `<AppShell />`** : sidebar 232px + topbar 48px + slot main.
   `<AppHeader />` actuel devient `<MarketingHeader />` réservé aux pages
   signed-out (auth, onboarding, partage public).
7. **Créer `<AuthLayout />`** et `<OnboardingLayout />` + `<OnboardingStepper />`
   pour les routes PR1.
8. **Ajouter prop `photoUrl?: string | null` à `<ListingCard />`**.
9. **Fonts via `<link rel="preload">`** dans `index.html` (perf FOIT) — cf
   DESIGN_FEEDBACK.

---

## 8. Voix & ton (rappel)

- **Tutoiement assumé**, cible CSP+ 30-55 ans francophone.
- **Factuel, chiffré, confiant**. Pas de jargon startup, pas d'anglicismes
  ("rapport" pas "report", "analyse" pas "scan", "veille" pas "alert").
- **Microcopy courte et précise**. CTA verbes d'action ("Lancer l'analyse",
  "Débloquer", "Voir l'annonce"). Errors → cause + action ("URL non
  reconnue. Colle une URL SeLoger ou Leboncoin.").
- **Densité d'information assumée** : Bloomberg Terminal / AirDNA / Notion
  finance, pas un dashboard minimaliste Linear. Chaque pixel doit travailler.

Exemples du handoff à réutiliser :
- "Tu cherches un T3 sous-coté à Gagny ?"
- "20 heures d'analyse Excel en 8 minutes."
- "Tu peux fermer cette page, on t'envoie un email à la fin."
- "Débloque cette opportunité avec Pro — 7 jours offerts."
