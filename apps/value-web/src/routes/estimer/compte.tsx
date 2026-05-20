// Tunnel · Étape 5 — Création compte
//
// Form email + mdp, ou Continuer avec Google. Si déjà loggé, on passe
// direct à /estimer/calcul. Mention "pas de spam, pas de CB" en footer.
//
// Pas de stepper sur cet écran (5 / 6 / 7 sont hors du parcours
// "renseigner ton bien"). On garde la wordmark en header et un retour
// possible.

import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { Wordmark } from "@/components/value/EstimationStepperLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

// Search params attendus :
// - afterAuth : 'calcul' (par défaut, depuis le tunnel) ou 'resultat'
//   (depuis le gate de /estimer/resultat).
// - bienId   : (optionnel) bien à afficher si afterAuth=resultat.
export interface CompteSearch {
  afterAuth?: "calcul" | "resultat";
  bienId?: string;
}

function validateCompteSearch(raw: Record<string, unknown>): CompteSearch {
  const afterAuth =
    raw.afterAuth === "calcul" || raw.afterAuth === "resultat"
      ? raw.afterAuth
      : undefined;
  const bienId = typeof raw.bienId === "string" ? raw.bienId : undefined;
  return { afterAuth, bienId };
}

function StepComptePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const {
    isAuthenticated,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
  } = useAuth();
  const [mode, setMode] = React.useState<"signup" | "login">("signup");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Décide la destination post-auth selon le contexte d'arrivée.
  function goAfterAuth() {
    if (search.afterAuth === "resultat" && search.bienId) {
      void navigate({
        to: "/estimer/resultat",
        search: { id: search.bienId },
      });
      return;
    }
    // Défaut tunnel : on enchaîne sur le calcul streaming (qui fait
    // l'appel à value-estimer maintenant que l'user est authentifié).
    void navigate({ to: "/estimer/calcul" });
  }

  // Si déjà loggé en arrivant → on saute l'écran. `goAfterAuth` n'est
  // volontairement pas dans deps : on n'a besoin de réagir qu'au flip
  // de l'état auth (et `goAfterAuth` lit `search` à chaque appel).
  const goRef = React.useRef(goAfterAuth);
  goRef.current = goAfterAuth;
  React.useEffect(() => {
    if (isAuthenticated) {
      goRef.current();
    }
  }, [isAuthenticated]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const data = await signUpWithPassword(email.trim(), password);
        // Si Supabase exige une confirmation email, on bascule sur la
        // page d'attente — l'user reviendra via /auth/callback.
        if (data.session === null) {
          const nextPath =
            search.afterAuth === "resultat" && search.bienId
              ? `/estimer/resultat?id=${encodeURIComponent(search.bienId)}`
              : "/estimer/calcul";
          void navigate({
            to: "/auth/verifier-email",
            search: { email: email.trim(), next: nextPath } as never,
          });
          return;
        }
      } else {
        await signInWithPassword(email.trim(), password);
      }
      goAfterAuth();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Une erreur est survenue.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      // Redirection OAuth — la suite se passe dans /auth/callback puis
      // on atterrit sur /biens par défaut. Pour préserver le tunnel, on
      // devra à terme passer `next` au callback — V1 : l'user revient
      // sur /biens et peut relancer une estimation s'il le souhaite.
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Connexion Google indisponible.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <main
      className={cn(
        "min-h-screen bg-bg",
        "[background-image:radial-gradient(700px_400px_at_85%_0%,rgba(217,119,87,0.06),transparent_60%)]",
      )}
    >
      <header className="border-b border-line/60 bg-bg/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-6 sm:px-8">
          <Wordmark />
          <Link
            to="/estimer/liens-comparables"
            className="rounded-full border border-line px-3 py-1 text-[12px] text-mute-2 no-underline hover:text-ink"
          >
            ← Retour
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[460px] px-6 pb-20 pt-16 sm:px-8">
        <Eyebrow variant="terra">Étape finale · ton estimation</Eyebrow>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4.2vw,2.75rem)] italic font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
          Plus qu&rsquo;un{" "}
          <span className="not-italic font-sans font-semibold">pas.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-[1.55] text-muted-ink">
          On garde ton estimation à ton nom — c&rsquo;est aussi ce qui te
          permettra de suivre ta valeur dans le temps, gratuitement.
        </p>

        {/* CTA Google */}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="mt-7 w-full justify-center"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          Continuer avec Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-[11.5px] uppercase tracking-[0.1em] text-mute-2">
          <span className="h-px flex-1 bg-line" />
          ou
          <span className="h-px flex-1 bg-line" />
        </div>

        {/* Form email + mdp */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="iv-email"
              className="block text-[12px] font-medium text-mute-2"
            >
              Email
            </label>
            <div className="relative">
              <Mail
                aria-hidden
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-2"
                strokeWidth={2}
              />
              <input
                id="iv-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@exemple.fr"
                className="h-11 w-full rounded-r border border-line bg-card pl-10 pr-3 text-[14px] text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="iv-password"
              className="block text-[12px] font-medium text-mute-2"
            >
              Mot de passe
            </label>
            <div className="relative">
              <Lock
                aria-hidden
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-2"
                strokeWidth={2}
              />
              <input
                id="iv-password"
                type="password"
                required
                minLength={8}
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="h-11 w-full rounded-r border border-line bg-card pl-10 pr-3 text-[14px] text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-r border border-destructive/30 bg-destructive-soft px-3 py-2 text-[12.5px] text-destructive-soft-foreground">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="terra"
            size="lg"
            className="w-full justify-center"
            disabled={loading}
          >
            {mode === "signup" ? "Créer mon compte" : "Se connecter"}
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </form>

        {/* Bascule signup ↔ login */}
        <p className="mt-5 text-center text-[13px] text-muted-ink">
          {mode === "signup" ? (
            <>
              Déjà inscrit ?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-violet hover:text-violet-deep"
              >
                Connecte-toi
              </button>
            </>
          ) : (
            <>
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-violet hover:text-violet-deep"
              >
                Crée le tien
              </button>
            </>
          )}
        </p>

        {/* Footer rassurant */}
        <div className="mt-10 flex items-start gap-3 rounded-r border border-line bg-card p-4 text-[12.5px] text-mute-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sage-2" strokeWidth={2} />
          <span>
            Pas de spam, pas de carte bleue. Ton estimation reste gratuite,
            partageable et exportable.
          </span>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  // SVG inline Google (couleurs officielles).
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-4 w-4"
    >
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.13 2.74-2.4 3.58v2.97h3.86c2.26-2.09 3.59-5.17 3.59-8.79z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.97c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.07A11.997 11.997 0 0 0 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.32a7.2 7.2 0 0 1 0-4.65V6.6H1.29a12.001 12.001 0 0 0 0 10.8l3.98-3.08z"/>
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.81l3.42-3.42C17.95 1.13 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.6l3.98 3.07C6.22 6.88 8.87 4.77 12 4.77z"/>
    </svg>
  );
}

export const Route = createFileRoute("/estimer/compte")({
  component: StepComptePage,
  validateSearch: validateCompteSearch,
});
