import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Map as MapIcon, List as ListIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { AnnonceCard } from "@/components/value/AnnonceCard";
import { AnnoncesFilters } from "@/components/value/AnnoncesFilters";
import { AnnoncesMap } from "@/components/value/AnnoncesMap";
import {
  type AnnoncesFilters as AnnoncesFiltersType,
  useAnnonces,
} from "@/hooks/use-annonces";

// Route /annonces — vitrine acheteurs (écran 14).
//
// Layout desktop : carte 60% à gauche, liste 40% à droite (sticky).
// Layout mobile : toggle carte / liste, par défaut liste, carte
// dépliable.

function AnnoncesPage() {
  const [filters, setFilters] = React.useState<AnnoncesFiltersType>({
    mode: "tous",
  });
  const [mobileView, setMobileView] = React.useState<"liste" | "carte">("liste");

  const { data: annonces = [], isLoading } = useAnnonces(filters);

  return (
    <main className="min-h-screen bg-bg">
      {/* ── Header de page ── */}
      <header className="border-b border-line bg-card/80 backdrop-blur">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-5 lg:px-10">
          <div className="mb-3 flex items-center gap-2 text-[12.5px] text-mute-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-mute-2 hover:text-ink"
            >
              <ChevronLeft size={12} />
              ImmoValue
            </Link>
            <span className="text-faint">·</span>
            <span className="text-ink">Annonces</span>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow variant="terra">Vitrine acheteurs</Eyebrow>
              <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink">
                Trouve ton{" "}
                <span className="font-serif italic font-normal text-terra">
                  futur bien
                </span>
              </h1>
              <p className="mt-1.5 text-[13.5px] text-muted-ink">
                Annonces publiques et pré-ventes discrètes. Tu vois les biens
                avant qu'ils sortent sur SeLoger.
              </p>
            </div>

            {/* Toggle mobile carte/liste */}
            <div className="flex gap-1 rounded-r-sm border border-line bg-bg-2 p-1 md:hidden">
              <button
                type="button"
                onClick={() => setMobileView("liste")}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium ${
                  mobileView === "liste"
                    ? "bg-card text-ink shadow-lvl-1"
                    : "text-mute-2"
                }`}
              >
                <ListIcon size={12} />
                Liste
              </button>
              <button
                type="button"
                onClick={() => setMobileView("carte")}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[12px] font-medium ${
                  mobileView === "carte"
                    ? "bg-card text-ink shadow-lvl-1"
                    : "text-mute-2"
                }`}
              >
                <MapIcon size={12} />
                Carte
              </button>
            </div>
          </div>

          <div className="mt-5">
            <AnnoncesFilters
              value={filters}
              onChange={setFilters}
              totalCount={annonces.length}
            />
          </div>
        </div>
      </header>

      {/* ── Split layout ── */}
      <div className="mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          {/* Carte — desktop : sticky à gauche, mobile : selon toggle */}
          <div
            className={`${mobileView === "liste" ? "hidden md:block" : ""}`}
          >
            <div className="sticky top-6 h-[calc(100vh-9rem)] min-h-[480px]">
              <AnnoncesMap biens={annonces} className="h-full" />
            </div>
          </div>

          {/* Liste — desktop : droite, mobile : selon toggle */}
          <div
            className={`${mobileView === "carte" ? "hidden md:block" : ""}`}
          >
            {isLoading && (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[340px] animate-pulse rounded-r-lg border border-line bg-bg-2"
                  />
                ))}
              </div>
            )}

            {!isLoading && annonces.length === 0 && (
              <div className="rounded-r-lg border border-line bg-card p-8 text-center">
                <h3 className="text-[15px] font-semibold text-ink">
                  Aucun bien ne correspond à tes filtres
                </h3>
                <p className="mt-2 text-[12.5px] text-muted-ink">
                  Essaie d'élargir la recherche ou de retirer un filtre.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => setFilters({ mode: "tous" })}
                >
                  Réinitialiser les filtres
                </Button>
              </div>
            )}

            {!isLoading && annonces.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {annonces.map((bien) => (
                  <AnnonceCard key={bien.id} bien={bien} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/annonces/")({
  component: AnnoncesPage,
});
