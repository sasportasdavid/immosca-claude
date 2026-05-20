import type { ValueBienPublic } from "@immoscan/db";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  Layers,
  Lock,
  MapPin,
  ShieldCheck,
  Wind,
} from "lucide-react";
import * as React from "react";

import { ConfBadge } from "@web/components/ui/conf-badge";
import { DpePill, type DpeLetter } from "@web/components/ui/dpe-pill";
import { Eyebrow } from "@web/components/ui/eyebrow";
import { AjouterFavoriButton } from "@/components/value/AjouterFavoriButton";
import { BienAnonStatusBadge } from "@/components/value/BienAnonStatusBadge";
import { BienPageHeader } from "@/components/value/BienPageHeader";
import { ContactVendeurForm } from "@/components/value/ContactVendeurForm";
import { useAnnonce } from "@/hooks/use-annonce";
import { useFavori } from "@/hooks/use-favori";
import { findMockComparables, type ComparableDvf } from "@/lib/mock-annonces";
import { cn } from "@/lib/utils";

// Route /annonces/$bienId — page bien (écran 15 discret + 16 public).
// Une seule route, le rendu adapte selon `bien.status`.

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function getField<T>(bien: ValueBienPublic, key: string): T | undefined {
  const data = (bien.bien_data ?? {}) as Record<string, unknown>;
  return data[key] as T | undefined;
}

function formatPrice(value: number): string {
  return value.toLocaleString("fr-FR").replace(/\s/g, " ") + " €";
}

function priceInRange(
  prix: number,
  low: number,
  high: number,
): "in" | "above" | "below" {
  if (prix < low) return "below";
  if (prix > high) return "above";
  return "in";
}

function formatTypeAndSize(bien: ValueBienPublic): { typeLabel: string; surface: string } {
  const type = getField<string>(bien, "type") ?? "bien";
  const pieces = getField<number>(bien, "pieces");
  const typeLabel = type === "maison" ? "Maison" : `T${pieces ?? "—"}`;
  const exact = getField<number>(bien, "surface");
  const bucket = getField<string>(bien, "surface_bucket");
  const surface =
    typeof exact === "number"
      ? `${exact} m²`
      : typeof bucket === "string"
        ? `${bucket} m²`
        : "—";
  return { typeLabel, surface };
}

function getValorisation(
  bien: ValueBienPublic,
): { low: number; high: number; confidence: number } | null {
  const v = bien.valorisation_publique as
    | { low?: number; high?: number; confidence?: number }
    | null;
  if (!v || typeof v.low !== "number" || typeof v.high !== "number") return null;
  return {
    low: v.low,
    high: v.high,
    confidence: typeof v.confidence === "number" ? v.confidence : 0.7,
  };
}

// ────────────────────────────────────────────────────────────────────
// Sections
// ────────────────────────────────────────────────────────────────────

