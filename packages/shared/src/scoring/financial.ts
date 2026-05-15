// Calculs financiers purs.
// Aucune logique métier ImmoScan ici, juste les formules.

import { NOTAIRE_FEES_ANCIEN_PCT, NOTAIRE_FEES_NEUF_PCT } from "../constants.js";
import type { DpeClass } from "../schemas/listing.js";
import type { TravauxTolerance } from "../schemas/user.js";

/**
 * Frais de notaire (8% ancien, 3% neuf).
 */
export function fraisNotaire(prix: number, isNeuf: boolean): number {
  const pct = isNeuf ? NOTAIRE_FEES_NEUF_PCT : NOTAIRE_FEES_ANCIEN_PCT;
  return prix * pct;
}

/**
 * Mensualité de crédit (formule classique amortissement).
 * tauxAnnuelPct : ex. 3.0 pour 3%
 */
export function mensualiteCredit(
  capital: number,
  tauxAnnuelPct: number,
  dureeAns: number,
): number {
  if (capital <= 0) return 0;
  if (tauxAnnuelPct === 0) return capital / (dureeAns * 12);
  const tauxMensuel = tauxAnnuelPct / 100 / 12;
  const nbMensualites = dureeAns * 12;
  return (
    (capital * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -nbMensualites))
  );
}

/**
 * Coût total d'acquisition = prix + notaire + travaux estimés selon tolérance.
 * Estimation travaux très grossière, à raffiner avec un input user.
 */
export function coutTotalAcquisition(
  prix: number,
  surface: number,
  isNeuf: boolean,
  toleranceTravaux: TravauxTolerance,
): number {
  const notaire = fraisNotaire(prix, isNeuf);
  const travauxParM2 = {
    aucun: 0,
    leger: 200,
    moyen: 500,
    lourd: 1200,
  };
  const travaux = surface * travauxParM2[toleranceTravaux];
  return prix + notaire + travaux;
}

/**
 * Ajustement du loyer estimé selon DPE (impact loi Climat + appétence locataires).
 */
export function ajustementLoyerDpe(dpe: DpeClass | null): number {
  if (!dpe) return 1;
  const ajustements: Record<DpeClass, number> = {
    A: 1.08,
    B: 1.05,
    C: 1.02,
    D: 1.0,
    E: 0.97,
    F: 0.9, // risque interdiction 2028
    G: 0.8, // déjà interdit en 2025
  };
  return ajustements[dpe];
}

/**
 * Ajustement loyer selon étage et présence extérieur.
 */
export function ajustementLoyerConfort(
  etage: number | null,
  balcon: boolean,
  terrasse: boolean,
): number {
  let coef = 1;
  if (etage !== null) {
    if (etage === 0) coef *= 0.93; // RDC pénalisé
    if (etage >= 5) coef *= 1.03; // étages élevés (vue)
  }
  if (terrasse) coef *= 1.04;
  else if (balcon) coef *= 1.02;
  return coef;
}

/**
 * Loyer mensuel estimé.
 * Formule : surface × loyer/m² médian de la zone × ajustements.
 */
export function loyerEstime(
  surface: number,
  loyerM2MedianZone: number | null,
  dpe: DpeClass | null,
  etage: number | null,
  balcon: boolean,
  terrasse: boolean,
): number | null {
  if (!loyerM2MedianZone || loyerM2MedianZone <= 0) return null;
  const ajustDpe = ajustementLoyerDpe(dpe);
  const ajustConfort = ajustementLoyerConfort(etage, balcon, terrasse);
  return surface * loyerM2MedianZone * ajustDpe * ajustConfort;
}

/**
 * Rendement brut : (loyer annuel / prix d'achat) × 100.
 * Définition française standard : loyer annuel / prix d'achat.
 * N'inclut PAS notaire/travaux qui pèsent sur le rendement net.
 */
export function rendementBrutPct(
  loyerMensuel: number,
  prixAchat: number,
): number {
  if (prixAchat <= 0) return 0;
  return ((loyerMensuel * 12) / prixAchat) * 100;
}

/**
 * Rendement net : on déduit ~20% pour charges, taxe foncière, vacance.
 * Approximation, à raffiner avec les charges réelles si dispo.
 */
export function rendementNetPct(
  loyerMensuel: number,
  coutTotal: number,
  chargesAnnuelles: number,
  taxeFonciere: number,
  tauxVacancePct = 8,
): number {
  if (coutTotal <= 0) return 0;
  const revenuLocatifAnnuel = loyerMensuel * 12 * (1 - tauxVacancePct / 100);
  const revenuNet = revenuLocatifAnnuel - chargesAnnuelles - taxeFonciere;
  return (revenuNet / coutTotal) * 100;
}

/**
 * Rendement net-net : impôt selon TMI (régime foncier) ou abattement 50% (micro-BIC LMNP).
 */
export function rendementNetNetPct(
  loyerMensuel: number,
  coutTotal: number,
  chargesAnnuelles: number,
  taxeFonciere: number,
  tmiPct: number,
  isLmnp: boolean,
  tauxVacancePct = 8,
): number {
  if (coutTotal <= 0) return 0;
  const revenuLocatifAnnuel = loyerMensuel * 12 * (1 - tauxVacancePct / 100);
  const revenuFoncier = revenuLocatifAnnuel - chargesAnnuelles - taxeFonciere;

  let baseImposable: number;
  if (isLmnp) {
    // micro-BIC : abattement 50%
    baseImposable = revenuLocatifAnnuel * 0.5;
  } else {
    // régime foncier réel approximé
    baseImposable = revenuFoncier;
  }

  // Prélèvements sociaux 17.2% s'ajoutent à l'IR
  const prelevementsSociauxPct = 17.2;
  const tauxImpotEffectif = (tmiPct + prelevementsSociauxPct) / 100;
  const impot = Math.max(0, baseImposable * tauxImpotEffectif);

  const revenuApresImpot = revenuFoncier - impot;
  return (revenuApresImpot / coutTotal) * 100;
}

/**
 * Cashflow mensuel = (loyer net charges) − mensualité crédit.
 * Avant impôts (cashflow comptable, pas fiscal).
 */
export function cashflowMensuel(
  loyerMensuel: number,
  mensualite: number,
  chargesMensuelles: number,
  taxeFonciereMensualisee: number,
  tauxVacancePct = 8,
): number {
  const loyerNet = loyerMensuel * (1 - tauxVacancePct / 100);
  return loyerNet - mensualite - chargesMensuelles - taxeFonciereMensualisee;
}

/**
 * Prix au m² médian le plus pertinent (IRIS > commune).
 */
export function prixM2Reference(
  prixM2Iris: number | null,
  prixM2Commune: number | null,
): number | null {
  return prixM2Iris ?? prixM2Commune ?? null;
}

/**
 * Écart prix demandé vs médian DVF, en %.
 * Positif = au-dessus du marché, négatif = en-dessous.
 */
export function ecartPrixPct(
  prixDemandeM2: number,
  prixM2MedianReference: number | null,
): number | null {
  if (!prixM2MedianReference || prixM2MedianReference <= 0) return null;
  return ((prixDemandeM2 - prixM2MedianReference) / prixM2MedianReference) * 100;
}
