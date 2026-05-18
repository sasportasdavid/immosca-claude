// LoginForm — container Code de la route /auth/login.
//
// Trois méthodes d'auth selon décision PO (commit b2b2d6d) :
// 1. Email + password (formulaire principal)
// 2. Google OAuth (bouton outline, redirige vers Google puis /auth/callback)
// 3. Magic link (deuxième formulaire ou toggle — ici via switch view)
//
// Apple OAuth → backlog.
//
// Toutes les erreurs sont mappées en FR via mapAuthError() et affichées
// en toast Sonner. Le succès password / magic link redirige vers
// /dashboard ; le succès Google se fait via le callback.

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { mapAuthError } from "@/features/auth/auth-error";
import {
  type LoginInput,
  type MagicLinkInput,
  loginSchema,
  magicLinkSchema,
} from "@/features/auth/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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

export function LoginForm() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<"password" | "magic-link">("password");

  // ── Mutations ─────────────────────────────────────────────
  const passwordMutation = useMutation({
    mutationFn: (values: LoginInput) =>
      auth.signInWithPassword(values.email, values.password),
    onSuccess: () => {
      posthog.capture("login_completed", { method: "password" });
      toast.success("Bienvenue !");
      navigate({ to: "/dashboard" });
    },
    onError: (err) => toast.error(mapAuthError(err)),
  });

  const googleMutation = useMutation({
    mutationFn: () => auth.signInWithGoogle(),
    // Pas de onSuccess : la redirection vers Google se fait avant.
    // L'event "login_completed" sera capturé sur la route /auth/callback.
    onError: (err) => toast.error(mapAuthError(err)),
  });

  const magicLinkMutation = useMutation({
    mutationFn: (values: MagicLinkInput) =>
      auth.signInWithMagicLink(values.email),
    onSuccess: () => {
      posthog.capture("login_magic_link_sent");
      toast.success("Lien envoyé. Vérifie ta boîte mail.", {
        description: "Tu peux fermer cet onglet.",
      });
    },
    onError: (err) => toast.error(mapAuthError(err)),
  });

  // ── Forms ─────────────────────────────────────────────────
  const passwordForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const magicLinkForm = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });

  // ── Render ────────────────────────────────────────────────
  if (view === "magic-link") {
    return (
      <Form {...magicLinkForm}>
        <form
          onSubmit={magicLinkForm.handleSubmit((v) => magicLinkMutation.mutate(v))}
          className="space-y-4"
        >
          <p className="text-[13px] leading-[1.5] text-muted-foreground">
            On t'envoie un lien magique. Clique dessus depuis ta boîte mail
            pour te connecter sans mot de passe.
          </p>
          <FormField
            control={magicLinkForm.control}
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
          <Button
            type="submit"
            className="w-full"
            disabled={magicLinkMutation.isPending}
          >
            <Mail className="h-4 w-4" />
            {magicLinkMutation.isPending ? "Envoi…" : "Envoyer le lien"}
          </Button>
          <button
            type="button"
            onClick={() => setView("password")}
            className="block w-full text-center text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour au mot de passe
          </button>
        </form>
      </Form>
    );
  }

  return (
    <Form {...passwordForm}>
      <form
        onSubmit={passwordForm.handleSubmit((v) => passwordMutation.mutate(v))}
        className="space-y-4"
      >
        <FormField
          control={passwordForm.control}
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
          control={passwordForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Mot de passe</FormLabel>
                <button
                  type="button"
                  onClick={() => setView("magic-link")}
                  className="text-[12px] text-primary hover:underline"
                >
                  Oublié ?
                </button>
              </div>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={passwordMutation.isPending}
        >
          {passwordMutation.isPending ? "Connexion…" : "Se connecter"}
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
            : "Continuer avec Google"}
        </Button>

        <p className="text-center text-[12px] text-muted-foreground">
          Pas encore de compte ?{" "}
          <button
            type="button"
            onClick={() => navigate({ to: "/auth/signup" })}
            className="font-medium text-primary hover:underline"
          >
            Inscris-toi
          </button>
        </p>
      </form>
    </Form>
  );
}
