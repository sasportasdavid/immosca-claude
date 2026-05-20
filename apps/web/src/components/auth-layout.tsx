import { cn } from "@/lib/utils";

// Coquille pour les routes auth (/auth/login, /auth/signup, /auth/callback).
// Fond --background, logo en haut centré, slot enfant dans une card 480px,
// footer mentions optionnel. Pas de sidebar, pas de topbar app.
//
// Pour le visuel "social proof" sur la droite (cf brief Claude Design Bloc B
// non livré dans le handoff), à implémenter dans une itération design
// ultérieure : ajouter une prop `aside?: ReactNode` qui rend un second
// panneau côté droit en >=lg.

export type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function AuthLayout({
  title,
  subtitle,
  footer,
  className,
  children,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header minimaliste : logo + nom */}
      <header className="px-6 py-5">
        <a href="/" className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground"
          >
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
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
      </header>

      {/* Contenu centré */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className={cn("w-full max-w-[480px]", className)}>
          <div className="mb-8">
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.015em]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-[14px] text-muted-foreground leading-[1.5]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-lvl-1">
            {children}
          </div>
        </div>
      </main>

      {/* Footer mentions */}
      <footer className="px-6 py-6 text-center text-[12px] text-muted-foreground">
        {footer ?? (
          <span>
            <a href="/mentions-legales" className="hover:text-foreground transition-colors">
              Mentions légales
            </a>
            <span className="mx-2">·</span>
            <a href="/confidentialite" className="hover:text-foreground transition-colors">
              Confidentialité
            </a>
          </span>
        )}
      </footer>
    </div>
  );
}
