import { Calendar, Lock, Send } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Input } from "@web/components/ui/input";
import { Label } from "@web/components/ui/label";
import { Textarea } from "@web/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// ContactVendeurForm — formulaire de contact pour le mode public d'une
// annonce (écran 16). Champs nom / email / téléphone (opt) / message,
// avec deux CTAs : envoyer le message ou demander une visite.
//
// V1 : la mutation réelle (table value.contacts) sera câblée plus tard.
// Pour l'instant on simule un succès avec un setState local pour
// montrer le flow UI.

export interface ContactVendeurFormProps {
  bienId: string;
  className?: string;
  onSubmit?: (payload: {
    nom: string;
    email: string;
    telephone?: string;
    message: string;
    intent: "message" | "visite";
  }) => Promise<void> | void;
}

export function ContactVendeurForm({
  bienId,
  className,
  onSubmit,
}: ContactVendeurFormProps) {
  const { user } = useAuth();
  const [nom, setNom] = React.useState("");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [telephone, setTelephone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState<null | "message" | "visite">(null);

  React.useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user?.email, email]);

  async function handleSubmit(intent: "message" | "visite") {
    if (!email || !message.trim() || !nom.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit?.({ nom, email, telephone: telephone || undefined, message, intent });
      setSent(intent);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div
        className={cn(
          "rounded-r-lg border border-sage/30 bg-sage-soft p-5 text-sage-2",
          className,
        )}
        role="status"
      >
        <div className="mb-1 text-[13px] font-semibold">
          {sent === "visite"
            ? "Demande de visite envoyée"
            : "Message envoyé au vendeur"}
        </div>
        <p className="text-[12.5px] text-sage-2/85">
          Le vendeur répond en moyenne sous 24 h. Tu seras notifié dès qu'une
          réponse arrive.
        </p>
      </div>
    );
  }

  // bienId est passé pour la future mutation (table value.contacts).
  // En V1 on l'utilise juste comme key de réinitialisation si la route change.
  return (
    <form
      key={bienId}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit("message");
      }}
      className={cn(
        "space-y-3 rounded-r-lg border border-line bg-card p-5",
        className,
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="contact-nom" className="text-[12px]">
          Ton nom
        </Label>
        <Input
          id="contact-nom"
          autoComplete="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contact-email" className="text-[12px]">
            Email
          </Label>
          <Input
            id="contact-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact-tel" className="text-[12px]">
            Téléphone <span className="text-mute-2">(optionnel)</span>
          </Label>
          <Input
            id="contact-tel"
            type="tel"
            autoComplete="tel"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="contact-msg" className="text-[12px]">
          Ton message
        </Label>
        <Textarea
          id="contact-msg"
          rows={4}
          placeholder="Présente-toi en quelques mots et précise ton projet (occupant, investisseur, primo-accédant…)."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="submit"
          variant="terra"
          size="default"
          disabled={submitting || !nom || !email || !message.trim()}
          className="gap-2"
        >
          <Send size={14} />
          Envoyer le message
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="default"
          disabled={submitting || !nom || !email}
          onClick={() => handleSubmit("visite")}
          className="gap-2"
        >
          <Calendar size={14} />
          Demander une visite
        </Button>
      </div>

      <p className="flex items-center gap-1.5 text-[11.5px] text-mute-2">
        <Lock size={11} className="shrink-0 text-mute-2" />
        Ton email reste masqué jusqu'à ce que le vendeur réponde.
      </p>
    </form>
  );
}
