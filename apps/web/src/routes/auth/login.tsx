import { Navigate, createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/features/auth/login-form";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const auth = useAuth();
  // Redirection automatique si déjà connecté.
  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return (
    <AuthLayout
      title="Connecte-toi à ton compte."
      subtitle="On garde tes paramètres et tes analyses en sécurité."
    >
      <LoginForm />
    </AuthLayout>
  );
}
