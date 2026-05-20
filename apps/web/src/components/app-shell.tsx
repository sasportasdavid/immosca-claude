import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Heart,
  Home,
  KanbanSquare,
  LogOut,
  Plus,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";

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

// AppShell — chrome canonique de l'app authentifiée (handoff Phase 2).
// Sidebar 232px fixe + topbar 48px sticky + slot main.
// Re-skin tokens stone/violet : voir Dashboard.html / Veilles.html handoff.
//
// Layout handoff :
// - Sidebar : bg-bg (#FAFAF9), border-r line, sections "Travail" / "À venir"
// - Logo : mark violet-grad 22×22 avec "I" blanc + "Immoscan" + point violet
// - CTA "Nouvelle analyse" : violet-grad sticky en haut de la sidebar
// - Plan widget : bloc violet-soft gradient en bas de sidebar (Pro/Pro+/Business)
// - Topbar : back/forward chevrons + cmdK placeholder + user cluster (avatar + plan badge)
//
// Active state nav : bg-bg-2 + text-ink + icon violet (pas border-l, c'est la
// version handoff actuelle — voir lignes 28-32 de Dashboard.html).

type Plan = "free" | "pro" | "pro_plus" | "business";

export type AppShellRoute =
  | "dashboard"
  | "analyses"
  | "pipeline"
  | "adresse"
  | "veilles"
  | "plan"
  | "billing";

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
  { id: "pipeline", label: "Pipeline", href: "/app/pipeline", icon: KanbanSquare, enabled: true },
];

const COMING_ITEMS: readonly NavItem[] = [
  { id: "veilles", label: "Veilles", href: "/app/veilles", icon: Radar, enabled: true },
];

const BOTTOM_ITEMS: readonly NavItem[] = [
  { id: "billing", label: "Plan & facturation", href: "/app/billing", icon: Heart, enabled: true },
];

function initialsOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] ?? "").toUpperCase() + (parts[1][0] ?? "").toUpperCase();
  }
  return (local.slice(0, 2) || "??").toUpperCase();
}

function nameOf(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts[0]) {
    const first = parts[0]!;
    const last = parts[1];
    const capFirst = first.charAt(0).toUpperCase() + first.slice(1);
    if (last) return `${capFirst} ${last.charAt(0).toUpperCase()}.`;
    return capFirst;
  }
  return email;
}

function SidebarItem({
  item,
  isActive,
}: {
  item: NavItem;
  isActive: boolean;
}) {
  const Icon = item.icon;
  // .sb-link handoff : h-30, padding 0 10px, rounded r-sm, gap 10px, text 13px
  const baseClasses =
    "flex items-center gap-2.5 h-[30px] px-2.5 rounded-r-sm text-[13px] font-normal tracking-[-0.005em] transition-colors w-full";

  if (!item.enabled) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            aria-disabled="true"
            className={cn(baseClasses, "cursor-not-allowed text-faint select-none")}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 stroke-[1.8]" />
            <span className="flex-1">{item.label}</span>
            <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-faint">
              Bientôt
            </span>
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
        "[&>svg]:text-mute-2",
        isActive
          ? "bg-bg-2 text-ink font-medium [&>svg]:text-violet"
          : "text-muted-ink hover:bg-bg-2 hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 stroke-[1.8]" />
      <span className="flex-1">{item.label}</span>
    </a>
  );
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="mt-[18px] px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-mute-2">
      {label}
    </div>
  );
}

function PlanWidget({ userPlan }: { userPlan: Plan }) {
  // Bloc "Plan Pro" handoff : violet-soft gradient + border violet 18% + r
  // Affiché uniquement pour les plans payants (Free a son CTA "Passer Pro" dans la topbar)
  if (userPlan === "free") return null;
  const planLabel = PLAN_LABEL[userPlan];
  return (
    <div
      className={cn(
        "mt-2 rounded-r p-3",
        "border border-violet/20",
        "bg-gradient-to-b from-violet-soft to-violet-soft/40",
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.04em] text-violet-deep">
        Plan {planLabel}
      </div>
      <div className="mt-1.5 text-[12px] leading-[1.4] text-ink-2">
        <span className="font-mono">8/10</span> analyses ·{" "}
        <span className="font-mono">3/3</span> veilles
        <br />
        Renouvellement le 28 mai.
      </div>
    </div>
  );
}

function BrandLogo() {
  // .sb-brand handoff : mark violet-grad 22×22 + nom Immoscan + dot violet
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-[14px] font-semibold tracking-[-0.012em] text-ink">
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-[22px] w-[22px] items-center justify-center rounded-r-sm",
          "bg-violet-grad text-white text-[12px] font-bold",
          "shadow-lvl-1",
        )}
        style={{ boxShadow: "var(--lvl-1), inset 0 1px 0 rgba(255,255,255,0.25)" }}
      >
        I
      </span>
      <span>
        Immoscan
        <span className="ml-[-3px] font-bold text-violet">.</span>
      </span>
    </div>
  );
}

