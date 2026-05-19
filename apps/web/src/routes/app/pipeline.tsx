// /app/pipeline — Kanban des biens suivis par l'utilisateur.
//
// 5 colonnes : À visiter → Visité → Offre → Compromis → Signé.
// Drag-and-drop via @dnd-kit pour faire avancer un bien dans le pipeline.
// Click sur une card → drawer édition (notes, dates, prix offre).

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ScoreBadge } from "@/components/score-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import {
  PIPELINE_STAGES,
  STAGE_LABELS,
  type ListingSnapshot,
  type PipelineItem,
  type PipelineStage,
  useDeletePipelineItem,
  usePipelineItems,
  useUpdatePipelineItem,
} from "@/hooks/use-pipeline";
import { useProfile } from "@/hooks/use-profile";
import { requireAuth, requireOnboarded } from "@/lib/auth-guards";

export const Route = createFileRoute("/app/pipeline")({
  beforeLoad: async ({ location }) => {
    const { userId } = await requireAuth({ from: location.pathname });
    await requireOnboarded({ userId });
  },
  component: PipelinePage,
});

function PipelinePage() {
  const auth = useAuth();
  const profile = useProfile();
  const items = usePipelineItems();
  const updateItem = useUpdatePipelineItem();
  const navigate = useNavigate();

  const [editingId, setEditingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Group items by stage
  const byStage = useMemo(() => {
    const map: Record<PipelineStage, PipelineItem[]> = {
      a_visiter: [],
      visite: [],
      offre: [],
      compromis: [],
      signe: [],
    };
    for (const item of items.data ?? []) {
      const s = item.stage as PipelineStage;
      if (map[s]) map[s].push(item);
    }
    return map;
  }, [items.data]);

  const editingItem =
    items.data?.find((i) => i.id === editingId) ?? null;

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const itemId = String(active.id);
    const overId = String(over.id);
    const item = items.data?.find((i) => i.id === itemId);
    if (!item) return;

    // overId est soit l'id d'un autre item, soit l'id d'une colonne ("col:stage")
    let newStage: PipelineStage | null = null;
    if (overId.startsWith("col:")) {
      newStage = overId.slice(4) as PipelineStage;
    } else {
      const overItem = items.data?.find((i) => i.id === overId);
      if (overItem) newStage = overItem.stage as PipelineStage;
    }
    if (!newStage || newStage === item.stage) return;

    // Patch stage + dates auto si c'est une étape clé
    const patch: Parameters<typeof updateItem.mutate>[0]["patch"] = {
      stage: newStage,
    };
    const today = new Date().toISOString().slice(0, 10);
    if (newStage === "visite" && !item.visite_date) patch.visite_date = today;
    if (newStage === "compromis" && !item.compromis_date)
      patch.compromis_date = today;
    if (newStage === "signe" && !item.signe_date) patch.signe_date = today;

    updateItem.mutate(
      { id: itemId, patch },
      {
        onSuccess: () => {
          toast.success(`Déplacé vers "${STAGE_LABELS[newStage!]}"`);
        },
      },
    );
  }

  const total = items.data?.length ?? 0;

  return (
    <AppShell
      userEmail={auth.user?.email ?? "—"}
      userPlan={profile.data?.subscription_plan ?? "free"}
      currentRoute="pipeline"
      onLogout={() => auth.signOut()}
      onNewAnalysis={() => navigate({ to: "/app/nouvelle-analyse" })}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-12">
        <div className="mb-8">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Pipeline
          </span>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">
            {total} bien{total > 1 ? "s" : ""} suivi{total > 1 ? "s" : ""}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Glisse une card entre les colonnes pour faire avancer un bien.
            Click sur une card pour ajouter notes, date de visite, prix d'offre.
          </p>
        </div>

        {items.isLoading ? (
          <p className="text-[13px] text-muted-foreground">Chargement…</p>
        ) : total === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em]">
              Aucun bien dans ton pipeline.
            </h2>
            <p className="mx-auto mt-2 max-w-[48ch] text-[13px] text-muted-foreground">
              Quand tu trouves un bien intéressant dans une analyse, clique
              "Ajouter au pipeline" depuis sa fiche.
            </p>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              {PIPELINE_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  items={byStage[stage]}
                  onSelectItem={setEditingId}
                />
              ))}
            </div>
          </DndContext>
        )}

        <PipelineItemDrawer
          item={editingItem}
          onClose={() => setEditingId(null)}
        />
      </div>
    </AppShell>
  );
}

