import { createFileRoute } from "@tanstack/react-router";

import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/features/auth/login-form";
import { redirectIfAuthenticated } from "@/lib/auth-guards";

export const Route = createFileRoute("/auth/login")({
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
});

function LoginPage() {
  return (
    <AuthLayout
      title="Connecte-toi à ton compte."
      subtitle="On garde tes paramètres et tes analyses en sécurité."
    >
      <LoginForm />
    </AuthLayout>
  );
}
