// /auth/signup — page d'inscription ImmoValue.
//
// Form email + mdp + confirm + CGU. Inscription Supabase ; selon la config
// remote, l'user reçoit un email de confirmation (redirige sur
// /auth/verifier-email) ou est connecté direct (redirige sur `next`).

import {
  Link,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";
import { ArrowRight, Lock, Mail, ShieldCheck } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { Wordmark } from "@/components/value/EstimationStepperLayout";
import { useAuth } from "@/hooks/use-auth";
import { redirectIfAuthenticated } from "@/lib/auth-guards";
import { cn } from "@/lib/utils";

export interface SignupSearch {
  next?: string;
}

function validateSearch(raw: Record<string, unknown>): SignupSearch {
  const next = typeof raw.next === "string" ? raw.next : undefined;
  return { next };
}

function SignupPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { signUpWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [acceptCgu, setAcceptCgu] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const nextPath = search.next && search.next.startsWith("/") ? search.next : "/biens";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    if (!acceptCgu) {
      setError("Tu dois accepter les conditions générales pour créer un compte.");
      return;
    }
    setLoading(true);
    try {
      const data = await signUpWithPassword(email.trim(), password);
      // Si Supabase exige une confirmation email, `session` sera null —
      // on bascule vers la page d'attente. Sinon on enchaîne sur `next`.
      if (data.session === null) {
        void navigate({
          to: "/auth/verifier-email",
          search: { email: email.trim(), next: nextPath } as never,
        });
        return;
      }
      void navigate({ to: nextPath as never });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Inscription impossible.";
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Inscription Google indisponible.";
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
            to="/"
            className="rounded-full border border-line px-3 py-1 text-[12px] text-mute-2 no-underline hover:text-ink"
          >
            ← Accueil
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[460px] px-6 pb-20 pt-16 sm:px-8">
        <Eyebrow variant="terra">Crée ton compte</Eyebrow>
        <h1 className="mt-3 font-serif text-[clamp(2rem,4.2vw,2.75rem)] italic font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
          Quelques secondes,{" "}
          <span className="not-italic font-sans font-semibold">c&rsquo;est tout.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-[1.55] text-muted-ink">
          Gratuit, sans carte bleue, sans engagement. Tu pourras suivre
          plusieurs biens depuis ton tableau de bord.
        </p>

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="iv-signup-email"
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
                id="iv-signup-email"
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
              htmlFor="iv-signup-password"
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
                id="iv-signup-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
                className="h-11 w-full rounded-r border border-line bg-card pl-10 pr-3 text-[14px] text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="iv-signup-confirm"
              className="block text-[12px] font-medium text-mute-2"
            >
              Confirme le mot de passe
            </label>
            <div className="relative">
              <Lock
                aria-hidden
                className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-2"
                strokeWidth={2}
              />
              <input
                id="iv-signup-confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retape le même"
                className="h-11 w-full rounded-r border border-line bg-card pl-10 pr-3 text-[14px] text-ink focus-visible:border-terra focus-visible:outline-none focus-visible:shadow-ring-terra"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-[12.5px] text-muted-ink">
            <input
              type="checkbox"
              checked={acceptCgu}
              onChange={(e) => setAcceptCgu(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-terra"
            />
            <span>
              J&rsquo;accepte les{" "}
              <a href="#" className="text-terra no-underline hover:text-terra-deep">
                conditions générales
              </a>{" "}
              et la{" "}
              <a href="#" className="text-terra no-underline hover:text-terra-deep">
                politique de confidentialité
              </a>
              .
            </span>
          </label>

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
            Créer mon compte
            <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted-ink">
          Déjà un compte ?{" "}
          <Link
            to="/auth/login"
            search={{ next: nextPath } as never}
            className="text-terra no-underline hover:text-terra-deep"
          >
            Connecte-toi
          </Link>
        </p>

        <div className="mt-10 flex items-start gap-3 rounded-r border border-line bg-card p-4 text-[12.5px] text-mute-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-sage-2" strokeWidth={2} />
          <span>
            Pas de spam, pas de carte bleue. Auth unifiée ImmoScan / ImmoValue.
          </span>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.44c-.28 1.48-1.13 2.74-2.4 3.58v2.97h3.86c2.26-2.09 3.59-5.17 3.59-8.79z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.97c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.07A11.997 11.997 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.32a7.2 7.2 0 0 1 0-4.65V6.6H1.29a12.001 12.001 0 0 0 0 10.8l3.98-3.08z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.81l3.42-3.42C17.95 1.13 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.6l3.98 3.07C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export const Route = createFileRoute("/auth/signup")({
  validateSearch,
  beforeLoad: ({ search }) => redirectIfAuthenticated({ search }),
  component: SignupPage,
});
