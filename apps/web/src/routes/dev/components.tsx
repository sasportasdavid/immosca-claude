import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { strategyTypeSchema, type StrategyType } from "@immoscan/shared";

import { AppHeader } from "@/components/app-header";
import { ListingCard } from "@/components/listing-card";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { ScoreBadge } from "@/components/score-badge";
import { StrategyCardGroup } from "@/components/strategy-card";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Page de validation visuelle des composants Design — supprimée fin PR1
// (étape 7 du plan). Routes de preview full-layout : /dev/preview/*.
// Mode Design strict : aucun fetch, props hardcodées.

export const Route = createFileRoute("/dev/components")({
  component: DevComponentsPage,
});

function Section({
  num,
  title,
  hint,
  children,
}: {
  num: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border pb-12">
      <div className="mb-6 flex items-baseline gap-3 border-b border-border pb-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          {num}
        </span>
        <h2 className="text-[20px] font-semibold tracking-[-0.015em]">{title}</h2>
        {hint ? (
          <span className="ml-auto text-[12px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </div>
  );
}

const sampleFormSchema = z.object({
  email: z.string().email("Email invalide"),
  budget: z.number().positive("Doit être positif"),
  strategy: strategyTypeSchema,
  note: z.string().max(500).optional(),
});

type SampleFormValues = z.infer<typeof sampleFormSchema>;

function SampleForm() {
  const form = useForm<SampleFormValues>({
    resolver: zodResolver(sampleFormSchema),
    defaultValues: { email: "", budget: 320000, strategy: "locatif_nu", note: "" },
  });

  function onSubmit(values: SampleFormValues) {
    toast.success("Formulaire validé", {
      description: `Email : ${values.email} · Budget : ${values.budget} €`,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="toi@exemple.fr" {...field} />
              </FormControl>
              <FormDescription>On ne te spamme pas.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="budget"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Budget maximum</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="strategy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stratégie</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisis…" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="locatif_nu">Locatif nu</SelectItem>
                  <SelectItem value="lmnp_meuble">LMNP meublé</SelectItem>
                  <SelectItem value="mixte">Mixte</SelectItem>
                  <SelectItem value="colocation">Colocation</SelectItem>
                  <SelectItem value="courte_duree">Courte durée</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea placeholder="Optionnel…" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="md:col-span-2">
          <Button type="submit">Soumettre</Button>
        </div>
      </form>
    </Form>
  );
}

function DevComponentsPage() {
  const [stepDemo, setStepDemo] = useState<1 | 2>(1);
  const [strategy, setStrategy] = useState<StrategyType | undefined>("locatif_nu");
  const [radioValue, setRadioValue] = useState<string>("a");

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        <AppHeader
          userEmail="marc.dupont@example.fr"
          userPlan="pro"
          onLogout={() => undefined}
          onUpgradeClick={() => undefined}
        />

        <main className="mx-auto max-w-[1280px] px-6 py-12">
          <header className="mb-10">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Validation visuelle · PR1
            </span>
            <h1 className="mt-2 text-[40px] font-semibold leading-[1.05] tracking-[-0.025em]">
              Composants Design.
            </h1>
            <p className="mt-3 max-w-[60ch] text-[14px] text-muted-foreground">
              Page de référence interne. Layouts full-page :
              <a href="/dev/preview/app-shell" className="ml-1 text-primary underline">
                AppShell
              </a>
              {" · "}
              <a href="/dev/preview/auth-layout" className="text-primary underline">
                AuthLayout
              </a>
              {" · "}
              <a href="/dev/preview/onboarding-layout" className="text-primary underline">
                OnboardingLayout
              </a>
              . Tout est supprimé fin PR1 (étape 7).
            </p>
          </header>

          {/* 01 — ScoreBadge */}
          <Section
            num="01"
            title="ScoreBadge"
            hint="≥75 vert · 50-74 orange · <50 rouge"
          >
            <div className="grid grid-cols-3 gap-6">
              {[92, 65, 35].map((score) => (
                <div key={score} className="rounded-lg border border-border bg-card p-5">
                  <Caption>Score = {score}</Caption>
                  <div className="flex items-center gap-4">
                    <ScoreBadge score={score} size="sm" />
                    <ScoreBadge score={score} size="md" />
                    <ScoreBadge score={score} size="lg" />
                  </div>
                  <div className="mt-4 border-t border-border pt-4">
                    <ScoreBadge score={score} size="md" showLabel />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 02 — Badge variants */}
          <Section
            num="02"
            title="Badge variants"
            hint="Tokens soft success/warning/danger/info"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="default">Neutre</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="success">Rdt 6,8 %</Badge>
              <Badge variant="warning">DPE D</Badge>
              <Badge variant="danger">Passoire</Badge>
              <Badge variant="info">En analyse</Badge>
            </div>
          </Section>

          {/* 03 — Button */}
          <Section
            num="03"
            title="Button"
            hint="5 variants · sm 28 / default 36 / lg 44"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default">Lancer l'analyse</Button>
                <Button variant="outline">Exporter CSV</Button>
                <Button variant="ghost">Plus tard</Button>
                <Button variant="destructive">Supprimer</Button>
                <Button variant="link">En savoir plus</Button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">sm 28 px</Button>
                <Button size="default">md 36 px</Button>
                <Button size="lg">lg 44 px</Button>
                <Button size="icon" aria-label="icône">
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>
          </Section>

          {/* 04 — Inputs */}
          <Section
            num="04"
            title="Inputs primitives"
            hint="Input · Textarea · Label · Select · RadioGroup"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="demo-input">Email</Label>
                <Input id="demo-input" type="email" placeholder="toi@exemple.fr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-input-err">Email en erreur</Label>
                <Input
                  id="demo-input-err"
                  type="email"
                  value="prenom@"
                  aria-invalid
                  readOnly
                />
                <p className="text-[12px] font-medium text-destructive">Email invalide.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-textarea">Note</Label>
                <Textarea
                  id="demo-textarea"
                  placeholder="Notes longues, multi-lignes…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="demo-disabled">Désactivé</Label>
                <Input id="demo-disabled" value="Lecture seule" disabled />
              </div>
              <div className="space-y-1.5">
                <Label>Select (stratégie)</Label>
                <Select defaultValue="locatif_nu">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="locatif_nu">Locatif nu</SelectItem>
                    <SelectItem value="lmnp_meuble">LMNP meublé</SelectItem>
                    <SelectItem value="mixte">Mixte</SelectItem>
                    <SelectItem value="colocation">Colocation</SelectItem>
                    <SelectItem value="courte_duree">Courte durée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>RadioGroup primitive</Label>
                <RadioGroup value={radioValue} onValueChange={setRadioValue}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="a" id="radio-a" />
                    <Label htmlFor="radio-a">Option A</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="b" id="radio-b" />
                    <Label htmlFor="radio-b">Option B</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </Section>

          {/* 05 — Form complet RHF + zodResolver */}
          <Section
            num="05"
            title="Form RHF + zodResolver"
            hint="Validation côté client + toast Sonner"
          >
            <div className="rounded-lg border border-border bg-card p-6">
              <SampleForm />
            </div>
          </Section>

          {/* 06 — Tooltip & Sonner */}
          <Section
            num="06"
            title="Tooltip · Sonner"
            hint="Feedback & overlays"
          >
            <div className="flex flex-wrap items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline">Survol moi</Button>
                </TooltipTrigger>
                <TooltipContent>Disponible bientôt</TooltipContent>
              </Tooltip>
              <Button onClick={() => toast.success("Bien épinglé au pipeline")}>
                Toast success
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast.error("URL non reconnue", {
                    description: "Colle une URL SeLoger ou Leboncoin.",
                  })
                }
              >
                Toast error
              </Button>
              <Button
                variant="ghost"
                onClick={() => toast("Analyse en file d'attente", { description: "Position 4 sur 6." })}
              >
                Toast neutre
              </Button>
            </div>
          </Section>

          {/* 07 — OnboardingStepper */}
          <Section num="07" title="OnboardingStepper" hint="2 steps · PR1">
            <div className="space-y-6">
              <div className="rounded-lg border border-border bg-card p-6">
                <Caption>Step {stepDemo} / 2</Caption>
                <OnboardingStepper
                  step={stepDemo}
                  labels={["Stratégie", "Paramètres"]}
                  onStepClick={(s) => setStepDemo(s as 1 | 2)}
                />
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStepDemo(1)}
                  >
                    Aller à 1
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStepDemo(2)}
                  >
                    Aller à 2
                  </Button>
                </div>
              </div>
            </div>
          </Section>

          {/* 08 — StrategyCardGroup */}
          <Section
            num="08"
            title="StrategyCardGroup"
            hint="5 cards alignées strategyTypeSchema · onboarding step-1"
          >
            <div className="rounded-lg border border-border bg-card p-6">
              <Caption>Sélection : {strategy ?? "—"}</Caption>
              <StrategyCardGroup value={strategy} onChange={setStrategy} />
            </div>
          </Section>

          {/* 09 — ListingCard (existant, gardé pour régression visuelle) */}
          <Section
            num="09"
            title="ListingCard"
            hint="Masquage freemium = SQL. Le composant rend ce qu'on lui passe."
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Caption>Pro · données complètes</Caption>
                <ListingCard
                  title="Maison 4P · 95 m² · jardin"
                  prix={235_000}
                  surface={95}
                  pieces={4}
                  ville="Gagny"
                  codePostal="93220"
                  dpe="D"
                  score={92}
                  isMasked={false}
                  onPin={() => undefined}
                />
              </div>
              <div>
                <Caption>Free · prix masqué (score &gt; 70)</Caption>
                <ListingCard
                  title="Appartement T3 · 72 m²"
                  prix={null}
                  surface={72}
                  pieces={3}
                  ville="Gagny"
                  codePostal="93220"
                  dpe="C"
                  score={87}
                  isMasked={true}
                  onUpgradeClick={() => undefined}
                />
              </div>
            </div>
          </Section>
        </main>
      </div>
    </TooltipProvider>
  );
}
