import { Bell, ChevronDown, LogOut, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Plan = "free" | "pro" | "pro_plus";

// PR-DA-U3 — breadcrumb dynamique. Un crumb final sans `href` est rendu
// comme `.here` (texte foncé), les autres comme liens `.crumb a`.
export type BreadcrumbItem = {
  label: string;
  /** Si absent → segment courant (`.here`), sinon lien navigable. */
  href?: string;
};

export type AppHeaderProps = {
  userEmail: string | null;
  userPlan: Plan | null;
  onLogout?: () => void;
  onUpgradeClick?: () => void;
  /**
   * Breadcrumb dynamique affiché en seconde rangée sous la nav principale,
   * en suivant le pattern `.app-nav .crumb` du handoff DA unifiée. Composé
   * côté route via `useLocation()` ou statiquement par la page parente. Si
   * absent, la rangée breadcrumb n'est pas rendue (rétrocompat marketing /
   * pages publiques où la nav reste neutre).
   */
  breadcrumbs?: BreadcrumbItem[];
};

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
};

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] ?? "").toUpperCase() + (parts[1][0] ?? "").toUpperCase();
  }
  return (local.slice(0, 2) || "??").toUpperCase();
}

export function AppHeader({
  userEmail,
  userPlan,
  onLogout,
  onUpgradeClick,
  breadcrumbs,
}: AppHeaderProps) {
  const isAuthenticated = userEmail !== null;
  const isFree = userPlan === "free";
  const hasBreadcrumb = !!breadcrumbs && breadcrumbs.length > 0;

  return (
    <header
      className={
        // app-nav pattern (immoscan-unified.css §7) : sticky + backdrop blur +
        // border-bottom soft. Le wrapping `app-nav` est appliqué pour que les
        // classes `.crumb / .here / .sep` du CSS d'unification descendent
        // correctement.
        "app-nav sticky top-0 z-30 w-full border-b border-border bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/70"
      }
    >
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-4 px-6">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path
                d="M5 13V8.5A1.5 1.5 0 0 1 6.5 7h2A1.5 1.5 0 0 1 10 8.5V13M3 13h13M10 13v-2.5A1.5 1.5 0 0 1 11.5 9h1A1.5 1.5 0 0 1 14 10.5V13M14 13h3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            ImmoScan
          </span>
        </a>

        {/* Nav */}
        {isAuthenticated ? (
          <nav className="hidden md:flex items-center gap-1 text-[13px] text-muted-foreground">
            <a href="/dashboard" className="px-3 py-1.5 rounded-md hover:bg-secondary hover:text-foreground transition-colors">
              Dashboard
            </a>
            <a href="/analyses" className="px-3 py-1.5 rounded-md hover:bg-secondary hover:text-foreground transition-colors">
              Analyses
            </a>
            <a href="/pipeline" className="px-3 py-1.5 rounded-md hover:bg-secondary hover:text-foreground transition-colors">
              Pipeline
            </a>
            <a href="/veilles" className="px-3 py-1.5 rounded-md hover:bg-secondary hover:text-foreground transition-colors">
              Veilles
            </a>
          </nav>
        ) : null}

        {/* Search (auth only) */}
        {isAuthenticated ? (
          <button
            type="button"
            className="ml-auto hidden lg:inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Rechercher…</span>
            <kbd className="ml-1 rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        ) : (
          <div className="ml-auto" />
        )}

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          {isFree && isAuthenticated ? (
            <Button
              type="button"
              size="sm"
              onClick={onUpgradeClick}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Passer Pro
            </Button>
          ) : null}

          {isAuthenticated ? (
            <>
              <button
                type="button"
                aria-label="Notifications"
                className="relative inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-md border-l border-border pl-3 pr-1 py-1 transition-colors hover:bg-secondary"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground"
                    >
                      {initialsOf(userEmail ?? "")}
                    </span>
                    {userPlan ? (
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-[0.08em]">
                        {PLAN_LABEL[userPlan]}
                      </Badge>
                    ) : null}
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Compte</DropdownMenuLabel>
                  <DropdownMenuItem disabled>
                    <span className="truncate text-muted-foreground">{userEmail}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout} disabled={!onLogout}>
                    <LogOut className="h-3.5 w-3.5" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <a href="/auth/login">Connexion</a>
              </Button>
              <Button asChild size="sm">
                <a href="/auth/signup">S'inscrire</a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Seconde rangée — breadcrumb dynamique `.crumb` (pattern app-nav du
          handoff). Rendue uniquement si la page parente fournit `breadcrumbs`.
          Voir docs/design-integration.md pour le contrat composeur. */}
      {hasBreadcrumb ? (
        <div className="border-t border-line bg-bg/60">
          <div className="mx-auto flex h-9 max-w-[1280px] items-center px-6">
            <nav aria-label="Fil d'Ariane" className="crumb text-[12px]">
              {breadcrumbs.map((item, i) => {
                const isLast = i === breadcrumbs.length - 1;
                const isCurrent = isLast || !item.href;
                return (
                  <span key={`${item.label}-${i}`} className="inline-flex items-baseline">
                    {isCurrent ? (
                      <span className="here text-ink font-medium">{item.label}</span>
                    ) : (
                      <a
                        href={item.href}
                        className="text-muted-foreground hover:text-ink transition-colors"
                      >
                        {item.label}
                      </a>
                    )}
                    {!isLast ? (
                      <span className="sep mx-2 text-faint" aria-hidden>
                        ›
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
