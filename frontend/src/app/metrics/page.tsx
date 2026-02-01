"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function MetricsPage() {
  const [text, setText] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load metrics: ${res.status}`);
        const t = await res.text();
        if (mounted) setText(t);
      } catch (e: any) {
        if (mounted) setError(String(e?.message || e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen py-10 px-4 text-white" style={{ background: "linear-gradient(to bottom, #020617, #0B1020)" }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Metrics</h1>
            <p className="text-white/70 mt-1 text-sm">
              This is a developer-facing Prometheus metrics endpoint. Most people won’t ever need this.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/api/metrics"
              target="_blank"
              className="px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold"
            >
              Open raw metrics
            </a>
            <Link href="/settings" className="px-3 py-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-semibold">
              Back to Settings
            </Link>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
          {loading ? (
            <div className="text-sm text-white/70">Loading metrics…</div>
          ) : error ? (
            <div className="text-sm text-red-200">{error}</div>
          ) : (
            <pre className="text-xs text-white/70 whitespace-pre-wrap break-words">{text || "No metrics returned."}</pre>
          )}
        </div>
      </div>
    </div>
  );
}

