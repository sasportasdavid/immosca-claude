// /biens — liste de tous les biens estimés de l'utilisateur.
//
// Gate auth obligatoire via `beforeLoad: requireAuth`. La RLS de
// `value.biens` filtre déjà côté DB sur `user_id = auth.uid()`.
//
// Empty state si 0 bien → CTA "Estimer un bien". Sinon grid de cards.
// Une card → navigate vers /biens/$bienId (dashboard d'un bien).

import type { ValueBien } from "@immoscan/db";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Compass,
  Eye,
  Layers,
  Plus,
  Sparkles,
} from "lucide-react";

import { Button } from "@web/components/ui/button";
import { Card } from "@web/components/ui/card";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { StatusBadge } from "@web/components/ui/status-badge";
import { Wordmark } from "@/components/value/EstimationStepperLayout";
import { useAuth } from "@/hooks/use-auth";
import { useBiens } from "@/hooks/use-biens";
import { requireAuth } from "@/lib/auth-guards";
import { cn } from "@/lib/utils";

function BiensListPage() {
  const { user, signOut } = useAuth();
  const { data: biens, isLoading, error } = useBiens();

  const list = biens ?? [];

  return (
    <main
      className={cn(
        "min-h-screen bg-bg",
        "[background-image:radial-gradient(700px_400px_at_95%_0%,rgba(217,119,87,0.06),transparent_60%)]",
      )}
    >
      <header className="border-b border-line/60 bg-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-6 sm:px-8">
          <Wordmark />
          <div className="flex items-center gap-3 text-[13px] text-muted-ink">
            {user?.email && (
              <span className="hidden font-mono text-[11.5px] text-mute-2 sm:inline">
                {user.email}
              </span>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-full border border-line px-3 py-1 text-[12px] text-mute-2 no-underline hover:text-ink"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-6 pb-20 pt-12 sm:px-8">
        {/* ── Page head ── */}
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow variant="terra">Tableau de bord</Eyebrow>
            <h1 className="mt-2 font-serif text-[clamp(2.25rem,4.5vw,3rem)] italic font-normal leading-[1.1] tracking-[-0.022em] text-ink">
              Mes{" "}
              <span className="not-italic font-sans font-semibold">biens.</span>
            </h1>
            <p className="mt-2 text-[14px] text-muted-ink">
              {isLoading
                ? "Chargement…"
                : list.length === 0
                  ? "Aucun bien estimé pour l'instant."
                  : `${list.length} bien${list.length > 1 ? "s" : ""} suivi${list.length > 1 ? "s" : ""}`}
            </p>
          </div>
          {list.length > 0 && (
            <Button asChild variant="terra" size="lg">
              <Link to="/estimer">
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Estimer un nouveau bien
              </Link>
            </Button>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[280px] animate-pulse rounded-r-lg border border-line bg-bg-2"
              />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {!isLoading && error && (
          <Card className="mt-10 p-8 text-center">
            <h2 className="text-[16px] font-semibold text-ink">
              On n&rsquo;a pas pu charger tes biens
            </h2>
            <p className="mt-2 text-[13px] text-muted-ink">{String(error)}</p>
          </Card>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !error && list.length === 0 && <EmptyState />}

        {/* ── Grid ── */}
        {!isLoading && !error && list.length > 0 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((bien) => (
              <BienListCard key={bien.id} bien={bien} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <Card className="mt-10 flex flex-col items-center gap-6 p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-r-lg bg-terra-soft text-terra-deep">
        <Sparkles className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <div className="max-w-[44ch]">
        <h2 className="font-serif text-[clamp(1.5rem,2.5vw,2rem)] italic font-normal leading-tight tracking-[-0.018em] text-ink">
          Tu n&rsquo;as pas encore de{" "}
          <span className="not-italic font-sans font-semibold">bien estimé.</span>
        </h2>
        <p className="mt-3 text-[14px] leading-[1.55] text-muted-ink">
          Lance une première estimation : adresse, photos, comparables. En 8
          minutes tu as un rapport argumenté que tu peux suivre dans le temps.
        </p>
      </div>
      <Button asChild variant="terra" size="lg">
        <Link to="/estimer">
          Estimer un bien
          <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
        </Link>
      </Button>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────
// Card d'un bien dans la liste
// ──────────────────────────────────────────────────────────────────

function getBienField<T>(bien: ValueBien, key: string): T | undefined {
  const data = (bien.bien_data ?? {}) as Record<string, unknown>;
  return data[key] as T | undefined;
}

function formatTypeAndSurface(bien: ValueBien): string {
  const type = getBienField<string>(bien, "type") ?? "bien";
  const pieces = getBienField<number>(bien, "pieces");
  const surface = getBienField<number>(bien, "surface_carrez")
    ?? getBienField<number>(bien, "surface");
  const typeLabel = type === "maison" ? "Maison" : `T${pieces ?? "—"}`;
  return surface ? `${typeLabel} · ${surface} m²` : typeLabel;
}

function formatValo(bien: ValueBien): string | null {
  const v = bien.valo_courante as
    | { central?: number; low?: number; high?: number }
    | null;
  if (!v) return null;
  if (typeof v.central === "number") {
    return `${Math.round(v.central / 1000)} k€`;
  }
  if (typeof v.low === "number" && typeof v.high === "number") {
    return `${Math.round(v.low / 1000)} – ${Math.round(v.high / 1000)} k€`;
  }
  return null;
}

function formatUpdatedAt(bien: ValueBien): string {
  const d = bien.valo_updated_at ?? bien.updated_at ?? bien.created_at;
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function BienListCard({ bien }: { bien: ValueBien }) {
  const valoLabel = formatValo(bien);
  const meta = formatTypeAndSurface(bien);
  const pieces = getBienField<number>(bien, "pieces");
  const dpe = getBienField<string>(bien, "dpe");
  const photoUrl = bien.photos_originales_urls?.[0];

  return (
    <Link
      to="/biens/$bienId"
      // any: TanStack type le params en strict, bienId est une string.
      params={{ bienId: bien.id } as never}
      className={cn(
        "group block overflow-hidden rounded-r-lg border border-line bg-card shadow-lvl-1 no-underline",
        "transition-all hover:-translate-y-px hover:shadow-lvl-2",
        "focus-visible:outline-none focus-visible:shadow-ring-terra",
      )}
    >
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden bg-photo-bg">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-photo-bg to-photo-bg-2">
            <Building2 className="h-8 w-8 text-mute-2" strokeWidth={1.5} />
          </div>
        )}

        <div className="absolute left-3 top-3 z-10">
          <StatusBadge status={bien.status} />
        </div>
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        <div>
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.10em] text-mute-2">
            {meta}
          </div>
          <h3 className="mt-1 line-clamp-2 text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {bien.address}
          </h3>
        </div>

        {valoLabel ? (
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.10em] text-mute-2">
              Valorisation
            </div>
            <div className="mt-0.5 font-mono text-[20px] font-semibold tracking-[-0.01em] text-ink tnum">
              {valoLabel}
            </div>
          </div>
        ) : (
          <div className="text-[12.5px] text-mute-2">
            Estimation en cours…
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          {typeof pieces === "number" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1 text-[11.5px] text-ink-2">
              <Layers size={11} className="text-mute-2" strokeWidth={2} />
              {pieces} pièce{pieces > 1 ? "s" : ""}
            </span>
          )}
          {dpe && (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-2 px-2.5 py-1 text-[11.5px] text-ink-2">
              <Compass size={11} className="text-mute-2" strokeWidth={2} />
              DPE {dpe}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line/70 pt-3 font-mono text-[11px] text-mute-2">
          <span className="inline-flex items-center gap-1">
            <Eye size={11} strokeWidth={2} />
            MAJ {formatUpdatedAt(bien)}
          </span>
          <span className="text-terra group-hover:text-terra-deep">
            Voir →
          </span>
        </div>
      </div>
    </Link>
  );
}

export const Route = createFileRoute("/biens/")({
  beforeLoad: () => requireAuth({ from: "/biens" }),
  component: BiensListPage,
});
