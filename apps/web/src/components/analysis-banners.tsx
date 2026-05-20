// Bannières contextuelles affichées sur /app/analyses/$id :
//   - QuotaUpsellBanner : si analyse failed avec error_message commençant
//     par "QUOTA_EXCEEDED|...", affiche un CTA contextuel d'upgrade.
//   - TruncateBanner : si l'actor a renvoyé cap+1 items (was_truncated),
//     informe que la recherche dépassait le cap du plan.
//
// Mode Code (lit le plan via useProfile pour adapter le message).

import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@immoscan/shared";

interface ParsedQuotaError {
  reason: string;
  upgradeTo: PlanId | "ppu" | null;
  used?: number;
  limit?: number;
}

/** Décode le format "QUOTA_EXCEEDED|reason|upgrade_to|used=N|limit=N". */
export function parseQuotaError(message: string | null): ParsedQuotaError | null {
  if (!message || !message.startsWith("QUOTA_EXCEEDED|")) return null;
  const [, reason, upgradeTo, usedStr, limitStr] = message.split("|");
  if (!reason) return null;
  const used = parseInt(usedStr?.split("=")[1] ?? "", 10);
  const limit = parseInt(limitStr?.split("=")[1] ?? "", 10);
  return {
    reason,
    upgradeTo:
      upgradeTo === "none" || upgradeTo === undefined
        ? null
        : (upgradeTo as ParsedQuotaError["upgradeTo"]),
    used: Number.isFinite(used) ? used : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

function quotaCopy(parsed: ParsedQuotaError, currentPlan: PlanId): {
  title: string;
  body: string;
  cta: string;
} {
  const upgradeLabel =
    parsed.upgradeTo === "ppu"
      ? "Acheter une analyse à 14,90€"
      : parsed.upgradeTo
        ? `Passer ${PLANS[parsed.upgradeTo].name}`
        : "Gérer mon abonnement";

  switch (parsed.reason) {
    case "analysis_quota_exceeded":
      return {
        title: "Quota d'analyses atteint",
        body:
          currentPlan === "free"
            ? "Tu as utilisé ton analyse gratuite du mois. Débloque-toi via PPU à 14,90€, ou passe Pro pour 10 analyses + 3 veilles (7 jours gratuits)."
            : `Tu as utilisé ${parsed.used ?? "?"}/${parsed.limit ?? "?"} analyses ce cycle. Achète des analyses à l'unité ou passe au plan supérieur.`,
        cta: upgradeLabel,
      };
    case "concurrent_analyses_exceeded":
      return {
        title: "Trop d'analyses en parallèle",
        body: `Ton plan autorise ${parsed.limit ?? 1} analyse${(parsed.limit ?? 1) > 1 ? "s" : ""} simultanée${(parsed.limit ?? 1) > 1 ? "s" : ""}. Attends qu'une analyse en cours se termine, ou passe à un plan supérieur pour augmenter ce nombre.`,
        cta: upgradeLabel,
      };
    case "paste_urls_exceeded":
      return {
        title: "Trop d'URLs collées",
        body: `Ton plan permet ${parsed.limit ?? "?"} URLs maximum en mode "Coller URLs". Passe au plan supérieur pour augmenter la limite.`,
        cta: upgradeLabel,
      };
    default:
      return {
        title: "Quota atteint",
        body: "Cette analyse a été bloquée par un quota de ton plan.",
        cta: upgradeLabel,
      };
  }
}

export function QuotaUpsellBanner({
  errorMessage,
  currentPlan,
}: {
  errorMessage: string | null;
  currentPlan: PlanId;
}) {
  const parsed = parseQuotaError(errorMessage);
  const navigate = useNavigate();
  if (!parsed) return null;
  const copy = quotaCopy(parsed, currentPlan);

  return (
    <div className="rounded-lg border border-primary/40 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 space-y-2">
          <div className="text-sm font-medium text-foreground">{copy.title}</div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">{copy.body}</p>
          <Button
            size="sm"
            onClick={() => navigate({ to: "/app/billing" })}
            className="mt-1"
          >
            {copy.cta}
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function TruncateBanner({
  totalListings,
  itemsCapApplied,
  currentPlan,
}: {
  totalListings: number | null;
  itemsCapApplied: number | null;
  currentPlan: PlanId;
}) {
  const navigate = useNavigate();
  const cap = itemsCapApplied ?? PLANS[currentPlan].itemsMaxPerAnalysis;
  const total = totalListings ?? cap;
  const canUpgrade = currentPlan !== "business";
  return (
    <div className="rounded-lg border border-amber-400/40 bg-amber-50/60 p-4 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="flex-1 space-y-1.5">
          <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Ta recherche couvrait plus de {cap} biens
          </div>
          <p className="text-[13px] leading-relaxed text-amber-800 dark:text-amber-200">
            On a analysé les {total} plus récents pour respecter le cap de ton plan ({PLANS[currentPlan].name} ·
            cap {cap}). Affine les filtres pour cibler les plus pertinents, ou passe à un plan supérieur pour analyser jusqu'à{" "}
            {currentPlan === "free"
              ? "300 biens (PPU/Pro)"
              : currentPlan === "pro"
                ? "500 biens (Pro+)"
                : "1000 biens (Business)"}
            .
          </p>
          {canUpgrade && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate({ to: "/app/billing" })}
              >
                Voir les plans
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
