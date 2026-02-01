export type BioBulletStyle = "dot" | "check" | "spark" | "star" | "arrow" | "diamond";

export type BioBgKind = "dark" | "light";

export type BioBgOption = {
  id: string;
  label: string;
  hex: string;
  kind: BioBgKind;
};

export type BioThemePrefs = {
  bg_top?: string;
  bg_bottom?: string;
  bullet_style?: BioBulletStyle | string;
  slogan_line?: string;
};

export const BIO_BG_OPTIONS: BioBgOption[] = [
  // Dark (default-friendly)
  { id: "charcoal", label: "Charcoal", hex: "#0B0F14", kind: "dark" },
  { id: "midnight", label: "Midnight Navy", hex: "#0A1330", kind: "dark" },
  { id: "deep-teal", label: "Deep Teal", hex: "#062428", kind: "dark" },
  { id: "aubergine", label: "Aubergine", hex: "#1A0F2E", kind: "dark" },
  { id: "oxblood", label: "Oxblood", hex: "#2A0B10", kind: "dark" },

  // Light (high readability with dark text)
  { id: "cream", label: "Cream", hex: "#FFF8E7", kind: "light" },
  { id: "sky", label: "Sky", hex: "#EAF4FF", kind: "light" },
  { id: "mint", label: "Mint", hex: "#E9FFF4", kind: "light" },
  { id: "lavender", label: "Lavender", hex: "#F3EEFF", kind: "light" },
  { id: "rose", label: "Rose", hex: "#FFF0F3", kind: "light" },
];

export const BIO_SLOGAN_PRESETS: string[] = [
  "High agency. Low ego.",
  "Zero fluff. High signal.",
  "Bias for action.",
  "Builds fast. Ships clean.",
  "Customer-obsessed operator.",
  "Clarity, speed, and ownership.",
  "Metrics-minded, detail-driven.",
  "Turns ambiguity into momentum.",
  "Calm under pressure.",
  "Strong opinions, loosely held.",
  "Learns fast. Improves faster.",
  "Ships value, not noise.",
];

export const BIO_BULLET_STYLES: Array<{ id: BioBulletStyle; label: string; glyph: string }> = [
  { id: "dot", label: "Dot", glyph: "•" },
  { id: "check", label: "Check", glyph: "✓" },
  { id: "spark", label: "Spark", glyph: "✦" },
  { id: "star", label: "Star", glyph: "★" },
  { id: "arrow", label: "Arrow", glyph: "→" },
  { id: "diamond", label: "Diamond", glyph: "◆" },
];

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const s = String(hex || "").trim();
  const m = s.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

// Relative luminance (sRGB)
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function guessBgKind(hex: string): BioBgKind {
  const L = luminance(hex);
  return L >= 0.55 ? "light" : "dark";
}

export function normalizeBioTheme(prefs: BioThemePrefs | null | undefined) {
  const bgTop = String(prefs?.bg_top || "").trim() || "#050505";
  const bgBottom = String(prefs?.bg_bottom || "").trim() || bgTop;
  const kindTop = guessBgKind(bgTop);
  const kindBottom = guessBgKind(bgBottom);
  const kind: BioBgKind = kindTop; // enforce single text color mode
  const safeBottom = kindBottom === kindTop ? bgBottom : bgTop;

  const bulletStyleRaw = String(prefs?.bullet_style || "dot").trim().toLowerCase();
  const bulletStyle = (["dot", "check", "spark", "star", "arrow", "diamond"].includes(bulletStyleRaw)
    ? bulletStyleRaw
    : "dot") as BioBulletStyle;

  const sloganLine = String(prefs?.slogan_line || "").trim();

  return {
    kind,
    bg_top: bgTop,
    bg_bottom: safeBottom,
    bullet_style: bulletStyle,
    slogan_line: sloganLine,
  };
}

export function computeBioColors(prefs: BioThemePrefs | null | undefined) {
  const t = normalizeBioTheme(prefs);
  const fg = t.kind === "dark" ? "#FFFFFF" : "#0B0B0B";
  const border = t.kind === "dark" ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
  // Card surfaces should always increase contrast against the chosen background.
  // - Dark bg → slightly lighter cards
  // - Light bg → slightly whiter cards (NOT grey text on grey card)
  const card = t.kind === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.78)";
  const cardStrong = t.kind === "dark" ? "rgba(0,0,0,0.24)" : "rgba(255,255,255,0.92)";
  const buttonBg = fg;
  const buttonFg = t.kind === "dark" ? "#0B0B0B" : "#FFFFFF";

  // Keep everything readable by using only black/white for text and buttons.
  // The user only chooses the background colors.
  return {
    ...t,
    fg,
    border,
    card,
    cardStrong,
    buttonBg,
    buttonFg,
  };
}

export function bulletGlyph(style: string | null | undefined): string {
  const s = String(style || "").trim().toLowerCase();
  const hit = BIO_BULLET_STYLES.find((b) => b.id === s);
  return hit?.glyph || "•";
}

export function alphaColor(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  const a = clamp01(alpha);
  if (!rgb) return `rgba(0,0,0,${a})`;
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;
}

