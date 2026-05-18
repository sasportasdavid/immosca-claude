// SignupForm — container Code de la route /auth/signup.
//
// Email + password + confirm + acceptance CGU. Pas de magic link sur
// signup pour éviter ambiguïté (un magic link sur un nouvel email crée
// un compte sans password — comportement Supabase par défaut — mais on
// préfère un signup explicite avec password pour permettre login direct
// ensuite).
//
// Le profile est créé automatiquement par le trigger SQL handle_new_user
// (cf migration init_app.sql). Aucun appel API supplémentaire requis.
//
// PostHog tracking :
// - signup_started → au mount de la page (capture événement funnel)
// - signup_completed → après signup réussi (avec method)

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { mapAuthError } from "@/features/auth/auth-error";
import { type SignupInput, signupSchema } from "@/features/auth/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import posthog from "posthog-js";

function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-4 flex items-center">
      <span className="h-px flex-1 bg-border" />
      <span className="px-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M15.68 8.182c0-.564-.05-1.107-.146-1.628H8v3.08h4.305a3.68 3.68 0 0 1-1.596 2.414v2.005h2.583c1.51-1.39 2.388-3.44 2.388-5.871z"
      />
      <path
        fill="#34A853"
        d="M8 16c2.16 0 3.97-.715 5.292-1.947l-2.583-2.005c-.715.48-1.633.764-2.71.764-2.084 0-3.85-1.405-4.483-3.296H.853v2.07A7.998 7.998 0 0 0 8 16z"
      />
      <path
        fill="#FBBC04"
        d="M3.517 9.516a4.804 4.804 0 0 1 0-3.04V4.406H.853a8.005 8.005 0 0 0 0 7.18l2.664-2.07z"
      />
      <path
        fill="#EA4335"
        d="M8 3.18c1.177 0 2.232.404 3.063 1.198l2.292-2.293C11.964.793 10.156 0 8 0A7.998 7.998 0 0 0 .853 4.406l2.664 2.07C4.15 4.585 5.916 3.18 8 3.18z"
      />
    </svg>
  );
}

export function SignupForm() {
  const auth = useAuth();
  const navigate = useNavigate();

  // Event funnel : capture une fois au mount
  useEffect(() => {
    posthog.capture("signup_started");
  }, []);

  // ── Mutations ─────────────────────────────────────────────
  const signupMutation = useMutation({
    mutationFn: async (values: SignupInput) => {
      return auth.signUpWithPassword(values.email, values.password);
    },
    onSuccess: (data) => {
      posthog.capture("signup_completed", {
        method: "password",
        // user_id récupéré du retour Supabase. Le listener auth aura
        // déjà identify le user à ce point via onAuthStateChange.
        has_session: !!data.session,
      });
      if (data.session) {
        toast.success("Compte créé. Bienvenue !");
        navigate({ to: "/onboarding/step-1" });
      } else {
        // Supabase peut nécessiter une confirmation par email avant de
        // créer la session (selon config remote — cf INFRA_FEEDBACK
        // 2026-05-17 : enable_confirmations diverge local vs remote).
        toast.success("Compte créé. Confirme ton email pour te connecter.", {
          description: "On vient de t'envoyer un lien.",
        });
      }
    },
    onError: (err) => toast.error(mapAuthError(err)),
  });

  const googleMutation = useMutation({
    mutationFn: () => auth.signInWithGoogle(),
    onError: (err) => toast.error(mapAuthError(err)),
  });

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false as unknown as true,
    },
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((v) => signupMutation.mutate(v))}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder="toi@exemple.fr"
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mot de passe</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Au moins 8 caractères"
                  {...field}
                />
              </FormControl>
              <FormDescription>8 caractères minimum.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirme ton mot de passe</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem>
              <label className="flex cursor-pointer items-start gap-2 text-[12.5px] leading-[1.5] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={!!field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <span>
                  J'accepte les{" "}
                  <a
                    href="/cgu"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    CGU
                  </a>{" "}
                  et la{" "}
                  <a
                    href="/confidentialite"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    politique de confidentialité
                  </a>
                  .
                </span>
              </label>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={signupMutation.isPending}
        >
          {signupMutation.isPending ? "Création…" : "Créer mon compte"}
        </Button>

        <Divider label="ou" />

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => googleMutation.mutate()}
          disabled={googleMutation.isPending}
        >
          <GoogleIcon />
          {googleMutation.isPending
            ? "Redirection…"
            : "S'inscrire avec Google"}
        </Button>

        <p className="text-center text-[12px] text-muted-foreground">
          Déjà un compte ?{" "}
          <button
            type="button"
            onClick={() => navigate({ to: "/auth/login" })}
            className="font-medium text-primary hover:underline"
          >
            Connecte-toi
          </button>
        </p>
      </form>
    </Form>
  );
}
