import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { SignupForm } from "@/features/auth/signup-form";
import { redirectIfAuthenticated } from "@/lib/auth-guards";

export const Route = createFileRoute("/auth/signup")({
  beforeLoad: redirectIfAuthenticated,
  component: SignupPage,
});

function SignupPage() {
  return (
    <AuthLayout
      title="Crée ton compte."
      subtitle="7 jours d'essai Pro offerts, sans carte bancaire. Annule à tout moment."
    >
      <SignupForm />
    </AuthLayout>
  );
}
