"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type Result = { title?: string; url: string; snippet?: string };

export default function GreenhouseBoardsClient() {
  const sp = useSearchParams();
  const q = (sp.get("q") || "").trim();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const queryLabel = useMemo(() => q || "(missing query)", [q]);

  useEffect(() => {
    if (!q) return;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await api<{ success: boolean; message: string; results: Result[] }>(
          `/job-preferences/greenhouse-boards?q=${encodeURIComponent(q)}`,
          "GET"
        );
        setResults(Array.isArray(res?.results) ? res.results : []);
        if (!res?.success) setErr(res?.message || "Search failed");
      } catch (e: any) {
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [q]);

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/job-preferences" className="text-white/70 hover:text-white text-sm underline">
            ← Back to Role Preferences
          </Link>
          <Link href="/job-descriptions" className="text-white/70 hover:text-white text-sm underline">
            Go to Roles →
          </Link>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl shadow-black/20">
          <h1 className="text-2xl font-bold text-white">Greenhouse boards</h1>
          <div className="mt-1 text-sm text-white/70">
            In-app search for company role boards hosted on Greenhouse. Query:{" "}
            <span className="font-semibold text-white">{queryLabel}</span>
          </div>

          {!q ? (
            <div className="mt-6 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
              Missing query. Go back and click the Greenhouse boards recommendation again.
            </div>
          ) : null}

          {err ? (
            <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 break-words">
              {err}
            </div>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <div className="text-sm text-white/70">Searching…</div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((r, idx) => (
                  <a
                    key={`${r.url}_${idx}`}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-md border border-white/10 bg-black/20 p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="text-sm font-semibold text-white">{r.title || "Greenhouse board"}</div>
                    <div className="mt-1 text-xs text-white/60 break-words">{r.url}</div>
                    {r.snippet ? <div className="mt-2 text-xs text-white/70">{r.snippet}</div> : null}
                  </a>
                ))}
              </div>
            ) : q ? (
              <div className="text-sm text-white/70">
                No results yet. If this keeps happening, set <code>SERPER_API_KEY</code> on the backend to enable the in-app
                search.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

