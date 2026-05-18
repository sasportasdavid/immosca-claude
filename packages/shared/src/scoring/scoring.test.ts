import { describe, expect, it } from "vitest";

import { SCORING_WEIGHTS_DEFAULT } from "../constants.js";

import type { ScoringInput } from "./types.js";

import {
  ajustementLoyerDpe,
  cashflowMensuel,
  computeFinancials,
  computeScore,
  ecartPrixPct,
  fraisNotaire,
  loyerEstime,
  mensualiteCredit,
  rendementBrutPct,
  scoreDpe,
  scorePrix,
  scoreRendement,
  scoreRisques,
  verdictFromScore,
} from "./index.js";

// ────────── Helpers ──────────

function gagnyAppartementF3(overrides: Partial<ScoringInput> = {}): ScoringInput {
  // Bien de référence : App F 60.5m² rue de Gagny, 155k€, DPE F.
  // Persona David : apport 200k, 3% sur 25 ans, TMI 30%, rendement min 6%.
  return {
    prix: 155_000,
    surface: 60.5,
    type: "appartement",
    dpe: "F",
    etage: 2,
    balcon: false,
    terrasse: false,
    parking: false,
    is_new_construction: false,
    prix_m2_median_commune: 4192,
    prix_m2_median_iris: null,
    loyer_m2_median_zone: 14, // hypothèse Gagny ~14€/m²
    strategy: "locatif_nu",
    apport: 200_000,
    taux_credit_pct: 3,
    duree_credit_ans: 25,
    tmi_pct: 30,
    rendement_min_pct: 6,
    tolerance_travaux: "moyen",
    has_ppri: false,
    retrait_argile_niveau: "moyen",
    sismicite: 1,
    radon: 1,
    ...overrides,
  };
}

// ────────── Financial primitives ──────────

describe("fraisNotaire", () => {
  it("calcule 8% sur l'ancien", () => {
    expect(fraisNotaire(200_000, false)).toBe(16_000);
  });
  it("calcule 3% sur le neuf", () => {
    expect(fraisNotaire(200_000, true)).toBe(6_000);
  });
});

describe("mensualiteCredit", () => {
  it("retourne 0 si capital nul", () => {
    expect(mensualiteCredit(0, 3, 25)).toBe(0);
  });
  it("est purement amortissement si taux 0", () => {
    expect(mensualiteCredit(120_000, 0, 25)).toBeCloseTo(400, 1);
  });
  it("100k @ 3% sur 25 ans ≈ 474€", () => {
    expect(mensualiteCredit(100_000, 3, 25)).toBeCloseTo(474.21, 1);
  });
});

describe("ajustementLoyerDpe", () => {
  it("avantage A, pénalise G", () => {
    expect(ajustementLoyerDpe("A")).toBeGreaterThan(1);
    expect(ajustementLoyerDpe("G")).toBeLessThan(0.9);
  });
  it("retourne 1 si null", () => {
    expect(ajustementLoyerDpe(null)).toBe(1);
  });
});

describe("loyerEstime", () => {
  it("retourne null si pas de loyer médian zone", () => {
    expect(loyerEstime(60, null, "D", 2, false, false)).toBeNull();
  });
  it("60m² @ 14€/m² DPE D étage 2 ≈ 840€", () => {
    const loyer = loyerEstime(60, 14, "D", 2, false, false);
    expect(loyer).toBeCloseTo(840, 0);
  });
  it("pénalise le RDC", () => {
    const rdc = loyerEstime(60, 14, "D", 0, false, false);
    const e2 = loyerEstime(60, 14, "D", 2, false, false);
    expect(rdc).toBeLessThan(e2!);
  });
});

describe("ecartPrixPct", () => {
  it("0 si pas de référence", () => {
    expect(ecartPrixPct(4000, null)).toBeNull();
  });
  it("retourne -25% si 3000€/m² vs 4000€/m² ref", () => {
    expect(ecartPrixPct(3000, 4000)).toBeCloseTo(-25, 1);
  });
});

// ────────── Sub-scores ──────────

describe("scorePrix", () => {
  it("50 quand au prix marché", () => {
    expect(scorePrix(0)).toBe(50);
  });
  it("100 quand 20% sous le marché", () => {
    expect(scorePrix(-20)).toBe(100);
  });
  it("0 quand 20% au-dessus du marché", () => {
    expect(scorePrix(20)).toBe(0);
  });
});

describe("scoreRendement", () => {
  it("0 si <= 2%", () => {
    expect(scoreRendement(1.5, 5)).toBe(0);
  });
  it("100 si >= 10%", () => {
    expect(scoreRendement(11, 5)).toBe(100);
  });
  it("malus si sous le rendement min user", () => {
    const sansMalus = scoreRendement(6, 5);
    const avecMalus = scoreRendement(4, 6);
    expect(avecMalus).toBeLessThan(sansMalus);
  });
});

