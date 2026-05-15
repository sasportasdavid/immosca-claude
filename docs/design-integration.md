# Discipline Design / Code

Tu joues deux rôles distincts dans le même repo : Design (composants
présentationnels) et Code (logique applicative). Ce document décrit
les règles pratiques.

## Pourquoi cette séparation

La séparation existe pour trois raisons :
1. **Testabilité** : un composant qui reçoit ses données par props est
   testable en isolation, sans mocker Supabase ni le router.
2. **Réutilisabilité** : un composant Design peut servir dans plusieurs
   features (ex: `<ListingCard>` dans le tableau ET dans le pipeline).
3. **Cohérence du design system** : les tokens CSS et les variantes
   restent centralisés, pas dispersés dans des features.

## Partage des dossiers

| Chemin | Mode | Règle |
|---|---|---|
| `apps/web/src/components/ui/` | Design | Primitives shadcn. Ne pas réinventer. |
| `apps/web/src/components/` | Design | Composants UI métier. Reçoivent uniquement via props. |
| `apps/web/src/styles/`, `index.css` | Design | Tokens CSS vars. |
| `apps/web/tailwind.config.ts` | Design | Mapping vers tokens. |
| `apps/web/src/features/` | Code | Containers data-aware. |
| `apps/web/src/lib/` | Code | Clients Supabase, helpers, instrumentation. |
| `apps/web/src/routes/` | Code | TanStack Router. |
| `apps/web/src/hooks/` | Code | Logique partagée. |

## Règles dures

### Règle 1 — Composants présentationnels par props

Un composant dans `components/` ne **jamais** :
- Importer `@supabase/supabase-js`
- Lire `import.meta.env`
- Faire un fetch
- Connaître l'existence du plan utilisateur

Il reçoit tout via props et appelle des callbacks pour les actions.

**Exemple bon** :

```tsx
// components/listing-card.tsx — mode Design
type ListingCardProps = {
  title: string;
  prix: number | null;     // null = masqué freemium
  score: number;
  isMasked: boolean;
  onUpgradeClick?: () => void;
};
```

**Exemple mauvais** :

```tsx
// ❌ Composant Design qui sait fetcher
function ListingCard() {
  const { data } = useQuery(/* ... */);  // INTERDIT en mode Design
}
```

### Règle 2 — Containers feature data-aware

Dans `features/`, on fait le pont. Un container :
- Lit les données (hooks React Query, Supabase)
- Gère les mutations et l'état local
- Passe les props au composant Design
- Branche les callbacks

**Exemple** :

```tsx
// features/analysis/listing-card-container.tsx — mode Code
import { ListingCard } from "@/components/listing-card";
import { useListing } from "@/hooks/use-listing";
import { useNavigate } from "@tanstack/react-router";

export function ListingCardContainer({ listingId }: { listingId: string }) {
  const { data: listing } = useListing(listingId);
  const navigate = useNavigate();
  if (!listing) return null;
  return (
    <ListingCard
      title={listing.title ?? "—"}
      prix={listing.prix}
      score={listing.score_total ?? 0}
      isMasked={listing.is_masked}
      onUpgradeClick={() => navigate({ to: "/billing" })}
    />
  );
}
```

### Règle 3 — Design tokens uniquement

Toute couleur, espace, rayon utilisé par le mode Code passe par les CSS
vars définies dans `index.css`. Jamais de Tailwind hardcoded comme
`bg-blue-500` ou `text-red-600`.

| Token | Usage |
|---|---|
| `bg-background`, `text-foreground` | Fonds et textes globaux |
| `bg-card`, `text-card-foreground` | Surface cards |
| `bg-primary`, `text-primary-foreground` | CTA principal |
| `bg-muted`, `text-muted-foreground` | Texte secondaire |
| `bg-destructive` | Erreurs, suppressions |
| `bg-score-excellent` (≥75) | Score vert |
| `bg-score-good` (50-74) | Score orange |
| `bg-score-poor` (<50) | Score rouge |
| `border-border`, `border-input` | Bordures cohérentes |

Si tu as besoin d'une couleur sémantique manquante en mode Code, tu
passes en mode Design pour l'ajouter dans `index.css` d'abord, puis tu
l'utilises. Pas l'inverse.

### Règle 4 — Le scoring détermine la couleur, pas le frontend

Le composant `<ScoreBadge score={92} />` (Design) mappe le nombre vers
`bg-score-excellent / good / poor` selon les seuils 75 et 50. Le mode
Code ne décide jamais d'une couleur, il passe juste le nombre.

### Règle 5 — Le freemium gate est UI, le masquage est SQL

- **Le masquage** : se fait dans la vue `listings_freemium_view`. Le
  mode Code reçoit déjà du `null` pour les champs masqués et
  `is_masked: true`.
- **L'UI du gate** (CTA upgrade, blur visuel, lock icon, modal pricing) :
  mode Design la dessine, mode Code branche le clic vers `/billing`.

Le mode Code ne fait jamais un `if (plan === 'free') hidePrice()`. Si tu
te retrouves à faire ça, c'est que la vue SQL n'a pas fait son job ou
que tu lis la mauvaise source.

## Discipline de commits

- Commit `design:` quand toutes les modifs touchent strictement les
  dossiers Design (`components/`, `components/ui/`, `styles/`,
  `index.css`, `tailwind.config.ts`).
- Commit `feat:`, `fix:`, `refactor:`, etc. pour les modifs Code.
- **Pas de commit mixte**. Si une feature touche les deux, fais deux
  commits séparés. Ça permet de retrouver dans Git ce qui a changé
  côté UI sans dépouiller les modifs métier.

## Conventions de nommage

- Composants Design : kebab-case file, PascalCase export
  (`listing-card.tsx` → `<ListingCard />`)
- Containers feature : suffixe `-container.tsx`
  (`listing-card-container.tsx`)
- Hooks : préfixe `use-` (`use-analysis.ts`)
- Props : explicites, jamais `data: any`. Toujours typé.

## Workflow pour une nouvelle feature

1. **Pense d'abord aux composants Design** qu'il te faut. Si tu peux
   les concevoir sans connaître la source des données, c'est qu'ils
   sont bien isolés.
2. **Écris les composants Design en premier**, avec des props bidon
   hardcodées pour visualiser. Commit `design:`.
3. **Écris le hook et le container** qui branchent les vraies données.
   Commit `feat:`.
4. **Ajoute la route** qui consomme le container. Commit `feat:`.

## Si quelque chose te manque

Si en mode Code tu butes sur un composant manquant, ne le crée pas
dans `features/` pour aller vite. Passe en mode Design, ajoute le
composant dans `components/`, puis reviens en mode Code l'utiliser.
La règle "pas de composant local dans features/" évite la dette
technique invisible.
