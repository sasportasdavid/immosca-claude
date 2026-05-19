// SearchCriteriaChips — affiche les caractéristiques extraites de l'URL
// de recherche en petits badges. Si on n'arrive pas à parser, fallback
// sur l'URL raccourcie.

import { parseSearchUrl } from "@/lib/parse-search-url";

type Props = {
  sourceUrl: string;
  sourceSite: string;
  /** Variant compact pour la liste analyses (badges plus petits). */
  compact?: boolean;
};

export function SearchCriteriaChips({ sourceUrl, sourceSite, compact }: Props) {
  const criteria = parseSearchUrl(sourceUrl, sourceSite);

  if (criteria.length === 0) {
    return (
      <p
        className={`font-mono ${compact ? "text-[11px]" : "text-[12px]"} text-muted-foreground line-clamp-1`}
        title={sourceUrl}
      >
        {sourceUrl}
      </p>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[11px]" : "text-[12px]"}`}>
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
