"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMockTable, type DataKey } from "@/lib/mockData";

const ITEMS: { key: DataKey; label: string }[] = [
  { key: "messages", label: "Messages" },
  { key: "sequence", label: "Sequence Rows" },
  { key: "campaigns", label: "Campaigns" },
  { key: "onepager", label: "One‑pagers" },
  { key: "warmAngles", label: "Warm Angles" },
  { key: "audit", label: "Audit Log" },
  { key: "onboarding", label: "Onboarding" },
  { key: "deliverability", label: "Deliverability" },
  { key: "compliance", label: "Compliance" },
  { key: "ijps", label: "IJPs" },
  { key: "jobs", label: "Roles" },
  { key: "candidates", label: "Candidates" },
  { key: "contacts", label: "Contacts" },
  { key: "matches", label: "Matches" },
  { key: "offers", label: "Offers" },
];
type TableData = { title?: string; columns: string[]; rows: Record<string, unknown>[] };

function Table({ data }: { data: TableData }) {
  return (
    <div className="overflow-auto max-h-[60vh]">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-white/10">
          <tr>
            {data.columns.map((c) => (
              <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="odd:bg-white/5">
              {data.columns.map((c) => (
                <td key={c} className="px-3 py-2 whitespace-nowrap">{String((row as any)[c] ?? "")}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DataModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState<DataKey>("messages");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TableData | null>(null);

  const mock = useMemo(() => getMockTable(active), [active]);

  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    setLoading(true);
    setData(null);
    const timer = setTimeout(() => {
      // In lieu of real API access, use mock for now
      setData(mock);
      setLoading(false);
    }, 350);
    return () => {
      clearTimeout(timer);
      body.style.overflow = prev;
    };
  }, [open, active, mock]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl rounded-lg border border-white/10 bg-neutral-900/95 backdrop-blur shadow-xl overflow-hidden">
          <div className="flex">
            <aside className="w-56 border-r border-white/10 p-3 space-y-1">
              {ITEMS.map((it) => (
                <button
                  key={it.key}
                  onClick={() => setActive(it.key)}
                  className={`w-full text-left px-3 py-2 rounded ${active === it.key ? "bg-white/15" : "hover:bg-white/10"}`}
                >
                  {it.label}
                </button>
              ))}
            </aside>
            <section className="flex-1 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{mock.title || ITEMS.find((i) => i.key === active)?.label}</h2>
                <div className="flex items-center gap-2">
                  <Link href={`/data/${active}`} className="px-3 py-1 rounded bg-white/10 border border-white/10 text-sm">View full page</Link>
                  <button onClick={onClose} aria-label="Close" className="px-2 py-1 rounded hover:bg-white/10">✕</button>
                </div>
              </div>
              {loading ? (
                <div className="flex items-center justify-center h-40 opacity-80">Loading…</div>
              ) : data ? (
                <Table data={data} />)
              : (
                <div className="h-40 flex items-center justify-center opacity-80">No data</div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


