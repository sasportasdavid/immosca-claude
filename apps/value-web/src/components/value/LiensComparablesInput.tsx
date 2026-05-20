// LiensComparablesInput — composant clé du tunnel.
// Permet à l'utilisateur de coller 1 à 3 URLs de recherche SeLoger/Leboncoin
// pour pondérer haute leurs comparables dans l'estimation.
//
// V1 : validation regex live (vert / rouge), liste avec préview de mock,
// pas de vrai scrape live — la pondération arrive côté worker.

import { Check, Info, Plus, X } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { cn } from "@/lib/utils";

const URL_PATTERN = /^https?:\/\/(www\.)?(seloger\.com|leboncoin\.fr)\/.+/i;

export interface LiensComparablesInputProps {
  urls: string[];
  onChange: (urls: string[]) => void;
  /** Limite max d'URLs (défaut 3). */
  maxUrls?: number;
}

type Marketplace = "seloger" | "leboncoin" | "unknown";

function detectMarketplace(url: string): Marketplace {
  if (/seloger\.com/i.test(url)) return "seloger";
  if (/leboncoin\.fr/i.test(url)) return "leboncoin";
  return "unknown";
}

export function LiensComparablesInput({
  urls,
  onChange,
  maxUrls = 3,
}: LiensComparablesInputProps) {
  const [input, setInput] = React.useState("");

  const trimmed = input.trim();
  const isValid = trimmed.length > 0 && URL_PATTERN.test(trimmed);
  const isInvalid = trimmed.length > 0 && !isValid;
  const reachedMax = urls.length >= maxUrls;

  function handleAdd() {
    if (!isValid || reachedMax) return;
    if (urls.includes(trimmed)) {
      setInput("");
      return;
    }
    onChange([...urls, trimmed]);
    setInput("");
  }

  function handleRemove(url: string) {
    onChange(urls.filter((u) => u !== url));
  }

  return (
    <div className="space-y-4">
      {/* Label + compteur */}
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-medium text-ink">
          Colle ici 1 à {maxUrls} liens de recherche SeLoger ou Leboncoin
        </span>
        <span className="ml-auto font-mono text-[12px] text-mute-2">
          <span
            className={cn(
              "font-semibold",
              urls.length > 0 ? "text-terra-deep" : "text-mute-2",
            )}
          >
            {urls.length}
          </span>{" "}
          / {maxUrls} ajoutés
        </span>
      </div>

      {/* Input + bouton Ajouter */}
      <div className="grid grid-cols-[1fr_auto] gap-2.5">
        <div className="relative">
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            placeholder="https://www.seloger.com/list.htm?..."
            disabled={reachedMax}
            className={cn(
              "h-[52px] w-full rounded-r-lg border bg-card px-4 font-mono text-[13px] text-ink",
              "placeholder:text-faint",
              "transition-colors focus-visible:outline-none",
              isValid &&
                "border-sage pr-10 focus-visible:shadow-[0_0_0_3px_rgba(124,152,133,0.20)]",
              isInvalid &&
                "border-destructive bg-destructive-soft focus-visible:shadow-[0_0_0_3px_rgba(220,38,38,0.18)]",
              !isValid &&
                !isInvalid &&
                "border-line focus-visible:border-terra focus-visible:shadow-ring-terra",
              reachedMax && "cursor-not-allowed opacity-50",
            )}
          />
          {isValid && (
            <Check
              aria-hidden
              className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sage"
              strokeWidth={2.5}
            />
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleAdd}
          disabled={!isValid || reachedMax}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Ajouter
        </Button>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 text-[12px] text-mute-2">
        <Info className="h-3 w-3" strokeWidth={2} />
        Copie-colle l&rsquo;URL de la page de résultats, pas l&rsquo;URL
        d&rsquo;une annonce individuelle.{" "}
        <span className="rounded border border-line bg-bg-2 px-1.5 py-px font-mono text-[10.5px] text-ink-2">
          ↵
        </span>{" "}
        pour ajouter rapidement.
      </div>

      {/* Liste des URLs ajoutées */}
      {urls.length > 0 && (
        <ul className="space-y-2.5">
          {urls.map((url) => {
            const mp = detectMarketplace(url);
            return (
              <li
                key={url}
                className="grid grid-cols-[36px_1fr_auto_auto] items-center gap-3.5 rounded-r-lg border border-line bg-card px-4 py-3.5 transition-colors hover:border-line-2"
              >
                <MarketplaceLogo marketplace={mp} />
                <div>
                  <div className="text-[13.5px] font-medium text-ink">
                    {mp === "seloger" && "Recherche SeLoger"}
                    {mp === "leboncoin" && "Recherche Leboncoin"}
                    {mp === "unknown" && "Recherche"}
                    <span className="ml-2 font-normal text-mute-2">
                      · prêt à scrape
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11.5px] text-mute-2">
                    <span className="inline-block max-w-[42ch] truncate align-middle">
                      {url}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-[80px] flex-col items-end text-right">
                  <span className="font-mono text-[13.5px] font-semibold tnum text-ink">
                    ~47 biens
                  </span>
                  <span className="text-[11px] text-mute-2">à scraper</span>
                </div>
                <button
                  type="button"
                  aria-label={`Retirer ${url}`}
                  onClick={() => handleRemove(url)}
                  className="flex h-7 w-7 items-center justify-center rounded-r-sm text-faint transition-colors hover:bg-bg-2 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MarketplaceLogo({ marketplace }: { marketplace: Marketplace }) {
  const bgClass =
    marketplace === "seloger"
      ? "bg-[#F0413B]"
      : marketplace === "leboncoin"
      ? "bg-[#FF5A03]"
      : "bg-bg-3";
  const label =
    marketplace === "seloger"
      ? "SL"
      : marketplace === "leboncoin"
      ? "LBC"
      : "?";
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-r font-mono text-[11px] font-bold tracking-wide text-white",
        bgClass,
      )}
    >
      {label}
    </span>
  );
}
