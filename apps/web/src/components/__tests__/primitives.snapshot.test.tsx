// Snapshot tests des primitives shadcn et composants applicatifs
// présentationnels. Assurance vie contre les régressions visuelles
// quand on touchera aux tokens en PR2+.
//
// On utilise `renderToStaticMarkup` (react-dom/server) qui produit du
// HTML déterministe sans avoir besoin de jsdom. Limitation : les
// composants qui utilisent createPortal (DropdownMenu, Tooltip,
// Sonner) ou qui dépendent d'effects sont moins bien capturés. Pour
// ceux-là on snapshot uniquement le trigger / état fermé.
//
// Les IDs auto-générés par Radix (`useId` → `radix-:r0:`) sont
// normalisés via `normalize()` avant le snapshot pour la stabilité.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppHeader } from "@/components/app-header";
import { AuthLayout } from "@/components/auth-layout";
import { ListingCard } from "@/components/listing-card";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { ScoreBadge } from "@/components/score-badge";
import { StrategyCardGroup } from "@/components/strategy-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function normalize(html: string): string {
  // Stabilise les IDs auto-générés (Radix useId, React useId)
  return html
    .replace(/radix-:r[a-z0-9]+:/g, "radix-:r*:")
    .replace(/(\bid="):r[a-z0-9]+:(")/g, "$1:r*:$2")
    .replace(/(\baria-(?:labelledby|describedby|controls)="):r[a-z0-9]+:(")/g, "$1:r*:$2");
}

function snap(node: React.ReactNode): string {
  return normalize(renderToStaticMarkup(<>{node}</>));
}

// ─────────────────────────────────────────────────────────
// shadcn primitives
// ─────────────────────────────────────────────────────────

describe("<Button>", () => {
  it("toutes variants × sizes", () => {
    const tree = (
      <div>
        {(["default", "outline", "ghost", "destructive", "link"] as const).map(
          (variant) =>
            (["sm", "default", "lg", "icon"] as const).map((size) => (
              <Button key={`${variant}-${size}`} variant={variant} size={size}>
                {`${variant} ${size}`}
              </Button>
            )),
        )}
        <Button disabled>disabled</Button>
      </div>
    );
    expect(snap(tree)).toMatchSnapshot();
  });
});

describe("<Badge>", () => {
  it("toutes variants", () => {
    const tree = (
      <div>
        {(["default", "outline", "success", "warning", "danger", "info"] as const).map(
          (v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ),
        )}
      </div>
    );
    expect(snap(tree)).toMatchSnapshot();
  });
});

describe("<Card>", () => {
  it("avec sub-components", () => {
    const tree = (
      <Card>
        <CardHeader>
          <CardTitle>Titre</CardTitle>
          <CardDescription>Description courte.</CardDescription>
        </CardHeader>
        <CardContent>Contenu principal.</CardContent>
        <CardFooter>Footer.</CardFooter>
      </Card>
    );
    expect(snap(tree)).toMatchSnapshot();
  });
});

describe("<Input>", () => {
  it("normal / disabled / aria-invalid", () => {
    const tree = (
      <div>
        <Input type="email" placeholder="email" defaultValue="" />
        <Input type="text" defaultValue="lecture seule" disabled />
        <Input type="email" aria-invalid defaultValue="invalide" />
      </div>
    );
    expect(snap(tree)).toMatchSnapshot();
  });
});

describe("<Label>", () => {
  it("default", () => {
    expect(snap(<Label htmlFor="x">Email</Label>)).toMatchSnapshot();
  });
});

describe("<Textarea>", () => {
  it("default", () => {
    expect(
      snap(<Textarea placeholder="Notes longues…" />),
    ).toMatchSnapshot();
  });
});

// ─────────────────────────────────────────────────────────
// Composants applicatifs ImmoScan
// ─────────────────────────────────────────────────────────

describe("<ScoreBadge>", () => {
  it("ranges × sizes + showLabel", () => {
    const tree = (
      <div>
        {[92, 65, 35].map((score) =>
          (["sm", "md", "lg"] as const).map((size) => (
            <ScoreBadge key={`${score}-${size}`} score={score} size={size} />
          )),
        )}
        <ScoreBadge score={92} size="md" showLabel />
        <ScoreBadge score={65} size="md" showLabel />
        <ScoreBadge score={35} size="md" showLabel />
      </div>
    );
    expect(snap(tree)).toMatchSnapshot();
  });
});

describe("<ListingCard>", () => {
  it("Pro données complètes", () => {
    expect(
      snap(
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
        />,
      ),
    ).toMatchSnapshot();
  });

  it("Free prix masqué", () => {
    expect(
      snap(
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
        />,
      ),
    ).toMatchSnapshot();
  });
});

describe("<AppHeader>", () => {
  it("signed-out", () => {
    expect(
      snap(<AppHeader userEmail={null} userPlan={null} />),
    ).toMatchSnapshot();
  });
  it("signed-in Pro", () => {
    expect(
      snap(<AppHeader userEmail="marc.dupont@example.fr" userPlan="pro" />),
    ).toMatchSnapshot();
  });
  it("signed-in Free", () => {
    expect(
      snap(<AppHeader userEmail="invest@example.fr" userPlan="free" />),
    ).toMatchSnapshot();
  });
});

describe("<StrategyCardGroup>", () => {
  it("sans sélection", () => {
    expect(
      snap(<StrategyCardGroup value={undefined} onChange={() => undefined} />),
    ).toMatchSnapshot();
  });
  it("avec locatif_nu sélectionné", () => {
    expect(
      snap(<StrategyCardGroup value="locatif_nu" onChange={() => undefined} />),
    ).toMatchSnapshot();
  });
});

describe("<OnboardingStepper>", () => {
  const labels = ["Stratégie", "Paramètres"] as const;
  it("step 1", () => {
    expect(snap(<OnboardingStepper step={1} labels={labels} />)).toMatchSnapshot();
  });
  it("step 2", () => {
    expect(snap(<OnboardingStepper step={2} labels={labels} />)).toMatchSnapshot();
  });
});

describe("<AuthLayout>", () => {
  it("avec titre + subtitle + slot", () => {
    expect(
      snap(
        <AuthLayout title="Test title." subtitle="Sub.">
          <div>contenu slot</div>
        </AuthLayout>,
      ),
    ).toMatchSnapshot();
  });
});
