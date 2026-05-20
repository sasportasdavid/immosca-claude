import type { ValueBien } from "@immoscan/db";
import { Settings, ExternalLink, Pencil } from "lucide-react";

import { Button } from "@web/components/ui/button";
import { StatusBadge } from "@web/components/ui/status-badge";

// BienHeader — bandeau de tête de la page mère /biens/$bienId.
// Photo principale à gauche (placeholder bg-bg-2), titre + status badge,
// boutons d'actions à droite. Calque du `.bien-head` du handoff
// `Immovalue - Stats discret.html`.
//
// Mode "Design" : composant purement présentationnel. Reçoit le bien via
// props, ne touche pas à Supabase ni à la navigation.

export interface BienHeaderProps {
  bien: ValueBien;
  onEdit?: () => void;
  onOpenSettings?: () => void;
  onOpenPublicListing?: () => void;
}

export function BienHeader({
  bien,
  onEdit,
  onOpenSettings,
  onOpenPublicListing,
}: BienHeaderProps) {
  const showPublicCta = bien.status === "public" || bien.status === "discret";
  const photoUrl = bien.photos_originales_urls?.[0];

  return (
    <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[220px_1fr_auto]">
      <div className="relative h-[140px] overflow-hidden rounded-r-lg border border-line bg-photo-bg">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={`Photo du bien ${bien.address}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-photo-bg to-photo-bg-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute-2">
              Photo du bien
            </span>
          </div>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {bien.address}
          </h1>
          <StatusBadge status={bien.status} />
        </div>
        <p className="mt-1.5 text-[13px] text-muted-ink">
          {bien.valo_updated_at
            ? `Dernière valorisation : ${new Date(bien.valo_updated_at).toLocaleDateString("fr-FR")}`
            : "Valorisation en cours"}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2">
        {showPublicCta && (
          <Button variant="ghost" size="sm" onClick={onOpenPublicListing}>
            <ExternalLink className="h-3.5 w-3.5" />
            Voir l&rsquo;annonce
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            aria-label="Paramètres du bien"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
