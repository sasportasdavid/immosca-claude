// ListingSimulator — bloc "et si ?" dans le drawer fiche bien.
//
// L'utilisateur joue avec apport / taux / durée / TMI / part louée pour
// voir comment ça impacte la mensualité, le cashflow et le rendement.
// 100% client-side (logique pure). Pas de DB write — la simulation est
// éphémère, on garde le scoring DB original.
//
// Le loyer estimé est figé (vient des OLL, dépend du marché pas de l'user).
// On recalcule juste les indicateurs financiers.

import { Sliders } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  listing: {
    prix: number | null;
    surface: number | null;
    is_new_construction: boolean | null;
    loyer_estime: number | null;
  };
  initialParams: {
    apport: number;
    taux_credit_pct: number;
    duree_credit_ans: number;
    tmi_pct: number;
  };
};

function mensualite(
  capital: number,
  tauxPct: number,
  dureeAns: number,
): number {
  if (capital <= 0) return 0;
  if (tauxPct <= 0) return capital / (dureeAns * 12);
  const tauxM = tauxPct / 100 / 12;
  const n = dureeAns * 12;
  return (capital * (tauxM * Math.pow(1 + tauxM, n))) / (Math.pow(1 + tauxM, n) - 1);
}

function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${Math.round(n).toLocaleString("fr-FR")} €`;
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)} %`;
}

export function ListingSimulator({ listing, initialParams }: Props) {
  const [apport, setApport] = useState(initialParams.apport);
  const [taux, setTaux] = useState(initialParams.taux_credit_pct);
  const [duree, setDuree] = useState(initialParams.duree_credit_ans);
  const [tmi, setTmi] = useState(initialParams.tmi_pct);

  const prix = listing.prix ?? 0;
  const loyer = listing.loyer_estime ?? 0;
  const fraisNotairePct = listing.is_new_construction ? 0.03 : 0.08;

  const calc = useMemo(() => {
    const fraisNotaire = prix * fraisNotairePct;
    const coutTotal = prix + fraisNotaire;
    const emprunte = Math.max(0, coutTotal - apport);
    const mens = mensualite(emprunte, taux, duree);

    // Estimations charges courantes
    const taxeFonciere = prix * 0.005; // ~0.5% annuel
    const gestionPct = 0.07; // 7% honoraires
    const assurancePNO = 150;
    const vacanceMois = 0.5; // 0.5 mois/an
    const loyerNet =
      loyer * 12 -
      taxeFonciere -
      loyer * 12 * gestionPct -
      assurancePNO -
      loyer * vacanceMois;
    // Imposition foncier (régime simplifié : on applique TMI + 17.2% PS sur le net)
    const psPct = 17.2;
    const impotAnnuel = Math.max(0, (loyerNet * (tmi + psPct)) / 100);
    const loyerNetNet = loyerNet - impotAnnuel;

    const cashflowMensuel = loyer - mens - taxeFonciere / 12 - assurancePNO / 12;
    const rendementBrut = prix > 0 ? ((loyer * 12) / prix) * 100 : 0;
    const rendementNet = prix > 0 ? (loyerNet / prix) * 100 : 0;
    const rendementNetNet = prix > 0 ? (loyerNetNet / prix) * 100 : 0;

    return {
      fraisNotaire,
      coutTotal,
      emprunte,
      mensualite: mens,
      cashflowMensuel,
      rendementBrut,
      rendementNet,
      rendementNetNet,
    };
  }, [prix, loyer, fraisNotairePct, apport, taux, duree, tmi]);

  function reset() {
    setApport(initialParams.apport);
    setTaux(initialParams.taux_credit_pct);
    setDuree(initialParams.duree_credit_ans);
    setTmi(initialParams.tmi_pct);
  }

  const changed =
    apport !== initialParams.apport ||
    taux !== initialParams.taux_credit_pct ||
    duree !== initialParams.duree_credit_ans ||
    tmi !== initialParams.tmi_pct;

  if (!prix || !loyer) {
    return null; // pas de simulateur si on n'a pas les fondamentaux
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-primary" />
          <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Simulateur
          </h3>
        </div>
        {changed ? (
          <button
            type="button"
            onClick={reset}
            className="text-[11px] text-primary hover:underline"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        <SliderField
          label="Apport"
          value={apport}
          onChange={setApport}
          min={0}
          max={Math.max(500_000, prix)}
          step={5_000}
          format={(v) => `${Math.round(v / 1000)} k€`}
        />
        <SliderField
          label="Taux crédit"
          value={taux}
          onChange={setTaux}
          min={0.5}
          max={8}
          step={0.05}
          format={(v) => `${v.toFixed(2)} %`}
        />
        <SliderField
          label="Durée"
          value={duree}
          onChange={setDuree}
          min={5}
          max={30}
          step={1}
          format={(v) => `${v} ans`}
        />
        <SliderField
          label="TMI"
          value={tmi}
          onChange={setTmi}
          min={0}
          max={45}
          step={1}
          format={(v) => `${v} %`}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-[13px]">
        <Stat label="Mensualité" value={fmtEur(calc.mensualite)} />
        <Stat
          label="Cashflow / mois"
          value={fmtEur(calc.cashflowMensuel)}
          tone={
            Number.isFinite(calc.cashflowMensuel)
              ? calc.cashflowMensuel >= 0
                ? "good"
                : "bad"
              : undefined
          }
        />
        <Stat label="Rendement brut" value={fmtPct(calc.rendementBrut)} />
        <Stat
          label="Rendement net-net"
          value={fmtPct(calc.rendementNetNet)}
          tone={
            Number.isFinite(calc.rendementNetNet) && calc.rendementNetNet >= 4
              ? "good"
              : undefined
          }
        />
        <Stat label="Frais notaire" value={fmtEur(calc.fraisNotaire)} />
        <Stat label="Montant emprunté" value={fmtEur(calc.emprunte)} />
      </div>

      <p className="mt-3 text-[11px] leading-[1.5] text-muted-foreground">
        Simulation indicative basée sur le loyer estimé ({Math.round(loyer)} €/mois),
        frais de notaire {fraisNotairePct * 100}% (ancien),
        gestion 7%, assurance PNO 150€/an, vacance 0.5 mois.
        TMI + 17.2% prélèvements sociaux sur le revenu foncier net.
      </p>
    </section>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums font-medium">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 font-mono tabular-nums font-medium ${
          tone === "good"
            ? "text-success-foreground"
            : tone === "bad"
              ? "text-destructive-foreground"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
