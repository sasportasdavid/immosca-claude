import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// ImmoScan — direction Linear/Attio/Qonto (validée mai 2026).
// Stone warm-neutral + violet brand + accent terra (Immovalue).
// Mode clair uniquement.
//
// Deux registres de couleurs sont exposés :
// 1) shadcn (background, foreground, primary, ...) : alias hsl(var(--*))
//    pour les composants shadcn/ui.
// 2) handoff (ink, violet, terra, sage, ...) : couleurs nommées qui
//    pointent directement sur les CSS vars hex (--ink, --violet, ...).
// Voir apps/web/src/index.css pour la définition des deux registres.

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // ── Registre shadcn (HSL via hsl(var(--*))) ────────────────
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        "tertiary-foreground": "hsl(var(--tertiary-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          soft: "hsl(var(--success-soft))",
          "soft-foreground": "hsl(var(--success-soft-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          soft: "hsl(var(--warning-soft))",
          "soft-foreground": "hsl(var(--warning-soft-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          soft: "hsl(var(--destructive-soft))",
          "soft-foreground": "hsl(var(--destructive-soft-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          soft: "hsl(var(--info-soft))",
          "soft-foreground": "hsl(var(--info-soft-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // Tailwind utility `bg-accent` / `text-accent-foreground` rebindée sur le
        // nouveau nom de token shadcn `--surface-hover` (le `--accent` brut est
        // désormais réservé à la brand product-agnostic livrée par
        // immoscan-unified.css). Compat shadcn future garantie sans collision.
        accent: {
          DEFAULT: "hsl(var(--surface-hover))",
          foreground: "hsl(var(--surface-hover-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Scoring ImmoScan — utilisé par <ScoreBadge />.
        score: {
          excellent: "hsl(var(--score-excellent))",
          good: "hsl(var(--score-good))",
          poor: "hsl(var(--score-poor))",
        },
        // DPE ADEME officiel (shadcn HSL).
        dpe: {
          a: "hsl(var(--dpe-a))",
          b: "hsl(var(--dpe-b))",
          c: "hsl(var(--dpe-c))",
          d: "hsl(var(--dpe-d))",
          e: "hsl(var(--dpe-e))",
          f: "hsl(var(--dpe-f))",
          g: "hsl(var(--dpe-g))",
        },

        // ── Registre handoff (HEX direct via var(--*)) ─────────────
        // Surfaces stone warm
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
        },
        bg: {
          DEFAULT: "var(--bg)",
          2: "var(--bg-2)",
          3: "var(--bg-3)",
        },
        "muted-ink": "var(--muted-ink)",
        "mute-2": "var(--mute-2)",
        faint: "var(--faint)",
        line: {
          DEFAULT: "var(--line)",
          2: "var(--line-2)",
          soft: "var(--line-soft)",
        },
        // Brand violet (handoff)
        violet: {
          DEFAULT: "var(--violet)",
          2: "var(--violet-2)",
          deep: "var(--violet-deep)",
          soft: "var(--violet-soft)",
        },
        // Accent terra (Immovalue)
        terra: {
          DEFAULT: "var(--terra)",
          2: "var(--terra-2)",
          deep: "var(--terra-deep)",
          soft: "var(--terra-soft)",
          "soft-2": "var(--terra-soft-2)",
        },
        // Sage (positif doux Immovalue)
        sage: {
          DEFAULT: "var(--sage)",
          2: "var(--sage-2)",
          soft: "var(--sage-soft)",
        },
        // Photo placeholders (Immovalue)
        photo: {
          bg: "var(--photo-bg)",
          "bg-2": "var(--photo-bg-2)",
        },
      },
      borderRadius: {
        // Shadcn (calculées à partir de --radius)
        xl: "var(--radius-xl)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Handoff (échelle --r-*)
        "r-xs": "var(--r-xs)",
        "r-sm": "var(--r-sm)",
        r: "var(--r)",
        "r-md": "var(--r-md)",
        "r-lg": "var(--r-lg)",
        "r-xl": "var(--r-xl)",
        "r-2xl": "var(--r-2xl)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        // Handoff (alias sur --lvl-* / --ring-*)
        "lvl-1": "var(--lvl-1)",
        "lvl-2": "var(--lvl-2)",
        "lvl-3": "var(--lvl-3)",
        "ring-violet": "var(--ring-violet)",
        "ring-terra": "var(--ring-terra)",
      },
      backgroundImage: {
        // Gradients handoff (les seuls autorisés).
        "violet-grad": "var(--violet-grad)",
        "violet-grad-2": "var(--violet-grad-2)",
        "terra-grad": "var(--terra-grad)",
        "terra-grad-2": "var(--terra-grad-2)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