function IdentitySection({ bien }: { bien: ValueBienPublic }) {
  const isDiscret = bien.status === "discret";
  const { typeLabel, surface } = formatTypeAndSize(bien);
  const pieces = getField<number>(bien, "pieces");
  const chambres = getField<number>(bien, "chambres");
  const dpe = getField<DpeLetter>(bien, "dpe");
  const exposition = getField<string>(bien, "exposition");
  const etat = getField<string>(bien, "etat");
  const balcon = getField<boolean>(bien, "balcon");
  const cave = getField<boolean>(bien, "cave");
  const exact = getField<number>(bien, "etage");
  const bucket = getField<string>(bien, "etage_bucket");
  const etageLabel =
    typeof exact === "number"
      ? exact === 0
        ? "RDC"
        : `${exact}ᵉ étage`
      : typeof bucket === "string"
        ? `${bucket}ᵉ étage`
        : null;

  const valo = getValorisation(bien);
  const prix = bien.prix_affiche;

  return (
    <section>
      <Eyebrow variant="terra">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-terra"
          />
          {(getField<string>(bien, "type") ?? "Bien").toUpperCase()} ·{" "}
          {pieces ?? "—"} pièces
        </span>
      </Eyebrow>

      <h1 className="mt-3 text-[28px] font-semibold leading-[1.18] tracking-[-0.022em] text-ink md:text-[30px]">
        {typeLabel}{" "}
        <span className="font-serif italic font-normal text-mute-2">de</span>{" "}
        {surface}
      </h1>

      <div className="mt-2.5 flex items-center gap-1.5 text-[14px] text-muted-ink">
        <MapPin size={14} className="text-mute-2" />
        <span>{bien.address_display}</span>
      </div>

      {/* Prix block */}
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-r-lg border border-line bg-card p-5">
        {prix != null && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute-2">
              Prix demandé par le vendeur
            </span>
            <span className="font-mono text-[28px] font-semibold leading-none tracking-[-0.018em] text-ink tnum">
              {formatPrice(prix)}
            </span>
          </div>
        )}

        {prix != null && valo && <div className="h-9 w-px bg-line" />}

        {valo && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute-2">
              Notre estimation
            </span>
            <div className="font-mono text-[16px] font-medium text-ink-2 tnum">
              {Math.round(valo.low / 1000)} – {Math.round(valo.high / 1000)} k€
            </div>
            {prix != null && (
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 text-[11.5px] font-medium",
                  priceInRange(prix, valo.low, valo.high) === "in"
                    ? "text-sage-2"
                    : "text-terra-deep",
                )}
              >
                <CheckCircle2 size={11} strokeWidth={2.5} />
                {priceInRange(prix, valo.low, valo.high) === "in"
                  ? "Prix dans la fourchette"
                  : priceInRange(prix, valo.low, valo.high) === "above"
                    ? "Prix au-dessus de la fourchette"
                    : "Prix en dessous de la fourchette"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chips caractéristiques */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip>
          <Layers size={13} className="text-mute-2" />
          {pieces ?? "—"} pièces{chambres ? ` · ${chambres} chambres` : ""}
        </Chip>
        {etageLabel && (
          <Chip>
            <span aria-hidden>⌃</span>
            {etageLabel}
            {isDiscret && (
              <span className="ml-1 rounded-[3px] bg-terra-soft px-1 py-0.5 font-mono text-[9.5px] text-terra-deep">
                ~
              </span>
            )}
          </Chip>
        )}
        <Chip>
          <DpePill letter={dpe ?? null} className="!h-[18px] !w-[18px] !text-[10px]" />
          DPE {dpe ?? "—"}
        </Chip>
        {exposition && (
          <Chip>
            <Wind size={13} className="text-mute-2" />
            Exposition {exposition}
          </Chip>
        )}
        {(balcon || cave) && (
          <Chip>
            <span aria-hidden>◇</span>
            {[balcon && "Balcon", cave && "Cave"].filter(Boolean).join(" · ")}
          </Chip>
        )}
        {etat && (
          <Chip>
            <span aria-hidden>◌</span>État {etat}
          </Chip>
        )}
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[12.5px] text-ink-2">
      {children}
    </span>
  );
}

function MapSection({ bien }: { bien: ValueBienPublic }) {
  const isDiscret = bien.status === "discret";

  return (
    <section className="mt-10">
      <h2 className="mb-3.5 text-[18px] font-semibold tracking-[-0.015em] text-ink">
        Où se situe{" "}
        <span className="font-serif italic font-normal text-terra">le bien</span>
      </h2>
      <p className="mb-4 text-[13px] text-muted-ink">
        {isDiscret
          ? "Le propriétaire teste l'intérêt du marché — la localisation est volontairement approximative à l'échelle du quartier."
          : `Adresse complète : ${bien.address_display}.`}
      </p>

      <div
        className={cn(
          "relative h-64 overflow-hidden rounded-r-lg border border-line",
          isDiscret
            ? "bg-gradient-to-br from-[#E7EBE5] to-[#DCE4DA]"
            : "bg-gradient-to-br from-[#E8EFE9] to-[#D6E0D8]",
        )}
      >
        <svg
          viewBox="0 0 800 260"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
        >
          {/* Grille rues */}
          <g stroke="rgba(255,255,255,0.55)" strokeWidth="1" fill="none">
            <line x1="0" y1="60" x2="800" y2="40" />
            <line x1="0" y1="120" x2="800" y2="105" />
            <line x1="0" y1="180" x2="800" y2="170" />
            <line x1="0" y1="240" x2="800" y2="230" />
            <line x1="120" y1="0" x2="100" y2="260" />
            <line x1="280" y1="0" x2="260" y2="260" />
            <line x1="440" y1="0" x2="420" y2="260" />
            <line x1="600" y1="0" x2="580" y2="260" />
          </g>

          {/* Zone IRIS discrète OU pin précis */}
          {isDiscret ? (
            <>
              <path
                d="M180 50 L 620 30 L 660 220 L 200 240 Z"
                fill="rgba(217,119,87,0.18)"
                stroke="#D97757"
                strokeWidth="1.5"
                strokeDasharray="5 3"
              />
              <text
                x="400"
                y="145"
                fontFamily="JetBrains Mono"
                fontSize="13"
                fill="#A8482A"
                textAnchor="middle"
                fontWeight="600"
                letterSpacing="0.8"
              >
                ZONE APPROXIMATIVE
              </text>
              <text
                x="400"
                y="162"
                fontFamily="JetBrains Mono"
                fontSize="9"
                fill="rgba(168,72,42,0.7)"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                ~ 5 rues · 1,2 km²
              </text>
            </>
          ) : (
            <>
              <circle cx="400" cy="130" r="22" fill="rgba(124,152,133,0.2)" />
              <circle cx="400" cy="130" r="11" fill="#7C9885" stroke="#fff" strokeWidth="3" />
            </>
          )}
        </svg>

        <div className="absolute bottom-3.5 left-4 flex items-center gap-2 rounded-r-sm border border-line bg-card/92 px-3 py-1.5 text-[11.5px] text-ink-2">
          {isDiscret ? (
            <>
              <Lock size={11} className="text-terra" />
              Localisation approximative · mode discret
            </>
          ) : (
            <>
              <MapPin size={11} className="text-sage-2" />
              Adresse exacte du bien
            </>
          )}
        </div>

        {isDiscret && (
          <div className="absolute right-4 top-4 rounded-r-sm border border-line bg-card/92 px-3 py-2 text-[11px] text-mute-2 backdrop-blur">
            Adresse révélée à la mise en vente publique
          </div>
        )}
      </div>
    </section>
  );
}

function EstimationSection({ bien }: { bien: ValueBienPublic }) {
  const valo = getValorisation(bien);
  if (!valo) return null;
  const prix = bien.prix_affiche;
  const inRange = prix != null && priceInRange(prix, valo.low, valo.high) === "in";

  return (
    <section className="mt-10">
      <h2 className="mb-3.5 text-[18px] font-semibold tracking-[-0.015em] text-ink">
        Notre{" "}
        <span className="font-serif italic font-normal text-terra">estimation</span>
      </h2>

      <div className="rounded-r-lg border border-line bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute-2">
            Fourchette de valorisation
          </span>
          <ConfBadge confidence={valo.confidence} />
        </div>

        <div className="mt-4 flex flex-wrap items-baseline gap-3">
          <span className="font-mono text-[24px] font-semibold tracking-[-0.018em] text-ink tnum">
            {formatPrice(valo.low)}
          </span>
          <ArrowRight size={16} className="text-mute-2" />
          <span className="font-mono text-[24px] font-semibold tracking-[-0.018em] text-ink tnum">
            {formatPrice(valo.high)}
          </span>
        </div>

        {prix != null && (
          <div className="mt-4 flex items-start gap-2 rounded-r-sm border border-line bg-bg-2/60 px-3 py-2.5 text-[12.5px] text-ink-2">
            <span
              aria-hidden
              className={cn(
                "mt-1 inline-block h-1.5 w-1.5 rounded-full",
                inRange ? "bg-sage-2" : "bg-terra",
              )}
            />
            <span>
              Le vendeur a fixé son prix à{" "}
              <strong className="font-mono font-semibold text-ink">
                {formatPrice(prix)}
              </strong>
              ,{" "}
              {inRange ? "dans la fourchette." : "en dehors de la fourchette."}
            </span>
          </div>
        )}

        <p className="mt-4 text-[12px] text-mute-2">
          Basé sur les transactions DVF récentes, les annonces publiques actives
          et les comparables fournis par le vendeur.{" "}
          <Link to="/" className="text-violet hover:underline">
            Comment on estime
          </Link>
        </p>
      </div>
    </section>
  );
}

function ComparablesSection({ bienId }: { bienId: string }) {
  const comparables = findMockComparables(bienId);
  if (comparables.length === 0) return null;

  return (
    <section className="mt-10">
      <Eyebrow>Pour situer le marché</Eyebrow>
      <h2 className="mb-1 mt-1.5 text-[18px] font-semibold tracking-[-0.015em] text-ink">
        Comparables{" "}
        <span className="font-serif italic font-normal text-terra">
          du secteur
        </span>
      </h2>
      <p className="mb-4 text-[13px] text-muted-ink">
        {comparables.length} ventes notariées récentes (source DVF, publique).
      </p>

      <div className="overflow-hidden rounded-r-lg border border-line bg-card">
        <table className="w-full text-left text-[12.5px]">
          <thead className="border-b border-line bg-bg-2/40">
            <tr className="text-[11px] uppercase tracking-[0.06em] text-mute-2">
              <th className="px-4 py-2.5 font-semibold">Bien</th>
              <th className="px-4 py-2.5 font-semibold">Secteur</th>
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 text-right font-semibold">Prix</th>
              <th className="px-4 py-2.5 text-right font-semibold">€/m²</th>
            </tr>
          </thead>
          <tbody>
            {comparables.map((c: ComparableDvf, i) => (
              <tr
                key={c.id}
                className={cn(i > 0 && "border-t border-line/70")}
              >
                <td className="px-4 py-2.5 text-ink-2">
                  T{c.pieces} · {c.surface} m²
                  {c.etage != null && ` · ${c.etage}ᵉ ét.`}
                  {c.etat && (
                    <span className="ml-1.5 text-mute-2">· {c.etat}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-mute-2">{c.secteur}</td>
                <td className="px-4 py-2.5 font-mono text-[11.5px] text-mute-2 tnum">
                  {c.date}
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-ink tnum">
                  {formatPrice(c.prix)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-mute-2 tnum">
                  {c.prix_m2.toLocaleString("fr-FR")} €
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActionPanel({ bien }: { bien: ValueBienPublic }) {
  const isDiscret = bien.status === "discret";
  const { data: favoriState } = useFavori(bien.id ?? undefined);
  const favorisActifs = bien.favoris_actifs ?? 0;
  const queuePosition = favoriState?.isFavori
    ? favorisActifs // déjà compté
    : favorisActifs + 1;

  if (isDiscret) {
    return (
      <aside className="rounded-r-lg border border-terra/30 bg-terra-soft p-6 text-terra-deep">
        <div className="mb-3 inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em]">
          <Lock size={12} />
          Pré-vente discrète
        </div>
        <h3 className="text-[20px] font-semibold leading-tight tracking-[-0.018em] text-terra-deep">
          Ce bien n'est pas encore en vente.
        </h3>
        <p className="mt-3 text-[13px] leading-[1.55] text-terra-deep/90">
          Le propriétaire teste l'intérêt du marché. Tu ne peux pas le contacter
          pour le moment — mais tu peux{" "}
          <strong className="font-semibold">
            réserver ta place dans la file d'attente
          </strong>{" "}
          : s'il passe en vente publique, tu seras prévenu en premier.
        </p>

        <div className="mt-5">
          <AjouterFavoriButton
            bienId={bien.id ?? ""}
            variant="terra"
            size="lg"
            className="w-full"
            label="Ajouter à mes favoris"
            activeLabel="Place réservée dans la file"
          />
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-r-sm border border-terra/20 bg-white/60 px-3 py-2.5">
          <span className="font-mono text-[20px] font-semibold leading-none text-terra-deep tabular-nums">
            {queuePosition}
            <span className="ml-px text-[11px] font-sans text-mute-2">ᵉ</span>
          </span>
          <span className="text-[12px] text-terra-deep/80">
            Tu seras{" "}
            <strong className="font-semibold">{queuePosition}ᵉ dans la file</strong>
            {favorisActifs > 0 && ` sur ${favorisActifs} acheteurs déjà alertés.`}
          </span>
        </div>

        <p className="mt-3 text-[11.5px] text-terra-deep/75">
          Sans engagement · 1 clic pour te désinscrire · pas de partage d'email.
        </p>

        {/* Stats panel */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-terra/20 pt-4">
          <div className="text-center">
            <div className="font-mono text-[18px] font-semibold text-terra-deep tabular-nums">
              {bien.vues_7j ?? 0}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-terra-deep/70">
              consultent
            </div>
          </div>
          <div className="text-center">
            <div className="font-mono text-[18px] font-semibold text-terra-deep tabular-nums">
              +{favorisActifs}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-terra-deep/70">
              favoris
            </div>
          </div>
        </div>
      </aside>
    );
  }

  // ── Mode public : formulaire de contact
  return (
    <aside className="space-y-3">
      <div className="rounded-r-lg border border-sage/30 bg-sage-soft p-4 text-sage-2">
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em]">
          <CheckCircle2 size={12} />
          Bien en vente
        </div>
        <h3 className="mt-1.5 text-[16px] font-semibold leading-tight text-sage-2">
          Contacte directement le vendeur
        </h3>
        <p className="mt-1.5 text-[12.5px] text-sage-2/85">
          Pas d'agence, pas de commission. Le vendeur répond généralement sous
          24 h.
        </p>
      </div>

      <ContactVendeurForm bienId={bien.id ?? ""} />

      <AjouterFavoriButton
        bienId={bien.id ?? ""}
        variant="ghost"
        size="default"
        className="w-full justify-center"
        label="Suivre cette annonce"
        activeLabel="Tu suis cette annonce"
      />
    </aside>
  );
}

function TrustSection() {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-[18px] font-semibold tracking-[-0.015em] text-ink">
        Pourquoi tu peux{" "}
        <span className="font-serif italic font-normal text-terra">
          faire confiance
        </span>
      </h2>
      <div className="grid gap-3 md:grid-cols-3">
        <TrustCard
          icon={<ShieldCheck size={16} className="text-violet" />}
          title="Estimation auditée par IA"
          desc="Chaque ajustement est traçable : DVF, ADEME, OLL, INSEE. 13 sources publiques."
        />
        <TrustCard
          icon={<Lock size={16} className="text-terra" />}
          title="Vendeur protégé"
          desc="L'identité et l'adresse exacte du vendeur restent masquées tant qu'il n'est pas en vente publique."
        />
        <TrustCard
          icon={<BarChart3 size={16} className="text-sage-2" />}
          title="Stats transparentes"
          desc="Vues, favoris, profils acheteurs — tout est compté, le vendeur voit la même chose que toi."
        />
      </div>
    </section>
  );
}

function TrustCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-r-lg border border-line bg-card p-4">
      <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-r-sm border border-line bg-bg-2">
        {icon}
      </div>
      <div className="text-[13px] font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[12px] leading-[1.5] text-muted-ink">{desc}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────

function BienPage() {
  const { bienId } = Route.useParams();
  const { data: bien, isLoading } = useAnnonce(bienId);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-bg">
        <div className="mx-auto w-full max-w-[1180px] px-6 py-10">
          <div className="h-96 animate-pulse rounded-r-lg bg-bg-2" />
        </div>
      </main>
    );
  }

  if (!bien) {
    return (
      <main className="min-h-screen bg-bg">
        <div className="mx-auto w-full max-w-[1180px] px-6 py-10 text-center">
          <h1 className="text-[24px] font-semibold text-ink">
            Annonce introuvable
          </h1>
          <p className="mt-2 text-[13px] text-muted-ink">
            Cette annonce a peut-être été retirée ou n'existe plus.
          </p>
          <Link
            to="/annonces"
            className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-violet hover:underline"
          >
            <ChevronLeft size={14} />
            Retour aux annonces
          </Link>
        </div>
      </main>
    );
  }

  const isDiscret = bien.status === "discret";

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto w-full max-w-[1180px] px-6 pb-24 pt-6 md:px-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-[12.5px] text-mute-2">
          <Link
            to="/annonces"
            className="inline-flex items-center gap-1 hover:text-ink"
          >
            <ChevronLeft size={12} />
            Annonces
          </Link>
          <span className="text-faint">·</span>
          <span className="truncate text-ink">{bien.address_display}</span>
          <span className="text-faint">·</span>
          <BienAnonStatusBadge
            status={bien.status as "discret" | "public"}
            size="sm"
          />
        </div>

        {/* Galerie photos */}
        <div className="mt-5">
          <BienPageHeader bien={bien} />
        </div>

        {/* Layout 2 colonnes */}
        <div className="mt-8 grid gap-9 lg:grid-cols-[1fr_360px]">
          <div>
            <IdentitySection bien={bien} />
            <MapSection bien={bien} />
            <EstimationSection bien={bien} />
            <ComparablesSection bienId={bien.id ?? ""} />
            <TrustSection />
          </div>

          {/* Colonne droite sticky */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <ActionPanel bien={bien} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[11.5px] text-mute-2">
          <span>
            ImmoValue · Annonce #{bien.id?.toUpperCase()} ·{" "}
            {isDiscret ? "pré-vente discrète" : "en vente publique"}
          </span>
          <Link to="/annonces" className="hover:text-ink">
            ← Toutes les annonces
          </Link>
        </footer>
      </div>
    </main>
  );
}

export const Route = createFileRoute("/annonces/$bienId")({
  component: BienPage,
});
