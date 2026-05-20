// AddressAutocompleteInput — Input adresse avec dropdown BAN.
//
// Composant Design pur : pas d'appel réseau ici, pas de hook data. On
// branche le hook `useBanAutocomplete` au-dessus, on passe les suggestions
// via props. Le composant gère uniquement :
// - layout input + icône MapPin
// - dropdown listbox accessible (ARIA roles, keyboard nav)
// - sélection clavier (ArrowUp/Down, Enter, Escape)
// - état hover et focus visuel
//
// Note design : pour ImmoValue, l'accent est `terra` (cohérent avec le
// reste du produit). Hover/active sur les items utilise `terra-soft`.

import { Loader2, MapPin } from "lucide-react";
import * as React from "react";

import type { BanSuggestion } from "@/hooks/use-ban-autocomplete";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────────────

export interface AddressAutocompleteInputProps {
  /** Valeur courante de l'input (string libre). */
  value: string;
  /** Callback quand l'utilisateur tape. */
  onChange: (text: string) => void;
  /**
   * Callback quand l'utilisateur sélectionne une suggestion BAN (click ou
   * Enter sur un item). Le parent doit committer la suggestion dans son state
   * (lat/lng + meta).
   */
  onSelectSuggestion: (suggestion: BanSuggestion) => void;
  /** Liste de suggestions (passées par le parent via useBanAutocomplete). */
  suggestions: BanSuggestion[];
  /** Loader actif pendant le fetch BAN. */
  isLoading?: boolean;
  /** Erreur réseau / API BAN. On dégrade le dropdown gracieusement. */
  error?: Error | null;
  /** Placeholder de l'input. */
  placeholder?: string;
  /** Auto focus à l'apparition (utile sur la landing). */
  autoFocus?: boolean;
  /** ID HTML (pour `<label htmlFor>`). */
  id?: string;
  className?: string;
  /** Classes supplémentaires appliquées à l'input lui-même. */
  inputClassName?: string;
  /** Permet d'ajouter du contenu à droite de l'input (ex: bouton clear). */
  rightSlot?: React.ReactNode;
  /** Permet au parent de réagir à Enter quand aucun item n'est mis en avant. */
  onSubmitFreeText?: () => void;
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function typeBadgeLabel(type: BanSuggestion["type"]): string {
  switch (type) {
    case "housenumber":
      return "Numéro";
    case "street":
      return "Rue";
    case "locality":
      return "Lieu-dit";
    case "municipality":
      return "Commune";
  }
}

// ────────────────────────────────────────────────────────────────────
// Composant
// ────────────────────────────────────────────────────────────────────

export function AddressAutocompleteInput({
  value,
  onChange,
  onSelectSuggestion,
  suggestions,
  isLoading = false,
  error = null,
  placeholder = "Numéro, rue, ville, code postal",
  autoFocus = false,
  id,
  className,
  inputClassName,
  rightSlot,
  onSubmitFreeText,
}: AddressAutocompleteInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();

  // Quand la liste change, on remet l'index actif sur le premier item.
  React.useEffect(() => {
    setActiveIndex(suggestions.length > 0 ? 0 : -1);
  }, [suggestions]);

  function commitSuggestion(s: BanSuggestion) {
    onChange(s.label);
    onSelectSuggestion(s);
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setIsOpen(true);
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length === 0) return;
      setIsOpen(true);
      setActiveIndex((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1,
      );
      return;
    }
    if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        commitSuggestion(suggestions[activeIndex]);
        return;
      }
      // Pas de suggestion mise en avant : on laisse le form submit
      // naturellement, mais le parent peut intercepter pour résoudre
      // l'adresse libre via `resolveBanAddress`.
      onSubmitFreeText?.();
      return;
    }
    if (e.key === "Escape") {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    }
  }

  const showDropdown =
    isOpen && (suggestions.length > 0 || isLoading || error !== null);

  return (
    <div className={cn("relative", className)}>
      <MapPin
        aria-hidden
        className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-mute-2"
        strokeWidth={2}
      />
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 && suggestions[activeIndex]
            ? `${listboxId}-opt-${activeIndex}`
            : undefined
        }
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Délai pour laisser le click (onMouseDown) sur un item commit.
          window.setTimeout(() => setIsOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-[60px] w-full rounded-r-lg border border-line-2 bg-card pl-13 pr-12 text-[15.5px] text-ink shadow-lvl-1",
          "placeholder:text-mute-2",
          "focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra",
          inputClassName,
        )}
        style={{ paddingLeft: 52 }}
      />

      {/* Loader / right slot — affichés mutuellement exclusivement, le rightSlot a la priorité */}
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {isLoading && !rightSlot && (
          <Loader2
            aria-hidden
            className="h-4 w-4 animate-spin text-mute-2"
            strokeWidth={2}
          />
        )}
        {rightSlot}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-r-lg border border-line bg-card p-1.5 shadow-lvl-2",
            "max-h-[320px] overflow-y-auto",
          )}
        >
          {error && suggestions.length === 0 && !isLoading && (
            <li className="px-3 py-2.5 text-[12.5px] text-mute-2">
              Autocomplete indisponible — continue ta saisie, tu pourras valider
              l&rsquo;adresse libre.
            </li>
          )}

          {!error && isLoading && suggestions.length === 0 && (
            <li className="flex items-center gap-2 px-3 py-2.5 text-[13px] text-mute-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
              Recherche en cours…
            </li>
          )}

          {suggestions.map((s, i) => {
            const isActive = i === activeIndex;
            return (
              <li
                key={s.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={isActive}
              >
                <button
                  type="button"
                  // onMouseDown pour devancer le onBlur de l'input.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitSuggestion(s);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-r-sm px-3 py-2.5 text-left text-[13.5px] transition-colors",
                    isActive
                      ? "bg-terra-soft text-terra-deep"
                      : "text-ink-2 hover:bg-bg-2",
                  )}
                >
                  <MapPin
                    aria-hidden
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-terra" : "text-mute-2",
                    )}
                    strokeWidth={2}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.label}</span>
                    {s.context && (
                      <span className="block truncate text-[11.5px] text-mute-2">
                        {s.context}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-r-xs px-1.5 py-0.5 font-mono text-[10px]",
                      isActive
                        ? "bg-terra/20 text-terra-deep"
                        : "bg-bg-2 text-mute-2",
                    )}
                  >
                    {typeBadgeLabel(s.type)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
