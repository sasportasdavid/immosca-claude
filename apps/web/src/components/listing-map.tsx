// ListingMap — mini-carte d'un seul bien (utilisée dans le drawer fiche).
//
// Plus simple que `analysis-map.tsx` (qui gère 100-500 biens + dédup
// communes + click select) : ici on a 1 point fixe et un marker.
//
// Si lat/lng absents, on rend rien — pas de fallback géocodage (le
// worker s'en est déjà occupé via BAN ou ADEME). Si pas de coords,
// c'est que l'adresse n'a pas matché — afficher une carte centrée
// sur la ville serait trompeur (l'user croirait à un bien centre-ville).

import "maplibre-gl/dist/maplibre-gl.css";

import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

type Props = {
  lat: number;
  lng: number;
  /** Adresse à afficher en popup du marker. */
  address?: string | null;
  /** Couleur du marker selon verdict (vert/orange/rouge). */
  verdict?: "a_visiter" | "sous_reserve" | "no_go" | null;
  /** Hauteur en px ou unité Tailwind (defaut 240px). */
  heightClass?: string;
};

const VERDICT_COLOR: Record<string, string> = {
  a_visiter: "#22c55e",
  sous_reserve: "#f59e0b",
  no_go: "#ef4444",
};

export function ListingMap({
  lat,
  lng,
  address,
  verdict,
  heightClass = "h-[240px]",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

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
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [lng, lat],
      // Zoom serré pour qu'on voie le quartier autour du point
      zoom: 15,
      // Pas de rotation — on est en mode "où c'est sur une carte", pas en
      // mode exploration 3D. Plus simple visuellement.
      pitchWithRotate: false,
      dragRotate: false,
      touchZoomRotate: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // Marker couleur verdict (defaut bleu primaire si pas de verdict)
    const color = verdict ? VERDICT_COLOR[verdict] : "#0ea5e9";
    const marker = new maplibregl.Marker({ color }).setLngLat([lng, lat]);

    if (address) {
      // Popup avec adresse — affichée d'office sur desktop (les markers
      // tout petits sans contexte donnent juste un point flottant qui
      // n'apprend rien).
      const popup = new maplibregl.Popup({
        closeButton: false,
        offset: 24,
        className: "listing-map-popup",
      }).setText(address);
      marker.setPopup(popup);
    }

    marker.addTo(map);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Les coords ne changent pas pendant la vie du drawer (un bien =
    // un point fixe). Si elles changent on dispose le drawer + remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={`${heightClass} w-full overflow-hidden rounded-lg border border-border`}
    />
  );
}
