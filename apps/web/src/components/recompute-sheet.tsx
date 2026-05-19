// RecomputeSheet — modal pour relancer le scoring + Claude avec de
// nouveaux paramètres financiers, SANS re-scraper Apify.
//
// Le user joue avec apport / taux / durée / TMI / rendement min et
// clique "Recalculer". Côté worker, la task analyze prend
// `paramsOverride` + `apifyRunIdOverride` (run existant) → update
// params_snapshot, rescore tous les listings, regénère le Top 5 Claude
// (sauf si skipClaude=true → option économique).

import { useMutation } from "@tanstack/react-query";
import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";

type Props = {
  analysisId: string;
  apifyRunId: string | null;
  currentParams: {
    apport: number;
    taux_credit_pct: number;
    duree_credit_ans: number;
    tmi_pct: number;
    rendement_min_pct: number;
  };
  onLaunched?: () => void;
};

export function RecomputeSheet({
  analysisId,
  apifyRunId,
  currentParams,
  onLaunched,
}: Props) {
  const [open, setOpen] = useState(false);
  const [apport, setApport] = useState(currentParams.apport);
  const [taux, setTaux] = useState(currentParams.taux_credit_pct);
  const [duree, setDuree] = useState(currentParams.duree_credit_ans);
  const [tmi, setTmi] = useState(currentParams.tmi_pct);
  const [rendementMin, setRendementMin] = useState(
    currentParams.rendement_min_pct,
  );
  const [skipClaude, setSkipClaude] = useState(false);

  const recompute = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("trigger-analyze", {
        body: {
          analysisId,
          apifyRunIdOverride: apifyRunId,
          paramsOverride: {
            apport,
            taux_credit_pct: taux,
            duree_credit_ans: duree,
            tmi_pct: tmi,
            rendement_min_pct: rendementMin,
          },
          skipClaude,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recalcul lancé — la page va se mettre à jour");
      setOpen(false);
      onLaunched?.();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Échec : ${msg}`);
    },
  });

  const disabled = !apifyRunId || recompute.isPending;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" disabled={!apifyRunId}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Recalculer
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Recalculer avec d'autres paramètres</SheetTitle>
          <SheetDescription>
            On ré-utilise les mêmes annonces (pas de nouveau scrape Apify) et
            on recalcule rendement, cashflow, score selon tes nouveaux
            paramètres. Idéal pour tester "et si j'avais 250k au lieu de
            200k…".
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <SliderRow
            label="Apport"
            value={apport}
            onChange={setApport}
            min={0}
            max={1_000_000}
            step={5_000}
            format={(v) => `${Math.round(v / 1000)} k€`}
          />
          <SliderRow
            label="Taux crédit"
            value={taux}
            onChange={setTaux}
            min={0.5}
            max={8}
            step={0.05}
            format={(v) => `${v.toFixed(2)} %`}
          />
          <SliderRow
            label="Durée crédit"
            value={duree}
            onChange={setDuree}
            min={5}
            max={30}
            step={1}
            format={(v) => `${v} ans`}
          />
          <SliderRow
            label="TMI"
            value={tmi}
            onChange={setTmi}
            min={0}
            max={45}
            step={1}
            format={(v) => `${v} %`}
          />
          <SliderRow
            label="Rendement min acceptable"
            value={rendementMin}
            onChange={setRendementMin}
            min={1}
            max={15}
            step={0.5}
            format={(v) => `${v.toFixed(1)} %`}
          />

          <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/30 p-3">
            <input
              type="checkbox"
              checked={skipClaude}
              onChange={(e) => setSkipClaude(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border"
            />
            <div>
              <div className="text-[13px] font-medium">
                Ne pas régénérer les analyses Claude
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Économique (zéro coût Claude). Le Top 5 garde les anciennes
                thèses, qui peuvent ne plus correspondre exactement aux
                nouveaux scores. Décoche pour avoir des thèses Claude à jour.
              </p>
            </div>
          </label>

          <div className="flex justify-between gap-3 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={recompute.isPending}
            >
              Annuler
            </Button>
            <Button onClick={() => recompute.mutate()} disabled={disabled}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {recompute.isPending ? "Lancement…" : "Recalculer"}
            </Button>
          </div>

          {!apifyRunId ? (
            <p className="text-[12px] text-warning-foreground">
              Cette analyse n'a pas d'apify_run_id sauvegardé — impossible de
              recalculer sans re-scraper. Relance une nouvelle analyse à la
              place.
            </p>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function SliderRow({
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
      <div className="mb-1 flex items-center justify-between text-[13px]">
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
