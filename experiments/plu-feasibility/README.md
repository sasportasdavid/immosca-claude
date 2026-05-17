# Spike PLU — étude de faisabilité

Ce dossier est **isolé du monorepo**. Aucun lien de workspace, aucun import depuis `apps/` ou `packages/`. C'est un terrain d'essai jetable. Si on confirme le go pour PLU+, on intégrera proprement dans le worker et le scoring lors de la PR7.

## Pourquoi ce spike

Avant de promettre une fonctionnalité PLU dans la roadmap, il faut mesurer trois choses qu'on ne peut pas connaître sans essayer :

1. **Couverture réelle du Géoportail de l'Urbanisme (GPU)** sur notre TAM. Le chiffre "80-85%" qu'on lit régulièrement est probablement biaisé vers les grandes métropoles. Sur 100 adresses échantillonnées dans nos villes cibles, combien retournent une zone PLU exploitable ?

2. **Qualité de l'extraction du règlement par Claude Opus**. Un règlement PLU est un document juridique avec sous-zonages, exceptions et renvois. Sur 5 règlements lus manuellement et comparés à l'output Claude, est-on à >90% d'exactitude sur les 8 indicateurs cibles (zone, hauteur, CES, emprise, destinations, pleine terre, prospect, servitudes) ?

3. **Coût Claude réel par bien analysé**. L'estimation initiale était 0,30€/bien. À vérifier sur 5 cas réels avec Opus 4.7.

## Critères de décision

- **Go PR7 PLU Lite si** : couverture GPU >= 70% sur notre échantillon, exactitude Claude >= 90% sur les chiffres clés (hauteur, CES, emprise), coût < 0,50€/bien.
- **No-go si** : couverture < 50%, ou exactitude < 80% sur les chiffres, ou coût > 1€/bien sans levier d'optimisation évident.
- **Zone grise (50-70% / 80-90%)** : on tranche après lecture des cas d'échec. Peut-être un scope plus étroit (seulement grandes métropoles ?).

## Ce qu'on ne mesure PAS dans ce spike

- La génération de scénarios chiffrés (extension, surélévation, division). Hors scope v1 Lite de toute façon.
- L'intégration au scoring composite. À voir post-PR4 quand le scoring de base sera stable.
- L'ergonomie de l'affichage. Claude Design prendra le sujet quand on aura les data.

## Endpoints API utilisés (à vérifier avant de coder)

⚠️ Les APIs publiques évoluent. Vérifier la documentation officielle avant d'exécuter le script. Dernières URLs connues :

| Source | Endpoint | Doc officielle |
|---|---|---|
| BAN (géocodage) | `https://api-adresse.data.gouv.fr/search/` | https://adresse.data.gouv.fr/api-doc/adresse |
| API Carto Cadastre | `https://apicarto.ign.fr/api/cadastre/parcelle` | https://apicarto.ign.fr/api/doc/cadastre |
| GPU (zonage) | via WFS `data.geopf.fr` ou API GPU | https://www.geoportail-urbanisme.gouv.fr/ |
| GPU (règlement PDF) | URL retournée dans les metadata du document | — |

Le script commence par un **health check** qui ping chaque endpoint et lève une erreur explicite si l'un d'eux a changé. Pas de fallback silencieux.

## Comment lancer

```bash
cd experiments/plu-feasibility
pnpm install     # ou npm install, peu importe, ce package est autonome
cp .env.example .env
# remplir ANTHROPIC_API_KEY

# Étape 1 — Health check des APIs
pnpm run check:apis

# Étape 2 — Mesure de couverture sur 100 adresses
pnpm run measure:coverage

# Étape 3 — Test du prompt d'extraction sur 5 règlements
# (à lancer après avoir choisi 5 règlements dans results/coverage.json)
pnpm run extract:reglement -- --pdf-url <url1> --pdf-url <url2> ...

# Étape 4 — Évaluation manuelle (toi, à la main)
# Ouvrir data/manual-eval-template.md et noter les écarts pour les 5 règlements.
```

## Output attendu

À la fin du spike, tu remplis `results/REPORT.md` (template fourni) avec :
- Taux de couverture GPU par ville
- Taux d'exactitude Claude sur les 8 indicateurs
- Coût moyen par bien analysé
- 3 captures de cas d'échec représentatifs
- Recommandation Go / No-go / Scope réduit

Ce rapport sert d'input à la décision d'inclure PR7 PLU dans la roadmap.

## Adresses échantillon

`data/sample-addresses.csv` contient 5 adresses témoins publiques (mairies). À enrichir avec ~95 adresses réelles tirées d'annonces SeLoger via le script `enrich-from-listings.ts` (à coder si besoin, ou simplement copier-coller manuellement depuis un export Apify).

Répartition cible :
- 20 Gagny (cohérence avec données de référence)
- 20 Saint-Denis
- 20 Paris 19e
- 20 Lyon 7e
- 20 Marseille 3e

## Ce qui n'a PAS été modifié

Aucun fichier du monorepo (`apps/`, `packages/`, `supabase-app/`, `supabase-data/`, `docs/`, `CLAUDE.md`, `TASKS.md`) n'a été touché. Ce spike est complètement isolé.
