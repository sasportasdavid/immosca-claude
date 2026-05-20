import type { ValueAlertFrequency, ValueBien, ValueBienStatus } from "@immoscan/db";
import { Trash2, ExternalLink } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@web/components/ui/radio-group";
import { StatusBadge } from "@web/components/ui/status-badge";

// BienTabsParametres — onglet "Paramètres" du dashboard bien.
// Sections :
//   1. Alertes (seuil variation + fréquence)
//   2. Liens comparables modifiables (URLs SeLoger/Leboncoin)
//   3. Statut du bien — 4 boutons d'état (Suivi/Discret/Public/Retiré)
//   4. Danger zone — suppression
//
// Toutes les mutations remontent au container parent via callbacks.

const FREQUENCY_OPTIONS: Array<{
  value: ValueAlertFrequency;
  label: string;
  hint?: string;
}> = [
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuelle" },
  { value: "quarterly", label: "Trimestrielle" },
  {
    value: "on_significant_change",
    label: "Seulement gros changement",
    hint: "Au-delà du seuil de variation ci-dessus.",
  },
];

const STATUS_OPTIONS: Array<{
  value: ValueBienStatus;
  label: string;
  description: string;
}> = [
  {
    value: "suivi",
    label: "Suivi",
    description: "Privé · seules les revalorisations te sont envoyées.",
  },
  {
    value: "discret",
    label: "Discret",
    description: "Visible dans la vitrine sans adresse ni contact.",
  },
  {
    value: "public",
    label: "Public",
    description: "Annonce complète + contact direct (49 €).",
  },
  {
    value: "retire",
    label: "Retiré",
    description: "Plus visible nulle part. Tu peux republier sans repayer.",
  },
];

export interface BienTabsParametresProps {
  bien: ValueBien;
  onChangeAlerts: (patch: {
    alert_threshold_pct?: number;
    alert_frequency?: ValueAlertFrequency;
  }) => void;
  /** Demande de bascule de status — déclenche la modal de confirmation. */
  onRequestStatusChange: (next: ValueBienStatus) => void;
  onUpdateComparables: (urls: string[]) => void;
  onDeleteBien: () => void;
  isPending?: boolean;
}

