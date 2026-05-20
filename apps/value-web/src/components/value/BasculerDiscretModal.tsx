import { Eye } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Label } from "@web/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@web/components/ui/radio-group";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@web/components/ui/sheet";

// BasculerDiscretModal — écran 10. Sheet (drawer right) pour passer un
// bien du status `suivi` vers `discret`. Récolte les paramètres
// d'anonymisation (niveau géo, blur photos, étage exact, surface exacte).
//
// V1 : la validation/persist est gérée par le container parent via
// `onConfirm(settings)`. Ce composant est présentationnel pur.

export type AnonGeoLevel = "iris" | "commune" | "arrondissement";

export type DiscretAnonSettings = {
  geoLevel: AnonGeoLevel;
  blurPhotos: boolean;
  showEtage: boolean;
  showSurface: boolean;
};

export const DEFAULT_DISCRET_SETTINGS: DiscretAnonSettings = {
  geoLevel: "iris",
  blurPhotos: true,
  showEtage: false,
  showSurface: true,
};

export interface BasculerDiscretModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (settings: DiscretAnonSettings) => void | Promise<void>;
  /** Disable les CTA pendant l'appel réseau. */
  isPending?: boolean;
}

export function BasculerDiscretModal({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: BasculerDiscretModalProps) {
  const [settings, setSettings] = React.useState<DiscretAnonSettings>(
    DEFAULT_DISCRET_SETTINGS,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[680px]">
        <SheetHeader>
          <SheetTitle>Tester l&rsquo;intérêt du marché</SheetTitle>
          <SheetDescription>
            Mode discret · ton bien apparaît dans la vitrine sans données
            identifiantes.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-7">
          {/* Illustration */}
          <div className="flex items-center justify-center rounded-r-lg border border-line bg-bg-2 py-8">
            <Eye className="h-16 w-16 text-faint" strokeWidth={1.25} />
          </div>

          {/* Explication */}
          <div className="space-y-2.5 text-[14px] leading-[1.6] text-ink-2">
            <p>
              Ton bien apparaîtra dans notre vitrine sans son adresse exacte
              ni tes coordonnées.
            </p>
            <p>
              Tu sauras combien de personnes l&rsquo;ont consulté, combien
              l&rsquo;ont mis en favoris, et le profil moyen des acheteurs
              intéressés.
            </p>
            <p className="text-muted-ink">
              Personne ne peut te contacter en mode discret. Tu peux repasser
              en privé à tout moment.
            </p>
          </div>

          {/* Paramètres anonymisation */}
          <div className="space-y-5 rounded-r-lg border border-line bg-card p-5">
            <div>
              <Label className="mb-2 block text-[12.5px] font-semibold uppercase tracking-[0.06em] text-mute-2">
                Niveau géographique affiché
              </Label>
              <RadioGroup
                value={settings.geoLevel}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, geoLevel: v as AnonGeoLevel }))
                }
                className="gap-2"
              >
                <GeoRadio
                  value="iris"
                  current={settings.geoLevel}
                  title="Quartier (~5 rues)"
                  hint="Recommandé · meilleur compromis vie privée / intérêt"
                />
                <GeoRadio
                  value="commune"
                  current={settings.geoLevel}
                  title="Commune entière"
                />
                <GeoRadio
                  value="arrondissement"
                  current={settings.geoLevel}
                  title="Arrondissement"
                />
              </RadioGroup>
            </div>

            <div className="space-y-3 border-t border-line pt-4">
              <ToggleRow
                label="Flouter automatiquement mes photos d'extérieur"
                checked={settings.blurPhotos}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, blurPhotos: v }))
                }
              />
              <ToggleRow
                label="Afficher mon étage exact"
                checked={settings.showEtage}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, showEtage: v }))
                }
              />
              <ToggleRow
                label="Afficher ma surface exacte"
                checked={settings.showSurface}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, showSurface: v }))
                }
              />
            </div>
          </div>

          {/* Aperçu */}
          <div>
            <Label className="mb-2 block text-[12.5px] font-semibold uppercase tracking-[0.06em] text-mute-2">
              Aperçu — voici comment ton bien apparaîtra
            </Label>
            <div className="rounded-r-lg border border-line bg-card p-4">
              <div className="aspect-[16/10] rounded-r-sm bg-photo-bg" />
              <div className="mt-3 text-[14px] font-semibold text-ink">
                T3 · {settings.showSurface ? "62 m²" : "~60 m²"} ·{" "}
                {settings.geoLevel === "iris"
                  ? "Le Chénay, Gagny"
                  : settings.geoLevel === "commune"
                    ? "Gagny (93)"
                    : "Seine-Saint-Denis"}
              </div>
              <p className="mt-1 text-[12.5px] text-muted-ink">
                {settings.showEtage ? "3e étage" : "Étage intermédiaire"} · DPE D
                · Refait · Balcon
              </p>
            </div>
          </div>
        </SheetBody>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button
            variant="terra"
            onClick={() => onConfirm(settings)}
            disabled={isPending}
          >
            {isPending ? "Publication…" : "Publier en mode discret"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function GeoRadio({
  value,
  current,
  title,
  hint,
}: {
  value: AnonGeoLevel;
  current: AnonGeoLevel;
  title: string;
  hint?: string;
}) {
  const selected = value === current;
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-r border p-3 transition-colors " +
        (selected
          ? "border-terra/30 bg-terra-soft/40"
          : "border-line hover:border-line-2")
      }
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="flex-1">
        <div className="text-[14px] font-medium text-ink">{title}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-ink">{hint}</div>}
      </div>
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="text-[14px] text-ink-2">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={
          "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors " +
          "focus-visible:outline-none focus-visible:shadow-ring-violet " +
          (checked ? "bg-terra" : "bg-line-2")
        }
      >
        <span
          aria-hidden
          className={
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
            (checked ? "translate-x-4" : "translate-x-0.5")
          }
        />
      </button>
    </label>
  );
}
