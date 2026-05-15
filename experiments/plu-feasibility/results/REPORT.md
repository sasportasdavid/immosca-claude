# Spike PLU — Rapport final

> À remplir après exécution complète : `check:apis`, `measure:coverage`, 5× `extract:reglement`, évaluation manuelle.
>
> Ce rapport est l'input à la décision d'inclure PR7 PLU dans la roadmap ImmoScan.

---

## TL;DR

- **Verdict** : Go / Scope réduit / No-go
- **Couverture pipeline complète** : __ %
- **Exactitude Claude sur indicateurs critiques** : __ %
- **Coût moyen par bien analysé** : __ €

(Une phrase de synthèse écrite à la main : pourquoi ce verdict, ce qui m'a surpris.)

---

## 1. Couverture des APIs (mesure quantitative)

| Étape | Hit | Taux |
|---|---|---|
| BAN géocodage | __ / 100 | __ % |
| Cadastre (parcelle) | __ / 100 | __ % |
| GPU (zone PLU) | __ / 100 | __ % |
| Règlement PDF téléchargé | __ / 100 | __ % |
| **Pipeline complet OK** | __ / 100 | __ % |

### Par ville

| Ville | Hit GPU | Taux |
|---|---|---|
| Gagny | __ / 20 | __ % |
| Saint-Denis | __ / 20 | __ % |
| Paris 19e | __ / 20 | __ % |
| Lyon 7e | __ / 20 | __ % |
| Marseille 3e | __ / 20 | __ % |

**Observations** :
- (Y a-t-il une ville qui sort du lot, en bien ou en mal ?)
- (Latence acceptable ? Si > 10s en moyenne pour le pipeline complet sur un bien, c'est trop pour une exécution synchrone — il faut intégrer en mode batch async.)

---

## 2. Qualité de l'extraction Claude (mesure qualitative)

(Synthèse des 5 cas évalués manuellement dans `data/manual-eval-template.md`.)

| Indicateur | Exactitude (% des 5 cas) |
|---|---|
| zone_libelle | __ % |
| **hauteur_max_m** | __ % |
| **ces** | __ % |
| **emprise_au_sol_max_pct** | __ % |
| destinations_autorisees | __ % |
| servitudes_notables | __ % |
| potentiel (qualitatif) | __ % |

**Patterns d'erreur identifiés** :

1.
2.
3.

**Robustesse face aux cas tordus** :
- Sous-zonage (UA1 vs UA2) : géré / raté
- Renvoi à des annexes : géré / raté
- Règlement très long (>100 pages) : géré / raté

---

## 3. Coût et performance

- Coût moyen par extraction Claude (Opus 4.7) : __ €
- Latence moyenne extraction : __ s
- Tokens input moyens : __
- Tokens output moyens : __

**Projection** :
- Sur une analyse type avec Top 50 biens scorés : __ € de coût Claude pour PLU
- Soit __ % du chiffre d'affaires marginal d'un abonnement Pro+ (79 €)

**Leviers d'optimisation** identifiés :
- Cache du règlement par commune (un règlement servirait pour tous les biens de la commune pendant 6 mois) : économie estimée __ %
- Passage en Sonnet sur les communes "simples" : économie estimée __ %, mais à valider que la qualité tient

---

## 4. Risques découverts pendant le spike

(Ce qu'on ne savait pas avant et qui change quelque chose.)

1.
2.
3.

---

## 5. Recommandation

### Si Go PR7 PLU Lite

- Scope : zone + 5-8 indicateurs lisibles + flag potentiel qualitatif (pas de chiffrage scénario)
- Estimation effort : 2-3 semaines
- Pricing : inclus dans Pro+ existant à 79€ (pas de nouvelle offre Promoteur pour l'instant)
- Données nouvelles à intégrer dans `immoscan-data` : `plu_zones`, `plu_reglements_cache`
- Tables à créer dans `immoscan-app` : `listing_plu_analysis`
- Endpoints API à utiliser : (lister ceux confirmés OK pendant le check)

### Si Scope réduit

- Limiter à quelles villes / régions ?
- Quels indicateurs garder, lesquels couper ?

### Si No-go

- Quel signal devrait nous faire reconsidérer dans 6 mois ?
- Y a-t-il un sous-problème PLU plus simple à attaquer (ex : juste signaler la zone, sans extraction de règlement) ?

---

## Annexes

- Résultats détaillés couverture : `results/coverage.json`
- Résumé couverture auto-généré : `results/coverage-summary.md`
- Extractions Claude : `results/extractions/`
- Évaluations manuelles : `data/manual-eval-template.md` (rempli)