function KanbanColumn({
  stage,
  items,
  onSelectItem,
}: {
  stage: PipelineStage;
  items: PipelineItem[];
  onSelectItem: (id: string) => void;
}) {
  return (
    <div className="flex flex-col">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {STAGE_LABELS[stage]}
        </h2>
        <span className="font-mono text-[11px] tabular-nums text-tertiary-foreground">
          {items.length}
        </span>
      </div>
      <SortableContext
        id={`col:${stage}`}
        items={items.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ColumnDropZone stage={stage} empty={items.length === 0}>
          {items.map((item) => (
            <PipelineCard
              key={item.id}
              item={item}
              onClick={() => onSelectItem(item.id)}
            />
          ))}
        </ColumnDropZone>
      </SortableContext>
    </div>
  );
}

function ColumnDropZone({
  stage,
  children,
  empty,
}: {
  stage: PipelineStage;
  children: React.ReactNode;
  empty: boolean;
}) {
  // Colonne entière comme drop target (pour pouvoir déposer dans une
  // colonne vide). L'id de la colonne commence par "col:" pour que
  // handleDragEnd puisse reconnaître que c'est une colonne.
  const { setNodeRef, isOver } = useDroppable({ id: `col:${stage}` });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] space-y-2 rounded-lg border p-2 transition-colors ${
        isOver
          ? "border-primary bg-primary-soft/30"
          : "border-border bg-secondary/30"
      } ${empty ? "border-dashed" : ""}`}
    >
      {children}
      {empty ? (
        <p className="py-6 text-center text-[11px] text-tertiary-foreground">
          Glisse ici
        </p>
      ) : null}
    </div>
  );
}

function PipelineCard({
  item,
  onClick,
}: {
  item: PipelineItem;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const snap = item.listing_snapshot as unknown as ListingSnapshot;
  const photo = snap.photos_urls?.[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Évite que le clic sur la card déclenche le drag (PointerSensor
        // a déjà un distance threshold, mais on s'assure que c'est un
        // vrai click et pas un dragend).
        if (!isDragging) {
          e.stopPropagation();
          onClick();
        }
      }}
      className="cursor-grab rounded-lg border border-border bg-card p-3 text-left transition-shadow hover:shadow-lvl-1 active:cursor-grabbing"
    >
      {photo ? (
        <img
          src={photo}
          alt=""
          className="mb-2 aspect-[16/10] w-full rounded-md object-cover"
        />
      ) : null}
      <div className="flex items-start gap-2">
        {snap.score_total !== null && snap.score_total !== undefined ? (
          <ScoreBadge score={snap.score_total} size="sm" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium leading-tight line-clamp-1">
            {snap.title ?? "Sans titre"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
            {snap.pieces ? `${snap.pieces}P · ` : ""}
            {snap.surface ? `${snap.surface} m² · ` : ""}
            {snap.ville ?? "—"}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[11px] tabular-nums">
        <span className="font-medium">
          {snap.prix
            ? `${Math.round(snap.prix).toLocaleString("fr-FR")} €`
            : "—"}
        </span>
        {snap.rendement_brut_pct !== null && snap.rendement_brut_pct !== undefined ? (
          <span
            className={
              snap.rendement_brut_pct >= 6
                ? "text-success-foreground"
                : "text-muted-foreground"
            }
          >
            {snap.rendement_brut_pct.toFixed(1)} %
          </span>
        ) : null}
      </div>
    </div>
  );
}

function PipelineItemDrawer({
  item,
  onClose,
}: {
  item: PipelineItem | null;
  onClose: () => void;
}) {
  const updateItem = useUpdatePipelineItem();
  const deleteItem = useDeletePipelineItem();
  const [notes, setNotes] = useState("");
  const [visiteDate, setVisiteDate] = useState("");
  const [offrePrice, setOffrePrice] = useState("");
  const [compromisDate, setCompromisDate] = useState("");
  const [signeDate, setSigneDate] = useState("");

  // Reset à l'ouverture
  useMemo(() => {
    if (item) {
      setNotes(item.notes ?? "");
      setVisiteDate(item.visite_date ?? "");
      setOffrePrice(item.offre_price ? String(item.offre_price) : "");
      setCompromisDate(item.compromis_date ?? "");
      setSigneDate(item.signe_date ?? "");
    }
  }, [item]);

  const open = item !== null;
  const snap = item ? (item.listing_snapshot as unknown as ListingSnapshot) : null;

  function save() {
    if (!item) return;
    updateItem.mutate(
      {
        id: item.id,
        patch: {
          notes: notes.trim() || null,
          visite_date: visiteDate || null,
          offre_price: offrePrice ? Number(offrePrice) : null,
          compromis_date: compromisDate || null,
          signe_date: signeDate || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Mis à jour");
          onClose();
        },
      },
    );
  }

  function remove() {
    if (!item) return;
    if (!confirm("Supprimer ce bien du pipeline ?")) return;
    deleteItem.mutate(item.id, {
      onSuccess: () => {
        toast.success("Supprimé du pipeline");
        onClose();
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        {item && snap ? (
          <>
            <SheetHeader>
              <SheetTitle>{snap.title ?? "Sans titre"}</SheetTitle>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {STAGE_LABELS[item.stage as PipelineStage]} ·{" "}
                {snap.ville ?? "—"} ·{" "}
                {snap.prix
                  ? `${Math.round(snap.prix).toLocaleString("fr-FR")} €`
                  : "—"}
              </p>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <Field label="Notes personnelles">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Pourquoi tu suis ce bien, points forts, points faibles, à vérifier en visite…"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Date de visite">
                  <input
                    type="date"
                    value={visiteDate}
                    onChange={(e) => setVisiteDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <Field label="Prix d'offre (€)">
                  <input
                    type="number"
                    step={1000}
                    value={offrePrice}
                    onChange={(e) => setOffrePrice(e.target.value)}
                    placeholder="ex. 320 000"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <Field label="Date compromis">
                  <input
                    type="date"
                    value={compromisDate}
                    onChange={(e) => setCompromisDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
                <Field label="Date signature">
                  <input
                    type="date"
                    value={signeDate}
                    onChange={(e) => setSigneDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={remove}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Supprimer du pipeline
                </Button>
                <div className="flex items-center gap-2">
                  {snap.source_url ? (
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={snap.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Voir l'annonce
                        <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                  <Button onClick={save} disabled={updateItem.isPending}>
                    {updateItem.isPending ? "Sauvegarde…" : "Enregistrer"}
                  </Button>
                </div>
              </div>
            </SheetBody>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
