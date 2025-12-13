"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { DataMode, getCurrentDataMode, subscribeToDataModeChanges } from "@/lib/dataMode";

type OverviewResp = {
  total_sent: number;
  click_rate: number;
  reply_rate: number;
  roles_applied: number;
  by_status: Record<string, number>;
  verification_breakdown: Record<string, number>;
  verified_ratio: number;
};

const DEMO_ANALYTICS: OverviewResp = {
  total_sent: 1240,
  click_rate: 38.4,
  reply_rate: 22.7,
  roles_applied: 18,
  by_status: {
    saved: 6,
    applied: 8,
    interviewing: 3,
    offer: 1,
  },
  verification_breakdown: {
    valid: 42,
    accept_all: 11,
    risky: 3,
    invalid: 2,
    unknown: 5,
  },
  verified_ratio: 78.9,
};

export default function Analytics() {
  const [mode, setMode] = useState<DataMode>("demo");
  const [data, setData] = useState<OverviewResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<any | null>(null);

  const loadForMode = async (nextMode: DataMode) => {
    setMode(nextMode);
    setError(null);
    setAiExplanation(null);

    if (nextMode === "demo") {
      setLoading(false);
      setData(DEMO_ANALYTICS);
      return;
    }

    setLoading(true);
    try {
      const resp = await api<OverviewResp>("/analytics/overview", "GET");
      setData(resp);
    } catch (e: any) {
      console.error(e);
      setError(
        "We tried to reach the live analytics API but hit a problem. Make sure the backend is running on http://localhost:8000 and that /analytics/overview is reachable."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = getCurrentDataMode();
    loadForMode(initial);

    const unsubscribe = subscribeToDataModeChanges((next) => {
      loadForMode(next);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const askAiToExplain = async () => {
    if (!data) return;
    setAiLoading(true);
    setAiExplanation(null);
    try {
      // Prefer backend endpoint (uses GPT when OPENAI_API_KEY is set, otherwise deterministic stub).
      const resp = await api<any>("/analytics/explain", "GET");
      if (resp?.success && resp?.explanation) {
        setAiExplanation(resp.explanation);
        return;
      }
      throw new Error("Bad response");
    } catch {
      // Fallback: deterministic “AI-like” explanation from local demo metrics.
      const fallback = {
        insights: [
          `Reply rate is ${data.reply_rate.toFixed(1)}% — strong. Preserve the opener and test subject lines.`,
          `Click rate is ${data.click_rate.toFixed(1)}% — tighten the CTA to increase conversion to replies.`,
          `Verified ratio is ${data.verified_ratio.toFixed(1)}% — focus on reducing unknown/invalid before scaling volume.`,
        ],
        risks: [
          "Sequence may be too long for senior personas; consider shorter follow-ups.",
          "If volume increases, warmup and bounce history can become a constraint.",
        ],
        next_actions: [
          "A/B test 2 subject variants with fewer “salesy” words.",
          "Add one hyper-specific metric in the first paragraph.",
          "Trim follow-up #2 to under ~60 words and ask a single question.",
        ],
        confidence: 0.62,
      };
      setAiExplanation(fallback);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-xs text-white/70 mt-1">
            {mode === "demo"
              ? "Showing a richly populated demo campaign so you can feel the flow before going live."
              : "Showing live analytics from your backend. If there’s a problem, you’ll see a clear explanation below."}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide">
          Mode: <span className="ml-1 font-semibold">{mode === "demo" ? "Demo (mock data)" : "Live (API)"}</span>
        </span>
      </div>

      {mode === "live" && error ? (
        <div className="rounded-lg p-4 bg-red-900/40 border border-red-500/60 space-y-2 text-sm">
          <div className="font-semibold">We couldn’t load live metrics.</div>
          <div className="text-xs opacity-90">
            {error}
          </div>
          <div className="text-xs opacity-80">
            Check that the FastAPI server is running, then refresh. You can always switch back to Demo mode from the top-right toggle.
          </div>
        </div>
      ) : null}

      {loading && (
        <div className="text-sm text-white/70">Loading live analytics…</div>
      )}

      {data ? (
        <>
          {/* Top-level KPIs (Instantly-style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total Sent" value={data.total_sent.toLocaleString()} trend="▲ 0 this week" />
            <KpiCard label="Click Rate" value={`${data.click_rate.toFixed(1)}%`} trend="▲ vs. baseline" />
            <KpiCard label="Reply Rate" value={`${data.reply_rate.toFixed(1)}%`} trend="▲ vs. baseline" />
            <KpiCard label="Roles Applied" value={data.roles_applied.toString()} trend="In active campaigns" />
          </div>

          {/* Application status breakdown */}
          <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Application Status</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.by_status || {}).map(([status, count]) => (
                    <tr key={status} className="odd:bg-white/0 even:bg-white/[.03]">
                      <td className="p-2 capitalize">{status}</td>
                      <td className="p-2">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Deliverability & warmup-style panel */}
          <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Deliverability & warmup</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="text-xs opacity-70">Verified ratio</div>
                <div className="text-2xl font-semibold">
                  {data.verified_ratio.toFixed(1)}%
                </div>
                <div className="text-xs opacity-70">
                  Based on email verification status from recent sends.
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-xs opacity-70">Verification breakdown</div>
                <ul className="text-xs space-y-1">
                  {Object.entries(data.verification_breakdown || {}).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between">
                      <span className="capitalize">{k}</span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1 text-xs opacity-80">
                <div>Warmup status (mock):</div>
                <div>• astaples@truestgridsolar.info – Active</div>
                <div>• Warmup emails sent: 105</div>
                <div>• Warmup emails received: 179</div>
              </div>
            </div>
          </section>

          {/* GPT explanatory analytics */}
          <section className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">GPT Helper: interpret results</h2>
              <button
                onClick={askAiToExplain}
                disabled={aiLoading}
                className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:bg-black/40 disabled:opacity-50"
              >
                {aiLoading ? "Asking GPT…" : "Ask GPT"}
              </button>
            </div>
            {aiExplanation ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="text-xs opacity-70 font-semibold">Insights</div>
                  <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                    {(aiExplanation.insights || []).slice(0, 5).map((x: string, i: number) => (
                      <li key={`ins_${i}`}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-xs opacity-70 font-semibold">Risks</div>
                  <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                    {(aiExplanation.risks || []).slice(0, 5).map((x: string, i: number) => (
                      <li key={`risk_${i}`}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <div className="text-xs opacity-70 font-semibold">Next actions</div>
                  <ul className="list-disc list-inside text-xs space-y-1 opacity-90">
                    {(aiExplanation.next_actions || []).slice(0, 5).map((x: string, i: number) => (
                      <li key={`na_${i}`}>{x}</li>
                    ))}
                  </ul>
                  {typeof aiExplanation.confidence === "number" ? (
                    <div className="text-[11px] opacity-70 mt-2">
                      Confidence: {(aiExplanation.confidence * 100).toFixed(0)}%
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="text-xs opacity-70">
                Click “Ask GPT” to get an explanation of these metrics and concrete next experiments.
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}

function KpiCard({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10">
      <div className="text-xs opacity-70 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-[11px] opacity-70 mt-1">{trend}</div>
    </div>
  );
}