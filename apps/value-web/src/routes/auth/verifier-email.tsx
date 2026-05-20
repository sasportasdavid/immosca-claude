// /auth/verifier-email — écran d'attente après signup quand Supabase
// exige une confirmation email avant de créer la session.
//
// L'user reçoit un lien `…/auth/callback?next=…` qui finalise la session
// dès qu'il clique. On l'aide juste à patienter et propose de renvoyer
// le mail si besoin.

import {
  Link,
  createFileRoute,
} from "@tanstack/react-router";
import { MailCheck, RefreshCw } from "lucide-react";
import * as React from "react";

import { Button } from "@web/components/ui/button";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { Wordmark } from "@/components/value/EstimationStepperLayout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface VerifierEmailSearch {
  email?: string;
  next?: string;
}

function validateSearch(raw: Record<string, unknown>): VerifierEmailSearch {
  const email = typeof raw.email === "string" ? raw.email : undefined;
  const next = typeof raw.next === "string" ? raw.next : undefined;
  return { email, next };
}

function VerifierEmailPage() {
  const search = Route.useSearch();
  const { signInWithMagicLink } = useAuth();
  const [resent, setResent] = React.useState(false);
  const [resendLoading, setResendLoading] = React.useState(false);

  async function handleResend() {
    if (!search.email) return;
    setResendLoading(true);
    try {
      await signInWithMagicLink(search.email);
      setResent(true);
    } catch {
      // V1: silent — on garde l'UI inchangée.
    } finally {
      setResendLoading(false);
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
        </div>
      </header>

      <div className="mx-auto max-w-[460px] px-6 pb-20 pt-20 sm:px-8">
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-r-lg bg-terra-soft text-terra-deep">
          <MailCheck className="h-7 w-7" strokeWidth={1.75} />
        </div>

        <Eyebrow variant="terra">Plus qu&rsquo;un clic</Eyebrow>
        <h1 className="mt-3 font-serif text-[clamp(1.875rem,4vw,2.5rem)] italic font-normal leading-[1.1] tracking-[-0.022em] text-ink [text-wrap:balance]">
          Confirme{" "}
          <span className="not-italic font-sans font-semibold">ton email.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-[1.55] text-muted-ink">
          On vient de t&rsquo;envoyer un lien de confirmation
          {search.email ? (
            <>
              {" "}à <b className="text-ink">{search.email}</b>
            </>
          ) : null}
          . Clique dessus pour activer ton compte et débloquer ton estimation.
        </p>

        <div className="mt-8 rounded-r-lg border border-dashed border-line-2 bg-card p-5 text-[13px] text-muted-ink">
          <p className="font-medium text-ink">Pas reçu ?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Vérifie ton dossier spam / promotions.</li>
            <li>L&rsquo;email peut mettre 1-2 minutes à arriver.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleResend}
            disabled={!search.email || resendLoading || resent}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", resendLoading && "animate-spin")}
              strokeWidth={2}
            />
            {resent ? "Lien renvoyé" : "Renvoyer le lien"}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/auth/login" search={{ next: search.next } as never}>
              J&rsquo;ai déjà confirmé
            </Link>
          </Button>
        </div>

        <p className="mt-10 text-center text-[12px] text-mute-2">
          Mauvaise adresse ?{" "}
          <Link
            to="/auth/signup"
            search={{ next: search.next } as never}
            className="text-terra no-underline hover:text-terra-deep"
          >
            Recommencer
          </Link>
        </p>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/auth/verifier-email")({
  validateSearch,
  component: VerifierEmailPage,
});
