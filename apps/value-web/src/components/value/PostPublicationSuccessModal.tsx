import { CheckCircle2, ChevronRight, Bell, FileText, Megaphone } from "lucide-react";
import * as React from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@web/components/ui/sheet";

// PostPublicationSuccessModal — écran 13. Drawer affiché après une
// publication réussie (status `discret` → `public`). Trois actions
// rapides + confirmation visuelle de l'envoi des notifications.

export interface PostPublicationSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre de favoris notifiés (pour le wording). */
  favorisCount?: number;
  onViewPublicListing: () => void;
  onConfigureNotifications: () => void;
  /** V2 placeholder — pack annonces ailleurs (39€). */
  onBuyAdsPack?: () => void;
}

export function PostPublicationSuccessModal({
  open,
  onOpenChange,
  favorisCount = 18,
  onViewPublicListing,
  onConfigureNotifications,
  onBuyAdsPack,
}: PostPublicationSuccessModalProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Ton annonce est en ligne</SheetTitle>
          <SheetDescription>
            {favorisCount} favoris ont été notifiés à l&rsquo;instant.
          </SheetDescription>
        </SheetHeader>

        <SheetBody className="space-y-6">
          <div className="flex flex-col items-center py-6 text-center">
            <CheckCircle2
              className="h-20 w-20 text-sage"
              strokeWidth={1.5}
            />
            <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-ink-2 [text-wrap:pretty]">
              Surveille tes contacts dans les prochaines heures —
              c&rsquo;est le moment où les acheteurs intéressés vont
              réagir.
            </p>
          </div>

          <div className="space-y-2.5">
            <ActionCard
              icon={<FileText className="h-4 w-4" />}
              title="Voir mon annonce publique"
              description="Comme la voient les acheteurs."
              onClick={onViewPublicListing}
            />
            <ActionCard
              icon={<Bell className="h-4 w-4" />}
              title="Configurer mes notifications"
              description="Email ou SMS à chaque nouveau contact."
              onClick={onConfigureNotifications}
            />
            <ActionCard
              icon={<Megaphone className="h-4 w-4" />}
              title="Acheter le pack annonces ailleurs"
              description="Diffuser sur LBC, SeLoger, PAP (39 €) · bientôt disponible"
              onClick={onBuyAdsPack}
              comingSoon
            />
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function ActionCard({
  icon,
  title,
  description,
  onClick,
  comingSoon,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  comingSoon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={comingSoon}
      className={
        "group flex w-full items-center gap-3.5 rounded-r-lg border border-line bg-card p-4 text-left transition-colors " +
        "hover:border-line-2 hover:bg-bg-2 " +
        "focus-visible:outline-none focus-visible:shadow-ring-violet " +
        "disabled:cursor-not-allowed disabled:opacity-60"
      }
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-r bg-violet-soft text-violet-deep">
        {icon}
      </span>
      <div className="flex-1">
        <div className="text-[14px] font-semibold tracking-[-0.005em] text-ink">
          {title}
        </div>
        <div className="text-[12.5px] text-muted-ink">{description}</div>
      </div>
      {!comingSoon && (
        <ChevronRight className="h-4 w-4 text-mute-2 transition-transform group-hover:translate-x-0.5" />
      )}
    </button>
  );
}
