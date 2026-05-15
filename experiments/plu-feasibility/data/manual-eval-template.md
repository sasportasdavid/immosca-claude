# Grille d'évaluation manuelle — extractions Claude PLU

Pour chacun des 5 règlements testés, ouvre le PDF original côte à côte avec le JSON sorti par Claude. Note les écarts ligne par ligne. C'est l'étape qui détermine si on commit la fonctionnalité ou pas.

## Ce qu'on cherche à valider

Pour chaque indicateur, deux questions :
1. **L'info est-elle correcte ?** (oui / partiel / faux / non applicable)
2. **Si Claude a mis null, est-ce que c'était bien parce que l'info manque dans le règlement ?** Ou est-ce qu'il l'a ratée ?

L'exactitude doit être > 90% sur les 4 chiffres critiques (zone, hauteur, CES, emprise) pour qu'on puisse builder la feature avec confiance.

---

## Cas #1

- **Commune** :
- **Zone** :
- **PDF source** :
- **JSON Claude** : `results/extractions/<timestamp>.json`

| Indicateur | Valeur Claude | Valeur vraie (lue dans le PDF) | Verdict | Notes |
|---|---|---|---|---|
| zone_libelle | | | ✅ / ⚠️ / ❌ | |
| zone_type | | | ✅ / ⚠️ / ❌ | |
| **hauteur_max_m** | | | ✅ / ⚠️ / ❌ | |
| hauteur_max_reference | | | ✅ / ⚠️ / ❌ | |
| **ces** | | | ✅ / ⚠️ / ❌ | |
| **emprise_au_sol_max_pct** | | | ✅ / ⚠️ / ❌ | |
| coefficient_pleine_terre_pct | | | ✅ / ⚠️ / ❌ | |
| prospect_voisin_m | | | ✅ / ⚠️ / ❌ | |
| destinations_autorisees | | | ✅ / ⚠️ / ❌ | |
| servitudes_notables | | | ✅ / ⚠️ / ❌ | |
| potentiel.extension | | | ✅ / ⚠️ / ❌ | |
| potentiel.surelevation | | | ✅ / ⚠️ / ❌ | |
| potentiel.division | | | ✅ / ⚠️ / ❌ | |
| potentiel.demolition_reconstruction | | | ✅ / ⚠️ / ❌ | |
| confidence | | (subjectif : tu aurais mis quoi ?) | — | |

**Coût de l'extraction** : __ €
**Latence** : __ s

**Observations qualitatives** :
- Le raisonnement dans `notes` est-il pertinent ?
- Y a-t-il un type d'erreur récurrent (hauteur à l'égout vs faîtage, sous-zonage raté, etc.) ?

---

## Cas #2

(idem)

---

## Cas #3

(idem)

---

## Cas #4

(idem)

---

## Cas #5

(idem)

---

## Synthèse à reporter dans `results/REPORT.md`

| Indicateur | Cas exacts | Cas partiels | Cas faux | Taux exactitude |
|---|---|---|---|---|
| zone_libelle | / 5 | / 5 | / 5 | % |
| hauteur_max_m | / 5 | / 5 | / 5 | % |
| ces | / 5 | / 5 | / 5 | % |
| emprise_au_sol_max_pct | / 5 | / 5 | / 5 | % |
| Autres (moyenne) | / 5 | / 5 | / 5 | % |

**Coût moyen par extraction** : __ €
**Latence moyenne** : __ s

**Verdict global** :
- [ ] Go PR7 PLU Lite (>= 90% sur les 4 critiques, coût < 0,50 €)
- [ ] Scope réduit (zone grise, à discuter)
- [ ] No-go (< 80% sur critiques, ou coût > 1 € sans levier)

**Patterns d'erreur identifiés** (et comment les contourner) :

1.
2.
3.
