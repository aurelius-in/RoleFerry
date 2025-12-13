"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type LlmHealth = {
  configured: boolean;
  mock_mode: boolean;
  llm_mode: string;
  should_use_real_llm: boolean;
  model: string;
  probe_ok: boolean;
  probe_preview: string;
};

type Health = {
  status: string;
  env: string;
  version: string;
  mock_mode?: boolean;
  providers?: Record<string, boolean>;
  db?: string;
  redis?: string;
};

const TOGGLE_EVENT = "rf_debug_toggle";

export function toggleDemoDebugPanel() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
}

export default function DemoDebugPanel() {
  const [open, setOpen] = useState(false);
  const [llm, setLlm] = useState<LlmHealth | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const title = useMemo(() => {
    if (!llm) return "Demo Debug";
    return llm.should_use_real_llm ? "Demo Debug (GPT ON)" : "Demo Debug (GPT OFF)";
  }, [llm]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setOpen((v) => !v);
    window.addEventListener(TOGGLE_EVENT, handler as EventListener);
    return () => window.removeEventListener(TOGGLE_EVENT, handler as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function refresh() {
    setLoading(true);
    setLastError(null);
    try {
      const [healthResp, llmResp] = await Promise.all([
        api<Health>("/health", "GET"),
        api<LlmHealth>("/health/llm", "GET"),
      ]);
      setHealth(healthResp);
      setLlm(llmResp);
    } catch (e: any) {
      setLastError(e?.message || "Failed to load debug info");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* overlay */}
      <button
        type="button"
        aria-label="Close debug panel"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/60"
      />

      {/* panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-950/95 border-l border-white/10 shadow-2xl p-4 overflow-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white/80">RoleFerry</div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-xs text-white/60">
              Hidden panel for demo verification. Click outside to close.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-9 h-9 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={refresh}
            className="px-3 py-2 rounded-md bg-white text-black font-bold hover:bg-white/90"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem("roleferry-progress");
                localStorage.removeItem("job_descriptions");
                localStorage.removeItem("resume_extract");
                localStorage.removeItem("pinpoint_matches");
                localStorage.removeItem("pain_point_matches");
                localStorage.removeItem("selected_contacts");
                localStorage.removeItem("research_data");
                localStorage.removeItem("created_offers");
              } catch {}
              alert("Cleared local demo state (localStorage).");
            }}
            className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10"
          >
            Clear Demo State
          </button>
        </div>

        {lastError && (
          <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {lastError}
          </div>
        )}

        <section className="mt-4 space-y-3">
          <h3 className="text-sm font-bold text-white/80">Backend Health</h3>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-white/70">status</span>
              <span className="text-white font-semibold">{health?.status ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">env</span>
              <span className="text-white font-semibold">{health?.env ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">version</span>
              <span className="text-white font-semibold">{health?.version ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">db</span>
              <span className="text-white font-semibold">{health?.db ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">redis</span>
              <span className="text-white font-semibold">{health?.redis ?? "—"}</span>
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-3">
          <h3 className="text-sm font-bold text-white/80">LLM / GPT</h3>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm space-y-1">
            <Row k="configured" v={llm?.configured} />
            <Row k="mock_mode" v={llm?.mock_mode} />
            <Row k="llm_mode" v={llm?.llm_mode} />
            <Row k="should_use_real_llm" v={llm?.should_use_real_llm} />
            <Row k="model" v={llm?.model} />
            <Row k="probe_ok" v={llm?.probe_ok} />
            <div className="pt-2 text-xs text-white/60">
              probe_preview:
              <div className="mt-1 rounded-md border border-white/10 bg-black/30 p-2 text-white/80 font-mono whitespace-pre-wrap">
                {llm?.probe_preview ?? "—"}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-2">
          <h3 className="text-sm font-bold text-white/80">Demo Expectations</h3>
          <ul className="text-xs text-white/70 space-y-1 list-disc pl-4">
            <li>
              If <b>should_use_real_llm</b> is true: JD import, offer creation, resume extract response, and match generation can become GPT-backed.
            </li>
            <li>
              If false: app should still fully work using deterministic fallbacks/mocks.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/70">{k}</span>
      <span className="text-white font-semibold">
        {v === undefined || v === null ? "—" : typeof v === "boolean" ? (v ? "true" : "false") : String(v)}
      </span>
    </div>
  );
}

