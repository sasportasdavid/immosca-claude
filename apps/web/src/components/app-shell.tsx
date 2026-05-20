import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cog,
  Folder,
  Home,
  KanbanSquare,
  LogOut,
  Plus,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// AppShell : sidebar 232px fixe + topbar 48px sticky + slot main.
// Chrome canonique de l'app authentifiée (handoff écrans 6 et 7).
//
// PR1 — seul "Dashboard" est navigable. "Mes analyses / Pipeline / Veilles /
// Plan" sont rendus mais en état disabled avec tooltip "Disponible bientôt"
// (décision PO : on pose le chrome final dès PR1, pas de header marketing
// horizontal sur /dashboard).
//
// Sections sidebar manquantes intentionnellement en PR1 :
// - section "Récents" : pas d'analyses encore → masquée
// - widget Plan usage : besoin du compteur d'analyses du mois → PR3
// Le slot bottom de la sidebar reste vide pour l'instant, on l'enrichira.

type Plan = "free" | "pro" | "pro_plus" | "business";

export type AppShellRoute =
  | "dashboard"
  | "analyses"
  | "pipeline"
  | "adresse"
  | "veilles"
  | "plan";

export type AppShellProps = {
  userEmail: string;
  userPlan: Plan;
  /** Route active (highlight nav item). */
  currentRoute?: AppShellRoute;
  onLogout?: () => void;
  onUpgradeClick?: () => void;
  /** Déclenche la création d'une nouvelle analyse (PR3+). */
  onNewAnalysis?: () => void;
  children: React.ReactNode;
};

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  pro: "Pro",
  pro_plus: "Pro+",
  business: "Business",
};

type NavItem = {
  id: AppShellRoute;
  label: string;
  href: string;
  icon: typeof Home;
  enabled: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: Home, enabled: true },
  { id: "analyses", label: "Mes analyses", href: "/app/analyses", icon: Folder, enabled: true },
  // "Adresse d'un lien" (/app/adresse) volontairement absent du menu :
  // la route reste accessible via URL directe pour les power users, mais
  // on évite de promouvoir un point d'entrée qui marche mal sur PAP.
  // L'enrichissement adresse est maintenant systématique côté analyse
  // (cf. listings.resolution_source + address_confidence).
  { id: "veilles", label: "Veilles", href: "/app/veilles", icon: Radar, enabled: false },
  { id: "pipeline", label: "Pipeline", href: "/app/pipeline", icon: KanbanSquare, enabled: true },
];

const BOTTOM_ITEMS: readonly NavItem[] = [
  { id: "plan", label: "Plan & facturation", href: "/app/plan", icon: Cog, enabled: false },
];

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] ?? "").toUpperCase() + (parts[1][0] ?? "").toUpperCase();
  }
  return (local.slice(0, 2) || "??").toUpperCase();
}

function SidebarItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;
  const baseClasses =
    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors w-full";

  if (!item.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled="true"
            className={cn(
              baseClasses,
              "cursor-not-allowed text-tertiary-foreground select-none",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">Disponible bientôt</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <a
      href={item.href}
      className={cn(
        baseClasses,
        isActive
          ? "bg-primary-soft text-primary"
          : "text-secondary-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{item.label}</span>
    </a>
  );
}

function Sidebar({
  currentRoute,
  onNewAnalysis,
}: {
  currentRoute?: AppShellRoute;
  onNewAnalysis?: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-border bg-card md:flex">
      {/* Logo */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
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
        <span className="font-display text-[14px] font-semibold tracking-tight">
          ImmoScan
        </span>
      </div>

      {/* CTA "Nouvelle analyse" */}
      <div className="p-3">
        <Button
          type="button"
          size="default"
          className="w-full justify-start"
          onClick={onNewAnalysis}
          disabled={!onNewAnalysis}
        >
          <Plus className="h-4 w-4" />
          Nouvelle analyse
          <kbd className="ml-auto rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 font-mono text-[10px]">
            N
          </kbd>
        </Button>
      </div>

      {/* Nav primary */}
      <nav className="flex-1 overflow-y-auto px-3 py-1">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <SidebarItem item={item} isActive={currentRoute === item.id} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-border p-3">
        <ul className="space-y-0.5">
          {BOTTOM_ITEMS.map((item) => (
            <li key={item.id}>
              <SidebarItem item={item} isActive={currentRoute === item.id} />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Topbar({
  userEmail,
  userPlan,
  onLogout,
  onUpgradeClick,
}: {
  userEmail: string;
  userPlan: Plan;
  onLogout?: () => void;
  onUpgradeClick?: () => void;
}) {
  const isFree = userPlan === "free";
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70">
      {/* Back/forward placeholders (history navigation, à câbler PR2+) */}
      <div className="flex items-center gap-1 text-tertiary-foreground">
        <button
          type="button"
          aria-label="Précédent"
          className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded transition-colors"
          disabled
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Suivant"
          className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded transition-colors"
          disabled
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Command bar ⌘K (placeholder visuel — palette en PR2 via cmdk) */}
      <button
        type="button"
        className="ml-2 inline-flex h-8 max-w-[420px] flex-1 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-[12.5px] text-tertiary-foreground transition-colors hover:bg-secondary hover:text-foreground"
        disabled
      >
        <Search className="h-3.5 w-3.5" />
        <span>Rechercher (disponible bientôt)…</span>
        <kbd className="ml-auto rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        {isFree ? (
          <Button type="button" size="sm" onClick={onUpgradeClick}>
            <Sparkles className="h-3.5 w-3.5" />
            Passer Pro
          </Button>
        ) : null}

        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded text-tertiary-foreground transition-colors"
          disabled
        >
          <Bell className="h-4 w-4" />
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
                {initialsOf(userEmail)}
              </span>
              <Badge
                variant="outline"
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
              >
                {PLAN_LABEL[userPlan]}
              </Badge>
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
      </div>
    </header>
  );
}

export function AppShell({
  userEmail,
  userPlan,
  currentRoute,
  onLogout,
  onUpgradeClick,
  onNewAnalysis,
  children,
}: AppShellProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        <Sidebar currentRoute={currentRoute} onNewAnalysis={onNewAnalysis} />
        <div className="md:pl-[232px]">
          <Topbar
            userEmail={userEmail}
            userPlan={userPlan}
            onLogout={onLogout}
            onUpgradeClick={onUpgradeClick}
          />
          <main>{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
