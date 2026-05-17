# Design Feedback

Journal des points d'attention et arbitrages design soulevés pendant
l'implémentation. À transmettre au PO, qui répercutera vers Claude
Design ou tranchera en interne.

Format d'entrée : date · contexte · point · recommandation.

---

## 2026-05-15 — Fonts via `@import` vs `<link preload>`

**Contexte** : PR1 Phase Design. Chargement des deux familles
typographiques (Inter pour l'UI, JetBrains Mono pour les chiffres et
les libellés mono).

**Point** : les fonts sont actuellement importées via
`@import url("https://fonts.googleapis.com/...")` au sommet de
`apps/web/src/index.css`. Ce pattern enchaîne deux round-trips
(téléchargement du CSS de Google Fonts, puis téléchargement des fichiers
de fonts) avant que le premier paint puisse s'effectuer avec la bonne
typographie, ce qui produit un FOIT (Flash Of Invisible Text) visible
sur connexion lente. Le pattern recommandé par Vite et par la communauté
performance est `<link rel="preload" as="font">` posé dans
`apps/web/index.html`, qui permet au navigateur de pré-charger les
fichiers en parallèle du HTML et du JS.

Le contre-argument qui a motivé le choix actuel : `index.html` n'est
pas dans le périmètre du mode Design (`components/`, `styles/`,
`index.css`, `tailwind.config.ts`). Le toucher pour ajouter des `<link>`
fonts aurait outrepassé la discipline Design / Code.

**Recommandation** : corriger en PR2 quand `index.html` sera de toute
façon ouvert pour d'autres raisons légitimes (meta tags SEO, favicon,
Open Graph). Le commit sera typé `feat:` ou `chore:` à ce moment-là,
pas `design:`. Ne pas faire la correction maintenant pour respecter le
scope PR1.

---

## 2026-05-15 — `<AppShell>` (sidebar) manquante

**Contexte** : PR1 Phase Design. L'Écran 6 (Dashboard) du handoff
Claude Design montre une AppShell complète : sidebar fixe 232px à
gauche (logo + CTA "Nouvelle analyse" + nav + recents + plan widget)
+ topbar 48px en haut. La PR1 ne demande explicitement que
l'`<AppHeader>` (= topbar uniquement).

**Point** : le composant `<AppHeader>` actuel rend bien la topbar
seule, sans sidebar. Cela suffit pour les pages où la sidebar n'a pas
de sens (auth, onboarding, page partagée publique, /dev/components).
Mais dès la PR2 et la page `/dashboard` réelle, il faudra une
`<AppShell>` qui orchestre sidebar + topbar et reçoit le contenu
principal en `children`.

**Recommandation** :
- Créer `components/app-shell.tsx` en PR2 avec interface :
  ```tsx
  type AppShellProps = {
    user: { email: string; plan: "free" | "pro" | "pro_plus" };
    activeRoute?: "dashboard" | "analyses" | "pipeline" | "veilles";
    onLogout?: () => void;
    onUpgradeClick?: () => void;
    onNewAnalysis?: () => void;
    children: React.ReactNode;
  };
  ```
- L'`<AppHeader>` actuel devient soit un sous-composant interne
  d'`<AppShell>`, soit un export indépendant pour les routes hors
  shell (auth, onboarding).
- La sidebar sera un nouveau composant `<AppSidebar>` parallèle à
  l'AppHeader, suivant le même contrat (props-only, aucun fetch).

Le pattern à reproduire fidèlement est dans l'Écran 6 du handoff
Claude Design.

---

## 2026-05-15 — Photo URL manquante dans `ListingCardProps`

**Contexte** : PR1 Phase Design, composant `<ListingCard />`.

**Point** : le composant utilise actuellement un placeholder SVG
silhouette pour la photo du bien. En PR2-PR3, quand les vrais
listings arriveront de Supabase (champ `photos_urls: text[]` dans
la table `listings`), il faudra ajouter une prop `photoUrl?: string`
à `ListingCardProps` et faire fallback sur la silhouette si non
fournie. La silhouette est intentionnellement conservée comme
fallback par défaut, parce qu'elle donne le rythme visuel même
quand l'annonce n'a pas de photo (cas réel sur certaines annonces
LBC anonymisées).

**Recommandation** : ajouter la prop en PR2 quand on connectera le
premier `ListingCardContainer` dans `apps/web/src/features/analysis/`.
La signature devra ressembler à :

```tsx
type ListingCardProps = {
  // ... props existants
  photoUrl?: string | null;
};
```

Le rendu interne fait `<img src={photoUrl} />` si défini, sinon
garde la silhouette SVG actuelle.

---

## 2026-05-17 — Ports locaux Supabase identiques entre `supabase-app` et `supabase-data`

**Contexte** : LOT H bis, Phase Code PR1. Restructure monorepo
Supabase en Option A (nesting 2 niveaux : `supabase-app/supabase/`
et `supabase-data/supabase/`).

**Point** : les deux `config.toml` ont les mêmes ports locaux par
défaut (API 54321, DB 54322, shadow_port 54320, Studio 54323, Inbucket
54324, etc.). Si un jour on lance `supabase start` sur les deux
projets en parallèle pour test local, collision garantie sur tous
les ports.

**Recommandation** : pour l'instant on travaille exclusivement contre
Supabase Cloud eu-west-3, pas de mode local. Si besoin d'un mode
local en PR ultérieure, décaler tous les ports de `supabase-data` de
+10 (54331/54332/54330/54333/54334/...).
