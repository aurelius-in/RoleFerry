export function formatDateLike(v: any): string {
  if (v === null || v === undefined) return "";

  // Common number forms
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v > 1900 && v < 2100) return String(v);
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // String forms
  const s = String(v).trim();
  if (!s) return "";
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Object-ish forms: {year, month} etc
  if (typeof v === "object") {
    const year = (v as any).year ?? (v as any).start_year ?? (v as any).startYear ?? (v as any).end_year ?? (v as any).endYear;
    const month = (v as any).month ?? (v as any).start_month ?? (v as any).startMonth ?? (v as any).end_month ?? (v as any).endMonth;
    const y = String(year ?? "").trim();
    if (/^\d{4}$/.test(y)) {
      const mNum = Number(month ?? 0);
      if (mNum >= 1 && mNum <= 12) return `${y}-${String(mNum).padStart(2, "0")}`;
      return y;
    }
  }

  // Fallback: parse
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return s;
}

