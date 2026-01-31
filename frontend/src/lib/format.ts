const LOWER_WORDS = new Set([
  "of",
  "and",
  "the",
  "for",
  "to",
  "in",
  "at",
  "on",
  "a",
  "an",
]);

function smartTitleCaseWord(word: string): string {
  const w = String(word || "").trim();
  if (!w) return "";

  // Preserve short acronyms (IBM, AWS, AI, etc.)
  if (w.length <= 6 && w === w.toUpperCase() && /[A-Z]/.test(w)) return w;

  // Preserve words with digits/symbols commonly used in company names (e.g., 3M, 7-Eleven)
  if (/[0-9]/.test(w)) return w;

  const low = w.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

/**
 * Display-only company name normalization.
 * - Title-cases words while preserving short acronyms
 * - Keeps punctuation separators (/ - . &) intact
 * - Avoids changing email addresses (callers should not pass emails here)
 */
export function formatCompanyName(input?: string): string {
  const raw = String(input || "");
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return "";
  // If this looks like an email, don't touch it.
  if (s.includes("@")) return s;
  // Preserve existing brand casing when the string is already mixed-case (e.g., "eBay", "LinkedIn", "iRobot").
  // We only "fix" names that are fully lower/upper or otherwise un-styled.
  if (/[A-Z]/.test(s) && /[a-z]/.test(s)) return s;

  const words = s.split(/\s+/).filter(Boolean);
  const out = words.map((w, idx) => {
    // Keep separators inside a token (e.g. Foo-Bar, Foo/Bar, Foo.Bar)
    const parts = w.split(/([\/&\-.])/g);
    const rebuilt = parts
      .map((p) => {
        if (p === "/" || p === "-" || p === "." || p === "&") return p;
        const raw = p.trim();
        if (!raw) return raw;
        const low = raw.toLowerCase();
        if (idx > 0 && LOWER_WORDS.has(low)) return low;
        return smartTitleCaseWord(raw);
      })
      .join("");
    return rebuilt;
  });
  return out.join(" ");
}

