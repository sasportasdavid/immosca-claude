// AnalysisMap — carte globale des biens d'une analyse.
//
// MapLibre GL JS + tiles OSM (gratuit, illimité). Géocodage des biens
// par centroïde commune + jitter (la majorité des actors Apify ne
// renvoient pas la lat/lng exacte). Markers colorés par verdict, click
// → ouvre le drawer fiche bien (via onSelectListing callback).
//
// Pas de cluster Mapbox lourd pour le MVP — on a max 500 biens et
// MapLibre les rend bien.

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  geocodeListingsBatch,
  type ListingPosition,
} from "@/lib/geocode-commune";

type Listing = {
  id: string;
  code_postal: string | null;
  ville: string | null;
  lat: number | null;
  lng: number | null;
  is_masked: boolean;
  verdict: "a_visiter" | "sous_reserve" | "no_go" | null;
};

type Props = {
  listings: Listing[];
  onSelectListing: (id: string) => void;
};

const VERDICT_COLOR: Record<string, string> = {
  a_visiter: "#22c55e", // success
  sous_reserve: "#f59e0b", // warning
  no_go: "#ef4444", // destructive
};

export function AnalysisMap({ listings, onSelectListing }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [positions, setPositions] = useState<ListingPosition[]>([]);
  const [loading, setLoading] = useState(true);

  // Géocode au mount / quand listings change. On utilise la longueur
  // comme proxy pour éviter de re-géocoder à chaque re-render.
  const listingsKey = useMemo(
    () => listings.map((l) => l.id).join(","),
    [listings],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    geocodeListingsBatch(listings).then((pos) => {
      if (!cancelled) {
        setPositions(pos);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingsKey]);

  // Init MapLibre une fois (positions set)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (positions.length === 0) return;

    // Centre = moyenne des positions ; zoom auto pour fit
    const avgLat =
      positions.reduce((s, p) => s + p.lat, 0) / positions.length;
    const avgLng =
      positions.reduce((s, p) => s + p.lng, 0) / positions.length;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
        ],
      },
      center: [avgLng, avgLat],
      zoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [positions]);

  // Update markers quand positions ou listings changent
  useEffect(() => {
    const map = mapRef.current;
    if (!map || positions.length === 0) return;

    // Cleanup anciens markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Index listings by id pour récupérer verdict
    const byId = new Map(listings.map((l) => [l.id, l]));

    // Fit bounds sur les positions (si > 1)
    if (positions.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      positions.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
    }

    for (const pos of positions) {
      const l = byId.get(pos.id);
      if (!l) continue;
      const color = l.verdict
        ? VERDICT_COLOR[l.verdict]!
        : "#6b7280"; // gris si pas de verdict

      const el = document.createElement("button");
      el.style.cssText = `
        width: 14px; height: 14px; border-radius: 50%;
        background: ${color};
        border: 2px solid white;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
        cursor: pointer;
        padding: 0;
      `;
      el.setAttribute("aria-label", `Bien ${pos.id}`);
      el.onclick = (e) => {
        e.stopPropagation();
        onSelectListing(pos.id);
      };

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([pos.lng, pos.lat])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [positions, listings, onSelectListing]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-r-lg border border-line bg-bg-2">
        <p className="text-[13px] text-mute-2">
          Géocodage des biens en cours…
        </p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center rounded-r-lg border border-dashed border-line bg-card p-6 text-center shadow-lvl-1">
        <p className="text-[13px] text-mute-2">
          Localisation indisponible pour ces biens (pas de code postal ou
          de ville renseignés).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="h-[480px] w-full overflow-hidden rounded-r-lg border border-line bg-bg-2 shadow-lvl-1"
      />
      <div className="flex items-center justify-between gap-3 text-[11px] text-mute-2">
        <div className="flex items-center gap-3">
          <Legend color={VERDICT_COLOR.a_visiter!} label="À visiter" />
          <Legend color={VERDICT_COLOR.sous_reserve!} label="Sous réserve" />
          <Legend color={VERDICT_COLOR.no_go!} label="No-go" />
        </div>
        <span>
          {positions.length} biens · localisation au niveau adresse
        </span>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full border border-white shadow"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
