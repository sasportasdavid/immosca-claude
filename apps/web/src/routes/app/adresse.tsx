// /app/adresse — Module "Adresse à partir d'un lien"
//
// User colle une URL d'annonce (LBC, PAP, SeLoger, Bien'ici) → on lui
// retourne l'adresse exacte du bien via ADEME DPE + BAN reverse.
//
// Flow :
//   1. User entre l'URL → POST /functions/v1/resolve-address
//   2. Récupère un lookupId, status='pending'
//   3. Polling sur la row toutes les 2s jusqu'à status='done' | 'failed'
//   4. Affiche l'adresse + mini carte + métadonnées listing

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  MapPin,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ListingMap } from "@/components/listing-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/app/adresse")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: AdressePage,
});

type AddressLookup = {
  id: string;
  status: "pending" | "done" | "failed";
  url: string;
  source_site: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  city: string | null;
  postal_code: string | null;
  resolution_source: string | null;
  confidence: number | null;
  listing_title: string | null;
  listing_price: number | null;
  listing_surface: number | null;
  listing_dpe: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

const SOURCE_LABELS: Record<string, { label: string; tone: "success" | "warning" | "info" }> = {
  ademe: { label: "ADEME DPE — adresse exacte", tone: "success" },
  ban_reverse: { label: "BAN reverse — rue à proximité", tone: "warning" },
  scraped: { label: "Source — adresse extraite directement", tone: "success" },
  none: { label: "Approximation ville/CP", tone: "warning" },
};

function AdressePage() {
  const auth = useAuth();
  const profile = useProfile();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState("");
  const [activeLookupId, setActiveLookupId] = useState<string | null>(null);

  // History — 10 derniers lookups du user
  const history = useQuery({
    queryKey: ["address_lookups", auth.user?.id],
    queryFn: async () => {
      if (!auth.user) return [];
      const { data, error } = await supabase
        .from("address_lookups")
        .select(
          "id,status,url,source_site,address,lat,lng,city,postal_code,resolution_source,confidence,listing_title,listing_price,listing_surface,listing_dpe,error_message,created_at,completed_at",
        )
        .eq("profile_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AddressLookup[];
    },
    enabled: !!auth.user,
  });

  // Polling sur le lookup actif
  const activeLookup = useQuery({
    queryKey: ["address_lookup", activeLookupId],
    queryFn: async () => {
      if (!activeLookupId) return null;
      const { data, error } = await supabase
        .from("address_lookups")
        .select(
          "id,status,url,source_site,address,lat,lng,city,postal_code,resolution_source,confidence,listing_title,listing_price,listing_surface,listing_dpe,error_message,created_at,completed_at",
        )
        .eq("id", activeLookupId)
        .single();
      if (error) throw error;
      return data as AddressLookup;
    },
    enabled: !!activeLookupId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" ? 2000 : false;
    },
  });

  // Submit
  const submit = useMutation({
    mutationFn: async (rawUrl: string) => {
      const trimmed = rawUrl.trim();
      if (!trimmed) throw new Error("URL vide");
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error("URL doit commencer par https://");
      }
      const res = await supabase.functions.invoke("resolve-address", {
        body: { url: trimmed },
      });
      if (res.error) {
        // L'erreur de Supabase Functions peut contenir le body JSON
        const body = (res.error as { context?: { body?: string } }).context?.body;
        if (body) {
          try {
            const parsed = JSON.parse(body);
            throw new Error(parsed.error ?? res.error.message);
          } catch {
            // pas du JSON
          }
        }
        throw new Error(res.error.message);
      }
      const data = res.data as { lookupId: string; cached: boolean };
      return data;
    },
    onSuccess: (data) => {
      setActiveLookupId(data.lookupId);
      void queryClient.invalidateQueries({ queryKey: ["address_lookups"] });
      if (data.cached) {
        toast.success("Adresse trouvée (cache)");
      } else {
        toast.info("Recherche en cours… (~15-60s)");
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erreur");
    },
  });

  const isFree = (profile.data?.subscription_plan ?? "free") === "free";

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="adresse"
      onLogout={() => auth.signOut()}
    >
      <div className="mx-auto max-w-[840px] px-6 py-12">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Adresse à partir d'un lien
        </span>
        <h1 className="mt-2 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Colle l'URL d'une annonce.
        </h1>
        <p className="mt-3 max-w-[560px] text-[14px] text-muted-foreground">
          On récupère l'adresse exacte du bien (numéro + rue) en
          recoupant le DPE de l'annonce avec la base ADEME. Si le DPE
          n'est pas renseigné, on retombe sur le géocodage inverse des
          coordonnées GPS (rue à proximité).
        </p>
        {isFree ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            <span className="font-semibold">Plan Free</span> : 5 lookups
            / jour. Pro & Pro+ illimité.
          </p>
        ) : null}

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate(url);
          }}
          className="mt-8 flex flex-col gap-3 sm:flex-row"
        >
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.leboncoin.fr/ad/ventes_immobilieres/..."
              className="pl-9 font-mono text-[13px]"
              required
              disabled={submit.isPending}
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={submit.isPending || !url.trim()}
          >
            {submit.isPending ? "Lancement…" : "Trouver l'adresse"}
          </Button>
        </form>

        {/* Warning PAP : leur anti-bot (Cloudflare Turnstile) bloque
            même les navigateurs headless. L'extraction est instable. */}
        {/pap\.fr/i.test(url) ? (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning-soft/50 p-3 text-[12.5px]">
            <span className="font-semibold">PAP a un anti-bot Cloudflare strict</span>
            {" — "}
            l'extraction prend ~1 minute et peut échouer. Si possible, cherche
            la même annonce sur SeLoger, Leboncoin ou Bien'ici (taux de succès
            bien meilleur).
          </div>
        ) : null}

        {/* Active lookup */}
        {activeLookupId ? (
          <div className="mt-8">
            <LookupCard lookup={activeLookup.data} />
          </div>
        ) : null}

        {/* History */}
        {history.data && history.data.length > 0 ? (
          <div className="mt-12">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Historique récent
            </h2>
            <div className="mt-3 space-y-2">
              {history.data
                .filter((l) => l.id !== activeLookupId)
                .map((lookup) => (
                  <button
                    key={lookup.id}
                    type="button"
                    onClick={() => setActiveLookupId(lookup.id)}
                    className="block w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">
                          {lookup.address ??
                            lookup.listing_title ??
                            "Sans adresse"}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {lookup.url}
                        </div>
                      </div>
                      <StatusBadge status={lookup.status} />
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function LookupCard({ lookup }: { lookup: AddressLookup | null | undefined }) {
  if (!lookup) return null;

  if (lookup.status === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <div className="text-[14px] font-medium">Recherche en cours…</div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            On scrape l'annonce, puis on croise avec la base ADEME. Compte
            15-60 secondes.
          </p>
        </div>
      </div>
    );
  }

  if (lookup.status === "failed") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 text-destructive" />
          <div className="text-[14px] font-medium text-destructive">
            Échec de la résolution
          </div>
        </div>
        {lookup.error_message ? (
          <p className="mt-2 font-mono text-[12px] text-muted-foreground">
            {lookup.error_message}
          </p>
        ) : null}
      </div>
    );
  }

  // done
  const sourceInfo = lookup.resolution_source
    ? SOURCE_LABELS[lookup.resolution_source]
    : null;
  const hasCoords = lookup.lat !== null && lookup.lng !== null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
                Adresse
              </div>
              <div className="mt-1 text-[18px] font-semibold leading-tight">
                {lookup.address ?? "—"}
              </div>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success-foreground" />
        </div>
        {sourceInfo ? (
          <div className="mt-3 flex items-center gap-2">
            <Badge
              variant={
                sourceInfo.tone === "success"
                  ? "success"
                  : sourceInfo.tone === "warning"
                    ? "warning"
                    : "default"
              }
            >
              {sourceInfo.label}
            </Badge>
            {lookup.confidence !== null ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                Confiance · {Math.round(lookup.confidence * 100)}%
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Métadonnées listing */}
        {(lookup.listing_title || lookup.listing_price || lookup.listing_surface) ? (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-[13px] md:grid-cols-4">
            {lookup.listing_title ? (
              <div className="col-span-2 md:col-span-4">
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Titre
                </div>
                <div className="mt-0.5 line-clamp-1">{lookup.listing_title}</div>
              </div>
            ) : null}
            {lookup.listing_price ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Prix
                </div>
                <div className="mt-0.5 font-mono tabular-nums">
                  {lookup.listing_price.toLocaleString("fr-FR")} €
                </div>
              </div>
            ) : null}
            {lookup.listing_surface ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Surface
                </div>
                <div className="mt-0.5 font-mono tabular-nums">
                  {lookup.listing_surface} m²
                </div>
              </div>
            ) : null}
            {lookup.listing_dpe ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  DPE
                </div>
                <div className="mt-0.5 font-mono font-semibold">
                  {lookup.listing_dpe}
                </div>
              </div>
            ) : null}
            {lookup.source_site ? (
              <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                  Source
                </div>
                <div className="mt-0.5 capitalize">{lookup.source_site}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={lookup.url} target="_blank" rel="noopener noreferrer">
              Voir l'annonce
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          </Button>
          {hasCoords && lookup.address ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lookup.address)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ouvrir Google Maps
                <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Mini carte */}
      {hasCoords ? (
        <ListingMap
          lat={lookup.lat!}
          lng={lookup.lng!}
          address={lookup.address}
          heightClass="h-[320px]"
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "done" | "failed" }) {
  if (status === "pending") {
    return (
      <Badge variant="default">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        En cours
      </Badge>
    );
  }
  if (status === "done") {
    return <Badge variant="success">Trouvée</Badge>;
  }
  return <Badge variant="danger">Échec</Badge>;
}