export function BienTabsParametres({
  bien,
  onChangeAlerts,
  onRequestStatusChange,
  onUpdateComparables,
  onDeleteBien,
  isPending = false,
}: BienTabsParametresProps) {
  const [threshold, setThreshold] = React.useState(bien.alert_threshold_pct);
  const [comparables, setComparables] = React.useState<string[]>(
    bien.user_provided_urls ?? [],
  );

  return (
    <div className="space-y-7">
      {/* ── Alertes ───────────────────────────────────────────── */}
      <section className="rounded-r-lg border border-line bg-card p-6">
        <Eyebrow>Alertes</Eyebrow>
        <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-ink">
          Quand veux-tu être prévenu·e&nbsp;?
        </h3>

        <div className="mt-5">
          <Label className="mb-2 block">Seuil de variation</Label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
              onMouseUp={() => onChangeAlerts({ alert_threshold_pct: threshold })}
              onTouchEnd={() => onChangeAlerts({ alert_threshold_pct: threshold })}
              className="flex-1 accent-terra"
            />
            <span className="w-12 text-right font-mono text-[15px] font-semibold text-ink tnum">
              {threshold}&nbsp;%
            </span>
          </div>
          <p className="mt-1 text-[12px] text-muted-ink">
            On t&rsquo;envoie un email quand la valorisation bouge de plus de{" "}
            {threshold}&nbsp;% entre deux re-calculs.
          </p>
        </div>

        <div className="mt-6">
          <Label className="mb-2 block">Fréquence des notifications</Label>
          <RadioGroup
            value={bien.alert_frequency}
            onValueChange={(v) =>
              onChangeAlerts({ alert_frequency: v as ValueAlertFrequency })
            }
            className="gap-2"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={
                  "flex cursor-pointer items-start gap-3 rounded-r border p-3 transition-colors " +
                  (bien.alert_frequency === opt.value
                    ? "border-terra/30 bg-terra-soft/30"
                    : "border-line hover:border-line-2")
                }
              >
                <RadioGroupItem value={opt.value} className="mt-0.5" />
                <div>
                  <div className="text-[13.5px] font-medium text-ink">
                    {opt.label}
                  </div>
                  {opt.hint && (
                    <div className="mt-0.5 text-[12px] text-muted-ink">
                      {opt.hint}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>
      </section>

      {/* ── Liens comparables ─────────────────────────────────── */}
      <section className="rounded-r-lg border border-line bg-card p-6">
        <Eyebrow>Mes liens comparables</Eyebrow>
        <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-ink">
          Annonces SeLoger / Leboncoin
        </h3>
        <p className="mt-1 text-[12.5px] text-muted-ink">
          Ces liens nourrissent le recalcul. Modifier déclenche une
          ré-estimation dans la nuit.
        </p>

        <div className="mt-4 space-y-2">
          {comparables.length === 0 && (
            <div className="rounded-r border border-dashed border-line px-3.5 py-3 text-[12.5px] text-mute-2">
              Aucune URL renseignée. Ajoute des annonces similaires pour
              affiner la valorisation.
            </div>
          )}
          {comparables.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  const next = [...comparables];
                  next[i] = e.target.value;
                  setComparables(next);
                }}
                placeholder="https://www.seloger.com/…"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setComparables(comparables.filter((_, j) => j !== i))
                }
                aria-label="Supprimer ce lien"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setComparables([...comparables, ""])}
          >
            Ajouter une URL
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() =>
              onUpdateComparables(comparables.filter((u) => u.trim()))
            }
            disabled={isPending}
          >
            Enregistrer
          </Button>
        </div>
      </section>

      {/* ── Statut ────────────────────────────────────────────── */}
      <section className="rounded-r-lg border border-line bg-card p-6">
        <Eyebrow>Statut du bien</Eyebrow>
        <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-ink">
          État courant : <StatusBadge status={bien.status} className="ml-2" />
        </h3>

        <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {STATUS_OPTIONS.map((opt) => {
            const isCurrent = opt.value === bien.status;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isCurrent || isPending}
                onClick={() => onRequestStatusChange(opt.value)}
                className={
                  "flex items-start gap-3 rounded-r-lg border p-4 text-left transition-colors " +
                  "focus-visible:outline-none focus-visible:shadow-ring-violet " +
                  "disabled:cursor-default " +
                  (isCurrent
                    ? "border-terra/30 bg-terra-soft/30"
                    : "border-line bg-card hover:border-line-2 hover:bg-bg-2")
                }
              >
                <StatusBadge status={opt.value} className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {opt.label}
                    {isCurrent && (
                      <span className="ml-2 text-[11px] font-medium text-mute-2">
                        (actuel)
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[12.5px] text-muted-ink">
                    {opt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-mute-2">
          Voir aussi{" "}
          <a
            href="#"
            className="inline-flex items-center gap-1 text-violet hover:underline"
          >
            comment fonctionne le mode discret
            <ExternalLink className="h-3 w-3" />
          </a>
          .
        </p>
      </section>

      {/* ── Danger zone ───────────────────────────────────────── */}
      <section className="rounded-r-lg border border-destructive/30 bg-destructive-soft/40 p-6">
        <Eyebrow className="text-destructive">Zone sensible</Eyebrow>
        <h3 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-ink">
          Supprimer ce bien
        </h3>
        <p className="mt-1 text-[12.5px] text-muted-ink">
          L&rsquo;historique de valorisation, les stats et les favoris seront
          définitivement perdus. Cette action est irréversible.
        </p>
        <div className="mt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteBien}
            disabled={isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer ce bien
          </Button>
        </div>
      </section>
    </div>
  );
}
