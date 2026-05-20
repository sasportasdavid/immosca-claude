import { Search } from "lucide-react";

import { Input } from "@web/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@web/components/ui/select";
import { cn } from "@/lib/utils";

import type { AnnoncesFilters as AnnoncesFiltersType, AnnonceMode } from "@/hooks/use-annonces";

// AnnoncesFilters — barre de recherche + filtres rapides en haut de la
// vitrine /annonces (handoff écran 14).
//
// Filtres exposés (V1) :
//   - Recherche libre (ville / code postal / mots-clés)
//   - Mode (tous / discret / public)
//   - Prix max (presets)
//   - Pièces (presets)
//   - DPE (presets)
//
// Le filtrage effectif est appliqué côté `useAnnonces` (queryKey inclut
// les filtres). Pas de debounce côté input pour la V1 — React Query
// gère la fraîcheur via staleTime.

export interface AnnoncesFiltersProps {
  value: AnnoncesFiltersType;
  onChange: (next: AnnoncesFiltersType) => void;
  className?: string;
  totalCount?: number;
}

const PRIX_MAX_OPTIONS = [
  { value: "all", label: "Tous prix" },
  { value: "200000", label: "≤ 200 k€" },
  { value: "300000", label: "≤ 300 k€" },
  { value: "400000", label: "≤ 400 k€" },
  { value: "500000", label: "≤ 500 k€" },
  { value: "750000", label: "≤ 750 k€" },
];

const PIECES_OPTIONS = [
  { value: "all", label: "Toutes pièces" },
  { value: "1", label: "≥ 1 pièce" },
  { value: "2", label: "≥ 2 pièces" },
  { value: "3", label: "≥ 3 pièces" },
  { value: "4", label: "≥ 4 pièces" },
];

const DPE_OPTIONS = [
  { value: "all", label: "Tous DPE" },
  { value: "ABC", label: "A · B · C (économe)" },
  { value: "DE", label: "D · E (moyen)" },
  { value: "FG", label: "F · G (passoire)" },
];

const MODE_OPTIONS: { value: AnnonceMode; label: string }[] = [
  { value: "tous", label: "Tous les biens" },
  { value: "discret", label: "Pré-ventes discrètes" },
  { value: "public", label: "En vente publique" },
];

function dpeGroupToLetters(group: string): string[] | undefined {
  if (group === "ABC") return ["A", "B", "C"];
  if (group === "DE") return ["D", "E"];
  if (group === "FG") return ["F", "G"];
  return undefined;
}

function dpeLettersToGroup(letters: string[] | undefined): string {
  if (!letters || letters.length === 0) return "all";
  if (letters.length === 3 && letters.every((l) => "ABC".includes(l))) return "ABC";
  if (letters.length === 2 && letters.every((l) => "DE".includes(l))) return "DE";
  if (letters.length === 2 && letters.every((l) => "FG".includes(l))) return "FG";
  return "all";
}

export function AnnoncesFilters({
  value,
  onChange,
  className,
  totalCount,
}: AnnoncesFiltersProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Barre de recherche */}
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-2"
        />
        <Input
          type="search"
          placeholder="Adresse, ville ou code postal — ex. « Gagny » ou « 93220 »"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
          className="h-11 pl-10 text-[14px]"
        />
      </div>

      {/* Filtres en row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Mode */}
        <Select
          value={value.mode ?? "tous"}
          onValueChange={(v) =>
            onChange({ ...value, mode: v as AnnonceMode })
          }
        >
          <SelectTrigger className="h-9 w-auto min-w-[160px] gap-1.5 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Prix max */}
        <Select
          value={
            value.prixMax != null ? String(value.prixMax) : "all"
          }
          onValueChange={(v) =>
            onChange({
              ...value,
              prixMax: v === "all" ? undefined : Number(v),
            })
          }
        >
          <SelectTrigger className="h-9 w-auto min-w-[130px] gap-1.5 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIX_MAX_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Pièces min */}
        <Select
          value={
            value.piecesMin != null ? String(value.piecesMin) : "all"
          }
          onValueChange={(v) =>
            onChange({
              ...value,
              piecesMin: v === "all" ? undefined : Number(v),
            })
          }
        >
          <SelectTrigger className="h-9 w-auto min-w-[140px] gap-1.5 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PIECES_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* DPE */}
        <Select
          value={dpeLettersToGroup(value.dpe)}
          onValueChange={(v) =>
            onChange({ ...value, dpe: dpeGroupToLetters(v) })
          }
        >
          <SelectTrigger className="h-9 w-auto min-w-[150px] gap-1.5 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Compteur de résultats */}
        {typeof totalCount === "number" && (
          <div className="ml-auto text-[12.5px] text-mute-2">
            <strong className="font-medium text-ink tabular-nums">
              {totalCount}
            </strong>{" "}
            bien{totalCount > 1 ? "s" : ""} trouvé{totalCount > 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