function Sidebar({
  currentRoute,
  onNewAnalysis,
  userPlan,
}: {
  currentRoute?: AppShellRoute;
  onNewAnalysis?: () => void;
  userPlan: Plan;
}) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col px-3 py-3.5 md:flex",
        "bg-bg border-r border-line",
      )}
    >
      {/* Logo */}
      <BrandLogo />

      {/* CTA "Nouvelle analyse" — violet-grad, h-32, kbd N à droite */}
      <button
        type="button"
        onClick={onNewAnalysis}
        disabled={!onNewAnalysis}
        className={cn(
          "mt-4 mb-1.5 flex h-8 items-center gap-2 px-2.5",
          "rounded-r-sm bg-violet-grad text-white",
          "text-[12.5px] font-medium",
          "shadow-lvl-1",
          "transition-shadow hover:shadow-lvl-2",
          "focus-visible:outline-none focus-visible:shadow-ring-violet",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
        style={{ boxShadow: "var(--lvl-1), inset 0 1px 0 rgba(255,255,255,0.18)" }}
      >
        <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
        <span>Nouvelle analyse</span>
        <kbd
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded-[3px]",
            "font-mono text-[10px]",
            "bg-white/20 border border-white/20 text-white",
          )}
        >
          N
        </kbd>
      </button>

      {/* Section "Travail" */}
      <SidebarSection label="Travail" />
      <nav className="flex flex-col gap-px">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.id} item={item} isActive={currentRoute === item.id} />
        ))}
      </nav>

      {/* Section "À venir" */}
      <SidebarSection label="À venir" />
      <nav className="flex flex-col gap-px">
        {COMING_ITEMS.map((item) => (
          <SidebarItem key={item.id} item={item} isActive={currentRoute === item.id} />
        ))}
        {BOTTOM_ITEMS.map((item) => (
          <SidebarItem key={item.id} item={item} isActive={currentRoute === item.id} />
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Plan widget en bas */}
      <PlanWidget userPlan={userPlan} />
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
  const initials = initialsOf(userEmail);
  const displayName = nameOf(userEmail);
  const planLabel = PLAN_LABEL[userPlan].toUpperCase();

  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex h-12 items-center gap-2 px-4",
        "bg-bg/85 backdrop-blur",
        "border-b border-line",
        "supports-[backdrop-filter]:bg-bg/70",
      )}
    >
      {/* Back/forward — placeholders (history navigation, à câbler PR2+) */}
      <button
        type="button"
        aria-label="Précédent"
        className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center text-faint"
        disabled
      >
        <ChevronLeft className="h-3.5 w-3.5 stroke-[2]" />
      </button>
      <button
        type="button"
        aria-label="Suivant"
        className="inline-flex h-7 w-7 cursor-not-allowed items-center justify-center text-faint"
        disabled
      >
        <ChevronRight className="h-3.5 w-3.5 stroke-[2]" />
      </button>

      {/* Command bar ⌘K (palette en PR2 via cmdk) */}
      <button
        type="button"
        className={cn(
          "ml-1 inline-flex h-7 max-w-[480px] flex-1 items-center gap-2 px-2.5",
          "rounded-r-sm bg-bg-2 border border-line",
          "text-[12.5px] text-mute-2",
          "transition-colors hover:bg-bg-3",
          "disabled:cursor-not-allowed",
        )}
        disabled
      >
        <Search className="h-3 w-3" />
        <span className="flex-1 text-left">Rechercher · bientôt disponible</span>
        <kbd
          className={cn(
            "rounded-[3px] border border-line bg-bg px-1.5 py-0.5",
            "font-mono text-[10px] text-mute-2",
          )}
        >
          ⌘ K
        </kbd>
      </button>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        {isFree ? (
          <Button type="button" size="sm" onClick={onUpgradeClick}>
            <Sparkles className="h-3 w-3" />
            Passer Pro
          </Button>
        ) : null}

        <button
          type="button"
          aria-label="Notifications"
          className="relative inline-flex h-7 w-7 cursor-not-allowed items-center justify-center text-faint"
          disabled
        >
          <Bell className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-2 px-1 py-0.5 rounded-r-sm",
                "transition-colors hover:bg-bg-2",
                "focus-visible:outline-none focus-visible:shadow-ring-violet",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full",
                  "bg-violet-soft text-violet-deep",
                  "text-[11px] font-semibold",
                )}
              >
                {initials}
              </span>
              <span className="text-[12.5px] font-medium text-ink">{displayName}</span>
              <span
                className={cn(
                  "rounded-[3px] px-1.5 py-px",
                  "font-mono text-[9.5px] font-semibold tracking-[0.04em] uppercase",
                  isFree
                    ? "bg-mute-2 text-white"
                    : userPlan === "business"
                      ? "bg-terra text-white"
                      : "bg-ink text-white",
                )}
              >
                {planLabel}
              </span>
              <ChevronDown className="h-3 w-3 text-faint" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Compte</DropdownMenuLabel>
            <DropdownMenuItem disabled>
              <span className="truncate text-mute-2">{userEmail}</span>
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
  // Hidden helper class — utilisée par la version réduite mobile (sidebar
  // collapsée tablette). Côté mobile (<768px) la sidebar est masquée
  // (cf. `md:flex` sur l'aside). Burger Sheet à câbler en PR suivante si
  // besoin — pour PR1 on garde le shell desktop-first comme l'existant.
  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-bg">
        <Sidebar
          currentRoute={currentRoute}
          onNewAnalysis={onNewAnalysis}
          userPlan={userPlan}
        />
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
