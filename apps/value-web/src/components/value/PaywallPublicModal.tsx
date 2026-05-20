import { Check } from "lucide-react";
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

// PaywallPublicModal — écran 12. Drawer pour basculer un bien `discret`
// vers `public`. Récolte les paramètres de contact + lance `postBiensPublish`
// (qui peut renvoyer un `checkout_url` Stripe → redirect navigateur).
//
// La logique réseau est dans le container parent — ce composant remonte
// les settings via `onConfirm` et reçoit `isPending` pour disabled-state.

export type ContactEmailMode = "masked" | "visible";
export type ContactPhoneMode = "hidden" | "after_visit";

export type PublicContactSettings = {
  emailMode: ContactEmailMode;
  phoneMode: ContactPhoneMode;
  autoReplyEnabled: boolean;
};

export const DEFAULT_PUBLIC_SETTINGS: PublicContactSettings = {
  emailMode: "masked",
  phoneMode: "hidden",
  autoReplyEnabled: true,
};

export interface PaywallPublicModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (settings: PublicContactSettings) => void | Promise<void>;
  isPending?: boolean;
  /** Nombre de favoris qui seront alertés (pour le wording). */
  favorisCount?: number;
}

export function PaywallPublicModal({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
  favorisCount = 18,
}: PaywallPublicModalProps) {
  const [settings, setSettings] = React.useState<PublicContactSettings>(
    DEFAULT_PUBLIC_SETTINGS,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[680px]">
        <SheetHeader>
          <SheetTitle>Passer en vente publique</SheetTitle>
          <SheetDescription>
            Un paiement unique de 49&nbsp;€, pas d&rsquo;abonnement.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          {/* Bénéfices */}
          <section>
            <Label className="mb-3 block text-[12.5px] font-semibold uppercase tracking-[0.06em] text-mute-2">
              Ce que tu obtiens
            </Label>
            <ul className="space-y-2.5">
              <Benefit>Adresse et coordonnées visibles (paramètres modulables)</Benefit>
              <Benefit highlight>
                Les {favorisCount} personnes ayant mis ton bien en favoris seront
                alertées instantanément
              </Benefit>
              <Benefit>Contact direct par formulaire ImmoValue (email masqué)</Benefit>
              <Benefit>Pages SEO optimisées sur Google</Benefit>
              <Benefit>
                Visibilité dans les veilles ImmoScan des 200+ investisseurs
                actifs sur Gagny
              </Benefit>
            </ul>
          </section>

          {/* Paramètres de contact */}
          <section className="rounded-r-lg border border-line bg-card p-5">
            <Label className="mb-3 block text-[12.5px] font-semibold uppercase tracking-[0.06em] text-mute-2">
              Paramètres de contact
            </Label>

            <div className="mb-4">
              <div className="mb-1.5 text-[13px] font-medium text-ink-2">Email</div>
              <RadioGroup
                value={settings.emailMode}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, emailMode: v as ContactEmailMode }))
                }
                className="gap-1.5"
              >
                <ContactRadio
                  value="masked"
                  current={settings.emailMode}
                  title="Masqué via formulaire ImmoValue"
                  hint="Recommandé"
                />
                <ContactRadio
                  value="visible"
                  current={settings.emailMode}
                  title="Affiché en clair"
                />
              </RadioGroup>
            </div>

            <div className="mb-4">
              <div className="mb-1.5 text-[13px] font-medium text-ink-2">
                Téléphone
              </div>
              <RadioGroup
                value={settings.phoneMode}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, phoneMode: v as ContactPhoneMode }))
                }
                className="gap-1.5"
              >
                <ContactRadio
                  value="hidden"
                  current={settings.phoneMode}
                  title="Non visible"
                />
                <ContactRadio
                  value="after_visit"
                  current={settings.phoneMode}
                  title="Visible après demande de visite acceptée"
                />
              </RadioGroup>
            </div>

            <label className="flex cursor-pointer items-center justify-between border-t border-line pt-3">
              <span className="text-[13.5px] text-ink-2">
                Réponse auto pour la première demande
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.autoReplyEnabled}
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    autoReplyEnabled: !s.autoReplyEnabled,
                  }))
                }
                className={
                  "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors " +
                  "focus-visible:outline-none focus-visible:shadow-ring-violet " +
                  (settings.autoReplyEnabled ? "bg-terra" : "bg-line-2")
                }
              >
                <span
                  aria-hidden
                  className={
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform " +
                    (settings.autoReplyEnabled ? "translate-x-4" : "translate-x-0.5")
                  }
                />
              </button>
            </label>
          </section>

          {/* Pricing */}
          <section className="rounded-r-lg border border-terra/20 bg-terra-soft/40 p-5 text-center">
            <div className="font-mono text-[36px] font-semibold leading-none tracking-[-0.02em] text-ink tnum">
              49&nbsp;€
            </div>
            <p className="mt-2 text-[13px] text-ink-2">
              Paiement unique, valable jusqu&rsquo;à la vente
            </p>
            <p className="mt-1 text-[12px] text-muted-ink">
              Pas d&rsquo;abonnement, pas de reconduction.
            </p>
            <p className="mt-3 max-w-[36ch] mx-auto text-[12px] text-muted-ink">
              Tu peux retirer ton annonce et la republier autant que tu veux
              sans repayer.
            </p>
          </section>
        </SheetBody>

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Plus tard
          </Button>
          <Button
            variant="terra"
            onClick={() => onConfirm(settings)}
            disabled={isPending}
          >
            {isPending ? "Redirection Stripe…" : "Payer et publier — 49 €"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Benefit({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-snug">
      <span
        className={
          "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full " +
          (highlight ? "bg-terra text-white" : "bg-sage-soft text-sage-2")
        }
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      <span
        className={highlight ? "font-semibold text-ink" : "text-ink-2"}
      >
        {children}
      </span>
    </li>
  );
}

function ContactRadio({
  value,
  current,
  title,
  hint,
}: {
  value: string;
  current: string;
  title: string;
  hint?: string;
}) {
  const selected = value === current;
  return (
    <label
      className={
        "flex cursor-pointer items-start gap-3 rounded-r border p-2.5 transition-colors " +
        (selected
          ? "border-terra/30 bg-terra-soft/30"
          : "border-line hover:border-line-2")
      }
    >
      <RadioGroupItem value={value} className="mt-0.5" />
      <div className="flex-1">
        <div className="text-[13.5px] font-medium text-ink">{title}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-ink">{hint}</div>}
      </div>
    </label>
  );
}
