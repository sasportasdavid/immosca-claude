// AnalysisActions — boutons favori / archiver / désarchiver sur la page
// rapport d'une analyse. Compact à droite du header.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

type Props = {
  analysisId: string;
  isFavorite: boolean;
  archivedAt: string | null;
};

export function AnalysisActions({
  analysisId,
  isFavorite,
  archivedAt,
}: Props) {
  const queryClient = useQueryClient();

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("analyses")
        .update({ is_favorite: !isFavorite })
        .eq("id", analysisId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      toast.success(isFavorite ? "Retiré des favoris" : "Ajouté aux favoris");
    },
    onError: () => toast.error("Action impossible"),
  });

  const toggleArchive = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("analyses")
        .update({
          archived_at: archivedAt ? null : new Date().toISOString(),
        })
        .eq("id", analysisId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analysis", analysisId] });
      queryClient.invalidateQueries({ queryKey: ["analyses"] });
      toast.success(archivedAt ? "Désarchivée" : "Archivée");
    },
    onError: () => toast.error("Action impossible"),
  });

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleFavorite.mutate()}
        disabled={toggleFavorite.isPending}
        title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        aria-label="Favori"
      >
        <Star
          className={`h-3.5 w-3.5 ${
            isFavorite ? "fill-warning text-warning" : ""
          }`}
        />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => toggleArchive.mutate()}
        disabled={toggleArchive.isPending}
        title={archivedAt ? "Désarchiver" : "Archiver"}
        aria-label="Archive"
      >
        {archivedAt ? (
          <ArchiveRestore className="h-3.5 w-3.5" />
        ) : (
          <Archive className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
