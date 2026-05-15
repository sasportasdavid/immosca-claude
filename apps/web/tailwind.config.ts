import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// ImmoScan — direction Linear/Attio/Qonto (validée mai 2026).
// Stone warm-neutral + violet brand. Mode clair uniquement.
// Tokens définis dans index.css en CSS vars HSL ; ce fichier les expose
// en utilitaires Tailwind. Aucun hex hardcodé ici sauf les valeurs DPE
// (couleurs ADEME officielles, hors palette neutre).

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
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
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
        // DPE ADEME officiel.
        dpe: {
          a: "hsl(var(--dpe-a))",
          b: "hsl(var(--dpe-b))",
          c: "hsl(var(--dpe-c))",
          d: "hsl(var(--dpe-d))",
          e: "hsl(var(--dpe-e))",
          f: "hsl(var(--dpe-f))",
          g: "hsl(var(--dpe-g))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        "lvl-1": "0 1px 2px rgba(0,0,0,0.04)",
        "lvl-2": "0 4px 12px rgba(0,0,0,0.06)",
        "lvl-3": "0 16px 48px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