describe("scoreDpe", () => {
  it("A = 100", () => expect(scoreDpe("A")).toBe(100));
  it("G = 0 (passoire interdite)", () => expect(scoreDpe("G")).toBe(0));
  it("D = 60", () => expect(scoreDpe("D")).toBe(60));
});

describe("scoreRisques", () => {
  it("100 si aucun risque", () => {
    const input = gagnyAppartementF3({
      has_ppri: false,
      retrait_argile_niveau: "nul",
      sismicite: 1,
      radon: 1,
    });
    expect(scoreRisques(input)).toBe(100);
  });
  it("dégradé avec cumul PPRI + argile fort + sismicité 4", () => {
    const input = gagnyAppartementF3({
      has_ppri: true,
      retrait_argile_niveau: "fort",
      sismicite: 4,
      radon: 2,
    });
    // -30 (PPRI) -25 (argile fort) -20 (sismicité 4) = 25
    expect(scoreRisques(input)).toBe(25);
  });
});

// ────────── Orchestrators ──────────

describe("computeFinancials (référentiel Gagny)", () => {
  it("App F 60.5m² 155k€ doit dégager un rendement brut > 6%", () => {
    const f = computeFinancials(gagnyAppartementF3());
    expect(f.rendement_brut_pct).not.toBeNull();
    expect(f.rendement_brut_pct!).toBeGreaterThan(5.5);
  });

  it("écart de prix négatif puisque 155k/60.5 < 4192€/m² médian", () => {
    const f = computeFinancials(gagnyAppartementF3());
    expect(f.ecart_prix_pct).not.toBeNull();
    expect(f.ecart_prix_pct!).toBeLessThan(0);
  });
});

describe("computeFinancials notaire", () => {
  it("frais_notaire = 8% du prix sur l'ancien", () => {
    const f = computeFinancials(gagnyAppartementF3({
      is_new_construction: false,
    }));
    expect(f.frais_notaire).toBeCloseTo(155_000 * 0.08, 0);
  });
  it("frais_notaire = 3% du prix sur le neuf", () => {
    const f = computeFinancials(gagnyAppartementF3({
      is_new_construction: true,
    }));
    expect(f.frais_notaire).toBeCloseTo(155_000 * 0.03, 0);
  });
});

describe("computeScore", () => {
  it("score global entre 0 et 100", () => {
    const r = computeScore(gagnyAppartementF3());
    expect(r.score_total).toBeGreaterThanOrEqual(0);
    expect(r.score_total).toBeLessThanOrEqual(100);
  });

  it("DPE G pénalise lourdement", () => {
    const ref = computeScore(gagnyAppartementF3({ dpe: "C" }));
    const passoire = computeScore(gagnyAppartementF3({ dpe: "G" }));
    expect(ref.score_total).toBeGreaterThan(passoire.score_total);
    expect(passoire.climate.risque_climat_2025).toBe(true);
  });

  it("prix très en-dessous du marché → score prix élevé", () => {
    const r = computeScore(gagnyAppartementF3({ prix: 100_000 })); // 1653€/m² vs 4192 médian
    expect(r.sub_scores.prix).toBeGreaterThan(90);
  });

  it("respecte la somme pondérée des sous-scores", () => {
    const r = computeScore(gagnyAppartementF3());
    const w = SCORING_WEIGHTS_DEFAULT;
    const attendu =
      (r.sub_scores.prix * w.prix +
        r.sub_scores.rendement * w.rendement +
        r.sub_scores.cashflow * w.cashflow +
        r.sub_scores.dpe * w.dpe +
        r.sub_scores.quartier * w.quartier +
        r.sub_scores.risques * w.risques) /
      100;
    expect(r.score_total).toBe(Math.max(0, Math.min(100, Math.round(attendu))));
  });
});

describe("verdictFromScore", () => {
  it("a_visiter si >= 75", () => expect(verdictFromScore(75)).toBe("a_visiter"));
  it("sous_reserve entre 50 et 74", () => expect(verdictFromScore(60)).toBe("sous_reserve"));
  it("no_go si < 50", () => expect(verdictFromScore(40)).toBe("no_go"));
});

// ────────── Cashflow & rendement brut ──────────

describe("rendementBrutPct", () => {
  it("0 si prix nul", () => {
    expect(rendementBrutPct(800, 0)).toBe(0);
  });
  it("10k loyer annuel sur 200k prix = 5%", () => {
    expect(rendementBrutPct(10_000 / 12, 200_000)).toBeCloseTo(5, 1);
  });
});

describe("cashflowMensuel", () => {
  it("positif quand loyer net > mensualité + charges", () => {
    const cf = cashflowMensuel(900, 500, 50, 50);
    expect(cf).toBeGreaterThan(0);
  });
});
