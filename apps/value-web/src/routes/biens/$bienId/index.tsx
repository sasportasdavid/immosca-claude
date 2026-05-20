import type { ValueBienStatus } from "@immoscan/db";
import { createFileRoute } from "@tanstack/react-router";
import { differenceInCalendarDays } from "date-fns";
import * as React from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@web/components/ui/tabs";

import { BasculerDiscretModal } from "@/components/value/BasculerDiscretModal";
import { BienHeader } from "@/components/value/BienHeader";
import { BienTabsEstimation } from "@/components/value/BienTabsEstimation";
import { BienTabsParametres } from "@/components/value/BienTabsParametres";
import { DiscretStatsDashboard } from "@/components/value/DiscretStatsDashboard";
import { PaywallPublicModal } from "@/components/value/PaywallPublicModal";
import { PostPublicationSuccessModal } from "@/components/value/PostPublicationSuccessModal";
import { useBien } from "@/hooks/use-bien";
import { useBienStats } from "@/hooks/use-bien-stats";
import { useUpdateBien } from "@/hooks/use-update-bien";
import { postBiensPublish } from "@/lib/value-api";

// /biens/$bienId — page mère du dashboard propriétaire d'un bien
// ImmoValue. Containerise les 5 écrans 9-13 du brief Frontend-DashboardBien.
//
// Tabs visibilité :
//   - Estimation : toujours
//   - Stats      : si status = discret OU public
//   - Annonce    : si status = discret OU public  (V1 placeholder)
//   - Contacts   : si status = public             (V1 placeholder)
//   - Historique : toujours                         (V1 placeholder)
//   - Paramètres : toujours

type TabKey =
  | "estimation"
  | "stats"
  | "annonce"
  | "contacts"
  | "historique"
  | "parametres";

