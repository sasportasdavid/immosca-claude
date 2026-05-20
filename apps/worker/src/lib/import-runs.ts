// Helper pour tracer les exécutions des tasks d'import dans la table
// `import_runs` du projet immoscan-data.
//
// Wrappe chaque task : INSERT status=running → exécute → UPDATE status
// success/failed avec metadata + rows_imported. Re-throw l'erreur après
// tracking pour que Trigger.dev voie le fail et applique son retry.

import type { Json } from "@immoscan/db/data";

import { Sentry } from "@/lib/sentry";
import { supabaseData } from "@/lib/supabase";

export type ImportRunSource =
  | "dvf"
  | "insee_iris"
  | "insee_filosofi"
  | "ademe"
  | "oll"
  | "encadrement"
  | "georisques"
  | "ban"
  | "education"
  | "banque_de_france";

export type ImportRunResult = {
  rowsImported?: number;
  metadata?: Record<string, unknown>;
};

export async function withImportRun<T extends ImportRunResult>(
  source: ImportRunSource,
  fn: (helpers: {
    runId: string;
    log: (msg: string, extra?: Record<string, unknown>) => void;
  }) => Promise<T>,
): Promise<T> {
  const { data, error } = await supabaseData
    .from("import_runs")
    .insert({
      source,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    // Le tracking est best-effort : on ne fail pas l'import à cause de ça.
    Sentry.captureException(error, {
      extra: { context: "import_runs insert failed", source },
    });
    return fn({ runId: "untracked", log: () => undefined });
  }

  const runId = data.id;
  const log = (msg: string, extra?: Record<string, unknown>) => {
    console.warn(`[import:${source}:${runId}] ${msg}`, extra ?? {});
  };

  try {
    const result = await fn({ runId, log });
    await supabaseData
      .from("import_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        rows_imported: result.rowsImported ?? null,
        metadata: (result.metadata ?? null) as Json,
      })
      .eq("id", runId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabaseData
      .from("import_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", runId);
    Sentry.captureException(err, {
      tags: { import_source: source, import_run_id: runId },
    });
    throw err;
  }
}
