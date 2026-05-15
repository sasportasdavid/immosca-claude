import { cn } from "@/lib/utils";

export type ScoreBadgeProps = {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

const SIZE_STYLES = {
  sm: "min-w-[28px] h-[20px] px-1.5 text-[11px]",
  md: "min-w-[36px] h-[24px] px-1.5 text-[13px]",
  lg: "min-w-[52px] h-[32px] px-2 text-[16px]",
} as const;

function toneFor(score: number): "excellent" | "good" | "poor" {
  if (score >= 75) return "excellent";
  if (score >= 50) return "good";
  return "poor";
}

const TONE_LABELS = {
  excellent: "Opportunité",
  good: "Correct",
  poor: "No-go",
} as const;

const TONE_BG = {
  excellent: "bg-score-excellent",
  good: "bg-score-good",
  poor: "bg-score-poor",
} as const;

export function ScoreBadge({
  score,
  size = "md",
  showLabel = false,
  className,
}: ScoreBadgeProps) {
  const tone = toneFor(score);
  const badge = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded font-mono font-semibold tabular-nums tracking-[-0.02em] text-white",
        SIZE_STYLES[size],
        TONE_BG[tone],
        className,
      )}
    >
      {Math.round(Math.max(0, Math.min(100, score)))}
    </span>
  );

  if (!showLabel) return badge;

  return (
    <span className="inline-flex items-center gap-2">
      {badge}
      <span className="text-[12px] text-muted-foreground">{TONE_LABELS[tone]}</span>
    </span>
  );
}
