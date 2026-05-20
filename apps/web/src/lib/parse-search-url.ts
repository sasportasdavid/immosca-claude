// Parse une URL de recherche SeLoger ou Leboncoin pour en extraire les
// caractéristiques principales lisibles (type de bien, lieu, fourchette
// prix/surface). Best-effort : si on ne reconnaît pas un champ, on le
// skip plutôt que de planter.
//
// L'output est une liste de "chips" : `[{ label, value }]` à afficher en
// petits badges sous le titre. Si la liste est vide, l'UI affiche
// simplement l'URL raccourcie.

export type SearchCriterion = { label: string; value: string };

const SELOGER_TYPES: Record<string, string> = {
  "1": "Appartement",
  "2": "Maison",
  "3": "Terrain",
  "4": "Local commercial",
  "5": "Immeuble",
  "9": "Parking",
};

const SELOGER_PROJECTS: Record<string, string> = {
  "1": "Location",
  "2": "Achat",
  "5": "Neuf",
  "11": "Viager",
};

function fmtEur(n: number): string {
  return `${n.toLocaleString("fr-FR")} €`;
}

export function parseSearchUrl(
  url: string,
  site: "seloger" | "leboncoin" | "bienici" | string,
): SearchCriterion[] {
  if (site === "seloger") return parseSeloger(url);
  if (site === "leboncoin") return parseLeboncoin(url);
  // Fallback : on ne reconnaît pas, pas de chips.
  return [];
}

function parseSeloger(url: string): SearchCriterion[] {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [];
  }
  const out: SearchCriterion[] = [];
  const params = u.searchParams;

  // projects=2 (achat) / 1 (location)
  const projects = params.get("projects") ?? params.get("distributionTypes");
  if (projects) {
    const labels = projects
      .split(",")
      .map((p) => SELOGER_PROJECTS[p.trim()] ?? p.trim())
      .join(", ");
    if (labels && !/buy/i.test(labels)) {
      out.push({ label: "Projet", value: labels });
    } else if (/buy/i.test(projects)) {
      out.push({ label: "Projet", value: "Achat" });
    }
  } else if (/distributionTypes=Buy/i.test(url)) {
    out.push({ label: "Projet", value: "Achat" });
  }

  // types=1,2 ou estateTypes=House,Apartment
  const types = params.get("types");
  const estateTypes = params.get("estateTypes");
  if (types) {
    const labels = types
      .split(",")
      .map((t) => SELOGER_TYPES[t.trim()] ?? null)
      .filter((l): l is string => !!l)
      .join(", ");
    if (labels) out.push({ label: "Type", value: labels });
  } else if (estateTypes) {
    const map: Record<string, string> = {
      Apartment: "Appartement",
      House: "Maison",
      Land: "Terrain",
      Building: "Immeuble",
    };
    const labels = estateTypes
      .split(",")
      .map((t) => map[t.trim()] ?? t.trim())
      .join(", ");
    if (labels) out.push({ label: "Type", value: labels });
  }

  // places=[{cp:93220}] ou [{ci:930032}]
  const places = params.get("places");
  if (places) {
    const cpMatches = [...places.matchAll(/cp:(\d{4,5})/g)].map((m) => m[1]);
    if (cpMatches.length > 0) {
      out.push({
        label: "Localité",
        value: cpMatches.filter((v): v is string => !!v).join(", "),
      });
    }
  }

  // price=NaN/200000 ou priceMax
  const price = params.get("price");
  const priceMax = params.get("priceMax");
  const priceMin = params.get("priceMin");
  if (price) {
    const m = price.match(/(\w+)\/(\w+)/);
    if (m) {
      const min = m[1] === "NaN" ? null : Number(m[1]);
      const max = m[2] === "NaN" ? null : Number(m[2]);
      if (min && max) {
        out.push({ label: "Prix", value: `${fmtEur(min)} – ${fmtEur(max)}` });
      } else if (max) {
        out.push({ label: "Prix max", value: fmtEur(max) });
      } else if (min) {
        out.push({ label: "Prix min", value: fmtEur(min) });
      }
    }
  } else if (priceMax || priceMin) {
    if (priceMax && priceMin) {
      out.push({
        label: "Prix",
        value: `${fmtEur(Number(priceMin))} – ${fmtEur(Number(priceMax))}`,
      });
    } else if (priceMax) {
      out.push({ label: "Prix max", value: fmtEur(Number(priceMax)) });
    } else if (priceMin) {
      out.push({ label: "Prix min", value: fmtEur(Number(priceMin)) });
    }
  }

  // surface=30/80
  const surface = params.get("surface");
  if (surface) {
    const m = surface.match(/(\w+)\/(\w+)/);
    if (m) {
      const min = m[1] === "NaN" ? null : Number(m[1]);
      const max = m[2] === "NaN" ? null : Number(m[2]);
      if (min && max) {
        out.push({ label: "Surface", value: `${min} – ${max} m²` });
      } else if (min) {
        out.push({ label: "Surface min", value: `${min} m²` });
      } else if (max) {
        out.push({ label: "Surface max", value: `${max} m²` });
      }
    }
  }

  // natures=1,2,4 (ancien/neuf/viager — peu lisible, on skip)
  // qsVersion / parameters de tracking : skip

  return out;
}

function parseLeboncoin(url: string): SearchCriterion[] {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return [];
  }
  const out: SearchCriterion[] = [];
  const params = u.searchParams;

  // category=9 (ventes immobilières)
  // real_estate_type=1,2,3,4 (1=maison, 2=appartement, 3=terrain, 4=autre)
  const ret = params.get("real_estate_type");
  if (ret) {
    const map: Record<string, string> = {
      "1": "Maison",
      "2": "Appartement",
      "3": "Terrain",
      "4": "Autre",
    };
    const labels = ret
      .split(",")
      .map((t) => map[t.trim()] ?? null)
      .filter((l): l is string => !!l)
      .join(", ");
    if (labels) out.push({ label: "Type", value: labels });
  }

  // locations=Paris_75001 / locations=r_18 (r_18 = code région)
  const locations = params.get("locations");
  if (locations) {
    out.push({
      label: "Localité",
      value: locations.replace(/_/g, " ").slice(0, 60),
    });
  }

  // price=10000-200000
  const price = params.get("price");
  if (price) {
    const m = price.match(/(\d+)-(\d+)/);
    if (m) {
      out.push({
        label: "Prix",
        value: `${fmtEur(Number(m[1]))} – ${fmtEur(Number(m[2]))}`,
      });
    } else if (/^max:?(\d+)/.test(price)) {
      const max = price.match(/\d+/)?.[0];
      if (max) out.push({ label: "Prix max", value: fmtEur(Number(max)) });
    }
  }

  // square=10-80
  const square = params.get("square");
  if (square) {
    const m = square.match(/(\d+)-(\d+)/);
    if (m) {
      out.push({ label: "Surface", value: `${m[1]} – ${m[2]} m²` });
    }
  }

  return out;
}
