import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Preview full-page de l'AuthLayout. Supprimé fin PR1 (étape 7).

export const Route = createFileRoute("/dev/preview/auth-layout")({
  component: PreviewAuthLayout,
});

function PreviewAuthLayout() {
  return (
    <AuthLayout
      title="Connecte-toi à ton compte."
      subtitle="On garde tes paramètres et tes analyses en sécurité."
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="preview-email">Email</Label>
          <Input id="preview-email" type="email" placeholder="toi@exemple.fr" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="preview-password">Mot de passe</Label>
            <a
              href="#"
              className="text-[12px] text-primary hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Oublié ?
            </a>
          </div>
          <Input id="preview-password" type="password" placeholder="••••••••" />
        </div>
        <Button type="submit" className="w-full">
          Se connecter
        </Button>
        <div className="relative my-4 flex items-center">
          <span className="h-px flex-1 bg-border" />
          <span className="px-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            ou
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button type="button" variant="outline" className="w-full">
          Continuer avec Google
        </Button>
        <p className="text-center text-[12px] text-muted-foreground">
          Pas encore de compte ?{" "}
          <a
            href="#"
            className="font-medium text-primary hover:underline"
            onClick={(e) => e.preventDefault()}
          >
            Inscris-toi
          </a>
        </p>
      </form>
    </AuthLayout>
  );
}
