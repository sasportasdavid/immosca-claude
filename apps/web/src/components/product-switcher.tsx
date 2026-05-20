// ProductSwitcher — bascule entre les deux produits ImmoScan / ImmoValue.
//
// Mode Design (composant présentationnel pur) : reçoit le produit courant
// en prop et résout les URLs vers l'autre produit via variables d'env Vite.
//
// Utilisé en haut de :
//   - apps/web/src/components/app-shell.tsx (ImmoScan sidebar)
//   - apps/value-web (sera importé via alias @web/components/product-switcher)
//
// L'auth Supabase est partagée entre les deux apps → l'user reste loggé
// quand il bascule d'un produit à l'autre.

import { LineChart, Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type ProductKey = "immoscan" | "immovalue";

export interface ProductSwitcherProps {
  /** Produit actif (l'autre est cliquable, l'actif est en évidence). */
  current: ProductKey;
  /** Layout. `compact` = juste 2 pills côte à côte (sidebar étroite).
   *  `default` = pills + label. */
  variant?: "default" | "compact";
}

/**
 * URLs des deux produits, résolues depuis l'env Vite.
 *
 * En dev local :
 *   VITE_IMMOSCAN_URL=http://localhost:5173
 *   VITE_IMMOVALUE_URL=http://localhost:5174
 *
 * En prod :
 *   VITE_IMMOSCAN_URL=https://app.immoscan.fr
 *   VITE_IMMOVALUE_URL=https://value.immoscan.fr
 */
function getProductUrls() {
  // import.meta.env disponible côté Vite. Fallback raisonnable si non set.
  const immoscan =
    (import.meta as { env?: Record<string, string> }).env?.VITE_IMMOSCAN_URL ??
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5173"
      : "https://app.immoscan.fr");
  const immovalue =
    (import.meta as { env?: Record<string, string> }).env?.VITE_IMMOVALUE_URL ??
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "http://localhost:5174"
      : "https://value.immoscan.fr");
  return { immoscan, immovalue };
}

export function ProductSwitcher({
  current,
  variant = "default",
}: ProductSwitcherProps) {
  const urls = getProductUrls();

  return (
    <div
      role="tablist"
      aria-label="Choix du produit ImmoScan ou ImmoValue"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-r-md border border-line bg-bg-2 p-0.5",
        variant === "compact" ? "text-[11px]" : "text-[12px]",
      )}
    >
      <ProductPill
        href={urls.immoscan}
        icon={<Search className="h-3 w-3 shrink-0 stroke-[1.8]" />}
        label="Scan"
        accentColor="violet"
        active={current === "immoscan"}
        variant={variant}
      />
      <ProductPill
        href={urls.immovalue}
        icon={<LineChart className="h-3 w-3 shrink-0 stroke-[1.8]" />}
        label="Value"
        accentColor="terra"
        active={current === "immovalue"}
        variant={variant}
      />
    </div>
  );
}

function ProductPill({
  href,
  icon,
  label,
  accentColor,
  active,
  variant,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accentColor: "violet" | "terra";
  active: boolean;
  variant: "default" | "compact";
}) {
  // Couleur d'accent : violet pour ImmoScan (Scan), terra pour ImmoValue (Value)
  const activeStyles =
    accentColor === "violet"
      ? "bg-violet-grad text-white shadow-lvl-1"
      : "bg-terra-grad text-white shadow-lvl-1";

  if (active) {
    return (
      <span
        role="tab"
        aria-selected="true"
        aria-current="page"
        className={cn(
          "inline-flex items-center gap-1 rounded-r-sm px-2 py-1 font-medium tracking-[-0.005em]",
          activeStyles,
        )}
      >
        {icon}
        {variant === "default" && <span>{label}</span>}
      </span>
    );
  }
  return (
    <a
      role="tab"
      aria-selected="false"
      href={href}
      // Pas de target="_blank" — on veut une vraie navigation cross-domain
      // (Supabase session cookie sera partagé si même domaine racine).
      className={cn(
        "inline-flex items-center gap-1 rounded-r-sm px-2 py-1 font-medium tracking-[-0.005em] transition-colors",
        "text-mute-2 hover:text-ink hover:bg-bg",
      )}
    >
      {icon}
      {variant === "default" && <span>{label}</span>}
    </a>
  );
}
