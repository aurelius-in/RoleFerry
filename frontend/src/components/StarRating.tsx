"use client";

import { useMemo } from "react";

type Props = {
  /** Any score you already have (0..1 or 0..100). */
  value: number;
  /** Interpret value as 0..1 (default) or 0..100. */
  scale?: "fraction" | "percent";
  /** Round stars to nearest integer (default). */
  rounding?: "nearest" | "floor" | "ceil";
  /** Optional label to show after stars, e.g. "4/5" */
  showNumeric?: boolean;
  className?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function StarRating({
  value,
  scale = "fraction",
  rounding = "nearest",
  showNumeric = true,
  className = "",
}: Props) {
  const { stars, title } = useMemo(() => {
    const raw = Number.isFinite(value) ? value : 0;
    const frac = scale === "percent" ? raw / 100 : raw;
    const clamped = clamp(frac, 0, 1);
    const starsRaw = clamped * 5;
    const stars =
      rounding === "floor" ? Math.floor(starsRaw) : rounding === "ceil" ? Math.ceil(starsRaw) : Math.round(starsRaw);
    const fixed = clamp(stars, 0, 5);
    return {
      stars: fixed,
      title: scale === "percent" ? `${raw}%` : `${(clamped * 100).toFixed(0)}%`,
    };
  }, [rounding, scale, value]);

  const filled = "★★★★★".slice(0, stars);
  const empty = "☆☆☆☆☆".slice(0, 5 - stars);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`} title={title} aria-label={`Rating: ${stars} out of 5`}>
      <span className="font-semibold text-yellow-300">{filled}</span>
      <span className="font-semibold text-white/25">{empty}</span>
      {showNumeric ? <span className="text-xs text-white/60">{stars}/5</span> : null}
    </span>
  );
}


