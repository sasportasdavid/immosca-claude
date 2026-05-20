// SearchCriteriaChips — affiche les caractéristiques d'une recherche
// en petits badges. Deux modes :
//
// 1. Mode "filters" (analyses post-migration dltik) : on reçoit
//    `searchFilters` (objet structuré) et on rend directement.
// 2. Mode "URL legacy" (analyses pré-migration) : on parse l'URL
//    avec parseSearchUrl.
//
// Fallback URL raccourcie si on n'arrive ni à parser ni à lire les filtres.

import { parseSearchUrl, type SearchCriterion } from "@/lib/parse-search-url";

type Props = {
  sourceUrl?: string | null;
  sourceSite?: string;
  /** Filtres structurés (format PigeImmoFilters) si analyse créée via form. */
  searchFilters?: Record<string, unknown> | null;
  /** Variant compact pour la liste analyses (badges plus petits). */
  compact?: boolean;
};

function fmtEur(n: number): string {
  return `${n.toLocaleString("fr-FR")} €`;
}

function chipsFromFilters(
  filters: Record<string, unknown>,
): SearchCriterion[] {
  const out: SearchCriterion[] = [];

  // Transaction
  const transaction = filters.transaction;
  if (transaction === "buy") out.push({ label: "Projet", value: "Achat" });
  else if (transaction === "rent")
    out.push({ label: "Projet", value: "Location" });

  // Type de bien
  const types = filters.propertyTypes as string[] | undefined;
  if (types?.length) {
    const labels = types
      .map((t) =>
        t === "appartement"
          ? "Appartement"
          : t === "maison"
            ? "Maison"
            : t === "terrain"
              ? "Terrain"
              : t === "immeuble"
                ? "Immeuble"
                : t,
      )
      .join(", ");
    out.push({ label: "Type", value: labels });
  }

  // Localité (ville prioritaire, sinon CP)
  const cities = filters.cities as string[] | undefined;
  const postalCodes = filters.postalCodes as string[] | undefined;
  if (cities?.length) {
    out.push({ label: "Ville", value: cities.join(", ") });
  } else if (postalCodes?.length) {
    out.push({ label: "Code postal", value: postalCodes.join(", ") });
  }

  // Prix
  const priceMin = filters.priceMin as number | null | undefined;
  const priceMax = filters.priceMax as number | null | undefined;
  if (priceMin && priceMax) {
    out.push({ label: "Prix", value: `${fmtEur(priceMin)} – ${fmtEur(priceMax)}` });
  } else if (priceMax) {
    out.push({ label: "Prix max", value: fmtEur(priceMax) });
  } else if (priceMin) {
    out.push({ label: "Prix min", value: fmtEur(priceMin) });
  }

  // Surface
  const surfaceMin = filters.surfaceMin as number | null | undefined;
  const surfaceMax = filters.surfaceMax as number | null | undefined;
  if (surfaceMin && surfaceMax) {
    out.push({ label: "Surface", value: `${surfaceMin} – ${surfaceMax} m²` });
  } else if (surfaceMin) {
    out.push({ label: "Surface min", value: `${surfaceMin} m²` });
  } else if (surfaceMax) {
    out.push({ label: "Surface max", value: `${surfaceMax} m²` });
  }

  // Sources (compact : juste un compteur si plusieurs)
  const sources = filters.sources as string[] | undefined;
  if (sources?.length && sources.length < 5) {
    out.push({
      label: "Sources",
      value: sources
        .map((s) => (s === "logic-immo" ? "Logic-immo" : s.charAt(0).toUpperCase() + s.slice(1)))
        .join(", "),
    });
  }

  return out;
}

export function SearchCriteriaChips({
  sourceUrl,
  sourceSite,
  searchFilters,
  compact,
}: Props) {
  let criteria: SearchCriterion[] = [];
  if (searchFilters && Object.keys(searchFilters).length > 0) {
    criteria = chipsFromFilters(searchFilters);
  } else if (sourceUrl && sourceSite) {
    criteria = parseSearchUrl(sourceUrl, sourceSite);
  }

  if (criteria.length === 0) {
    if (sourceUrl) {
      return (
        <p
          className={`font-mono ${compact ? "text-[11px]" : "text-[12px]"} text-muted-foreground line-clamp-1`}
          title={sourceUrl}
        >
          {sourceUrl}
        </p>
      );
    }
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[11px]" : "text-[12px]"}`}
    >
      {criteria.map((c) => (
        <span
          key={`${c.label}-${c.value}`}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-secondary-foreground"
        >
          <span className="text-muted-foreground">{c.label}</span>
          <span className="font-medium">{c.value}</span>
        </span>
      ))}
    </div>
  );
}
