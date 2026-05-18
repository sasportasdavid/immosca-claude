import { Navigate, createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { SignupForm } from "@/features/auth/signup-form";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
});

function SignupPage() {
  const auth = useAuth();
  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <AuthLayout
      title="Crée ton compte."
      subtitle="7 jours d'essai Pro offerts, sans carte bancaire. Annule à tout moment."
    >
      <SignupForm />
    </AuthLayout>
  );
}
