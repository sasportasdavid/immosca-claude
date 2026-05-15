import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="font-display text-5xl font-bold tracking-tight">ImmoScan</h1>
      <p className="mt-4 max-w-md text-center text-lg text-muted-foreground">
        20 heures d'analyse Excel en 8 minutes.
      </p>
      <p className="mt-8 text-sm text-muted-foreground">
        ⏳ Skeleton — en attente du design Claude Design via Lovable.
      </p>
    </main>
  );
}