function BienDashboardPage() {
  const { bienId } = Route.useParams();
  const { data: bien, isLoading, error } = useBien(bienId);
  const { data: stats } = useBienStats(bienId);
  const updateBien = useUpdateBien(bienId);

  // ──────── UI state ────────
  const [tab, setTab] = React.useState<TabKey>("estimation");
  const [discretOpen, setDiscretOpen] = React.useState(false);
  const [paywallOpen, setPaywallOpen] = React.useState(false);
  const [successOpen, setSuccessOpen] = React.useState(false);
  const [, setPendingStatus] = React.useState<ValueBienStatus | null>(null);
  const [publishLoading, setPublishLoading] = React.useState(false);

  // ──────── Loading / error ────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1180px] px-8 py-16">
        <div className="h-9 w-64 animate-pulse rounded-r bg-bg-2" />
        <div className="mt-4 h-40 animate-pulse rounded-r-lg bg-bg-2" />
      </div>
    );
  }
  if (error || !bien) {
    return (
      <div className="mx-auto max-w-[1180px] px-8 py-16">
        <h1 className="text-[20px] font-semibold text-ink">
          Bien introuvable
        </h1>
        <p className="mt-2 text-[14px] text-muted-ink">
          {error ? String(error) : "Ce bien n'existe pas ou tu n'y as pas accès."}
        </p>
      </div>
    );
  }

  // ──────── Computed ────────
  // Capturé dans un const local pour préserver le narrowing de `bien`
  // (non-null) dans les closures déclarées ci-dessous.
  const bienOk = bien;
  const status: ValueBienStatus = bienOk.status;
  const isDiscretOrPublic = status === "discret" || status === "public";
  const isPublic = status === "public";

  const daysDiscret = bienOk.discret_started_at
    ? Math.max(
        1,
        differenceInCalendarDays(new Date(), new Date(bienOk.discret_started_at)),
      )
    : 12;

  // ──────── Handlers ────────
  function onRequestStatusChange(next: ValueBienStatus) {
    setPendingStatus(next);
    if (next === "discret") {
      setDiscretOpen(true);
      return;
    }
    if (next === "public") {
      setPaywallOpen(true);
      return;
    }
    // suivi / retire : update direct (pas de modal V1 — placeholder).
    updateBien.mutate({ status: next });
  }

  async function onConfirmDiscret(settings: {
    geoLevel: string;
    blurPhotos: boolean;
    showEtage: boolean;
    showSurface: boolean;
  }) {
    await updateBien.mutateAsync({
      status: "discret",
      discret_started_at: new Date().toISOString(),
      anon_settings: settings as never,
    });
    setDiscretOpen(false);
    setPendingStatus(null);
  }

  async function onConfirmPublic(settings: {
    emailMode: string;
    phoneMode: string;
    autoReplyEnabled: boolean;
  }) {
    setPublishLoading(true);
    try {
      const res = await postBiensPublish(bienOk.id);
      if (res.payment_required && res.checkout_url) {
        // Redirige vers Stripe Checkout.
        window.location.href = res.checkout_url;
        return;
      }
      // Paywall déjà unlock — on persiste les settings de contact et on
      // bascule le status localement.
      await updateBien.mutateAsync({
        status: "public",
        published_at: new Date().toISOString(),
        contact_settings: settings as never,
      });
      setPaywallOpen(false);
      setSuccessOpen(true);
    } finally {
      setPublishLoading(false);
      setPendingStatus(null);
    }
  }

  // ──────── Render ────────
  return (
    <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
      <BienHeader
        bien={bien}
        onEdit={() => setTab("parametres")}
        onOpenSettings={() => setTab("parametres")}
        onOpenPublicListing={() => {
          // V1 placeholder — naviguera vers /annonces/$slug quand l'écran
          // Vitrine acheteur sera livré.
        }}
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="mt-8"
      >
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="estimation">Estimation</TabsTrigger>
          {isDiscretOrPublic && (
            <TabsTrigger value="stats">Stats</TabsTrigger>
          )}
          {isDiscretOrPublic && (
            <TabsTrigger value="annonce">Annonce</TabsTrigger>
          )}
          {isPublic && <TabsTrigger value="contacts">Contacts</TabsTrigger>}
          <TabsTrigger value="historique">Historique</TabsTrigger>
          <TabsTrigger value="parametres">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="estimation">
          <BienTabsEstimation
            bien={bien}
            onRefresh={() => {
              // V1 — placeholder. Le worker `value-recompute` sera invoqué
              // côté serveur via une edge function quand câblée.
            }}
            isRefreshing={false}
          />
        </TabsContent>

        {isDiscretOrPublic && (
          <TabsContent value="stats">
            <DiscretStatsDashboard
              bien={bien}
              stats={stats ?? null}
              daysDiscret={daysDiscret}
              onOpenPaywall={() => setPaywallOpen(true)}
              onRepasserPrive={() => updateBien.mutate({ status: "suivi" })}
              onOpenParams={() => setTab("parametres")}
            />
          </TabsContent>
        )}

        {isDiscretOrPublic && (
          <TabsContent value="annonce">
            <div className="rounded-r-lg border border-dashed border-line bg-card p-10 text-center">
              <p className="text-[14px] text-muted-ink">
                L&rsquo;éditeur d&rsquo;annonce arrive avec l&rsquo;écran
                Vitrine acheteur.
              </p>
            </div>
          </TabsContent>
        )}

        {isPublic && (
          <TabsContent value="contacts">
            <div className="rounded-r-lg border border-dashed border-line bg-card p-10 text-center">
              <p className="text-[14px] text-muted-ink">
                Aucun contact reçu pour l&rsquo;instant.
              </p>
            </div>
          </TabsContent>
        )}

        <TabsContent value="historique">
          <div className="rounded-r-lg border border-dashed border-line bg-card p-10 text-center">
            <p className="text-[14px] text-muted-ink">
              Historique des revalorisations à venir.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="parametres">
          <BienTabsParametres
            bien={bien}
            isPending={updateBien.isPending}
            onChangeAlerts={(patch) => updateBien.mutate(patch)}
            onRequestStatusChange={onRequestStatusChange}
            onUpdateComparables={(urls) =>
              updateBien.mutate({ user_provided_urls: urls })
            }
            onDeleteBien={() => {
              // V1 — la suppression définitive sera gérée par une edge fn
              // dédiée (purge stats + historique + annonces).
            }}
          />
        </TabsContent>
      </Tabs>

      {/* ──────── Modals ──────── */}
      <BasculerDiscretModal
        open={discretOpen}
        onOpenChange={(o) => {
          setDiscretOpen(o);
          if (!o) setPendingStatus(null);
        }}
        onConfirm={onConfirmDiscret}
        isPending={updateBien.isPending}
      />
      <PaywallPublicModal
        open={paywallOpen}
        onOpenChange={(o) => {
          setPaywallOpen(o);
          if (!o) setPendingStatus(null);
        }}
        onConfirm={onConfirmPublic}
        isPending={publishLoading || updateBien.isPending}
        favorisCount={stats?.favoris_actifs ?? 18}
      />
      <PostPublicationSuccessModal
        open={successOpen}
        onOpenChange={setSuccessOpen}
        favorisCount={stats?.favoris_actifs ?? 18}
        onViewPublicListing={() => {
          setSuccessOpen(false);
          // V1 — naviguera vers /annonces/$slug.
        }}
        onConfigureNotifications={() => {
          setSuccessOpen(false);
          setTab("parametres");
        }}
        onBuyAdsPack={() => {
          /* V2 placeholder */
        }}
      />
    </main>
  );
}

export const Route = createFileRoute("/biens/$bienId/")({
  component: BienDashboardPage,
});
