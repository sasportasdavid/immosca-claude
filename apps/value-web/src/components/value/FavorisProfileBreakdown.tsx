import { cn } from "@/lib/utils";

// FavorisProfileBreakdown — barre horizontale empilée (3 segments) :
// investisseurs / primo-accédants / secundo-accédants. Avec légende
// chiffrée sous chaque segment. Calque du `.profile-bar` + `.profile-legend`
// du handoff `Immovalue - Stats discret.html`.
//
// Couleurs respectent le brief :
//   - investisseurs : violet (brand ImmoScan)
//   - primo         : terra (ImmoValue)
//   - secundo       : sage (positif doux)

export interface FavorisProfileBreakdownProps {
  pctInvestisseurs: number;
  pctPrimo: number;
  pctSecundo: number;
  totalFavoris: number;
  className?: string;
}

export function FavorisProfileBreakdown({
  pctInvestisseurs,
  pctPrimo,
  pctSecundo,
  totalFavoris,
  className,
}: FavorisProfileBreakdownProps) {
  const countInv = Math.round((pctInvestisseurs / 100) * totalFavoris);
  const countPrimo = Math.round((pctPrimo / 100) * totalFavoris);
  const countSecundo = Math.round((pctSecundo / 100) * totalFavoris);

  return (
    <div className={cn("rounded-r-lg border border-line bg-card p-6", className)}>
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-mute-2">
        Profils acheteurs
      </div>
      <div className="mt-1.5 text-[16px] font-semibold tracking-[-0.01em] text-ink">
        Qui suit ton bien&nbsp;?
      </div>

      <div className="mt-[18px] flex h-3 overflow-hidden rounded-full">
        <div className="bg-violet" style={{ flex: pctInvestisseurs }} />
        <div className="bg-terra" style={{ flex: pctPrimo }} />
        <div className="bg-sage" style={{ flex: pctSecundo }} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <LegendItem
          color="bg-violet"
          pct={pctInvestisseurs}
          label="Investisseurs locatifs"
          sub={`${countInv} sur ${totalFavoris} favoris`}
        />
        <LegendItem
          color="bg-terra"
          pct={pctPrimo}
          label="Primo-accédants"
          sub={`${countPrimo} sur ${totalFavoris} favoris`}
        />
        <LegendItem
          color="bg-sage"
          pct={pctSecundo}
          label="Secundo-accédants"
          sub={`${countSecundo} sur ${totalFavoris} favoris`}
        />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  pct,
  label,
  sub,
}: {
  color: string;
  pct: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden
        className={cn("mt-[6px] inline-block h-2 w-2 rounded-sm", color)}
      />
      <div>
        <div className="font-mono text-[20px] font-semibold tracking-[-0.01em] text-ink tnum">
          {pct}%
        </div>
        <div className="text-[12px] text-muted-ink">{label}</div>
        <div className="mt-0.5 text-[11px] text-mute-2">{sub}</div>
      </div>
    </div>
  );
}
