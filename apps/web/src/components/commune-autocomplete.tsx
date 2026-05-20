// CommuneAutocomplete — combobox autocomplete pour la saisie d'une
// commune française. Powered by geo.api.gouv.fr (INSEE).
//
// Au pick d'une commune, on remplit aussi le code postal (si une seule
// option, sinon on prend le premier) et on expose la commune complète
// via `onSelect` pour permettre au parent d'enrichir les filtres
// (département, centre géo, etc.).
//
// Implémentation à la main (pas de dépendance) :
// - Debounce 250ms côté search
// - Keyboard nav : ↑↓ Enter Escape
// - Click outside pour fermer
// - Annonce ARIA pour screen readers

import { Loader2, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { type Commune, searchCommunes } from "@/lib/commune-search";

type Props = {
  value: string;
  onChange: (val: string) => void;
  onSelect: (commune: Commune) => void;
  placeholder?: string;
  /** ID du champ pour aria-labelledby */
  id?: string;
  autoFocus?: boolean;
};

export function CommuneAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Gagny",
  id,
  autoFocus,
}: Props) {
  const [options, setOptions] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (value.trim().length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      const results = await searchCommunes(value, 8);
      setOptions(results);
      setLoading(false);
      setActive(0);
      // Ouvre la liste dès que les résultats arrivent si le champ a le
      // focus (sinon on respecte l'intent user qui aurait blur).
      if (results.length > 0 && document.activeElement === inputRef.current) {
        setOpen(true);
      }
    }, 250);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [value]);

  // Click outside pour fermer
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(commune: Commune) {
    onChange(commune.nom);
    onSelect(commune);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || options.length === 0) {
      if (e.key === "ArrowDown" && options.length > 0) {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setActive((i) => Math.min(i + 1, options.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setActive((i) => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter") {
      const selected = options[active];
      if (selected) {
        pick(selected);
        e.preventDefault();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (options.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id ? `${id}-listbox` : undefined}
          role="combobox"
          className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 py-2 text-[14px] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {open && options.length > 0 ? (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="absolute z-50 mt-1 max-h-[280px] w-full overflow-auto rounded-md border border-border bg-popover shadow-lvl-2"
        >
          {options.map((c, i) => (
            <li
              key={c.code}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                // mousedown plutôt que click car click déclenche le blur
                // de l'input avant et fait disparaître la liste
                e.preventDefault();
                pick(c);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-[13px] transition-colors ${
                i === active ? "bg-secondary" : "hover:bg-secondary/50"
              }`}
            >
              <span className="font-medium">{c.nom}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {c.codesPostaux[0]}
                {c.codesPostaux.length > 1
                  ? ` +${c.codesPostaux.length - 1}`
                  : ""}{" "}
                · {c.codeDepartement}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
