"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import InlineSpinner from "@/components/InlineSpinner";

export default function FeedbackPage() {
  const [email, setEmail] = useState("");
  const [nps, setNps] = useState<number | "">("");
  const [wouldPay, setWouldPay] = useState<"yes" | "no" | "">("");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api("/beta-feedback/submit", "POST", {
        email: email || null,
        nps_score: nps === "" ? null : Number(nps),
        would_pay_499: wouldPay === "" ? null : wouldPay === "yes",
        suggested_price: suggestedPrice || null,
        feedback_text: feedback || null,
      });
      setDone(true);
    } catch (err: any) {
      setError(String(err?.message || "Failed to submit feedback"));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-3">
          <h1 className="text-2xl font-bold">Thank you for your feedback</h1>
          <p className="text-sm text-slate-200">
            Your responses help shape RoleFerry and unlock your early adopter discount. We won&apos;t show any internal
            IDs here—this is just a simple confirmation for you.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6 text-center space-y-2">
          <h1 className="text-3xl font-bold">Beta Feedback</h1>
          <p className="text-slate-300 text-sm">
            Your detailed insights are critical for our beta release. Complete this short survey to help us earn your{" "}
            <span className="font-semibold">50% Early Adopter Discount</span>.
          </p>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-5 text-sm"
        >
          {error && (
            <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              {error}
            </div>
          )}
          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-200">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-200">
              Overall rating (0–10)
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={nps}
              onChange={(e) => setNps(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-24 rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-200">
              Would you pay $499 for this tool?
            </label>
            <div className="flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setWouldPay("yes")}
                className={`px-3 py-1 rounded-full border ${
                  wouldPay === "yes"
                    ? "bg-emerald-500/20 border-emerald-400/60 text-emerald-100"
                    : "bg-white/5 border-white/20 text-slate-100"
                }`}
              >
                Yes – it saves me hours
              </button>
              <button
                type="button"
                onClick={() => setWouldPay("no")}
                className={`px-3 py-1 rounded-full border ${
                  wouldPay === "no"
                    ? "bg-amber-500/20 border-amber-400/60 text-amber-100"
                    : "bg-white/5 border-white/20 text-slate-100"
                }`}
              >
                No – I&apos;d pay a lower price
              </button>
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-200">
              If not $499, what price point makes sense?
            </label>
            <textarea
              value={suggestedPrice}
              onChange={(e) => setSuggestedPrice(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. “I’d pay around $200/month instead.”"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-200">
              Any feedback that would help us earn that price?
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Be specific, critical, and honest—what would make RoleFerry a no-brainer for you?"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-md bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-semibold text-sm shadow-md disabled:opacity-60 inline-flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <InlineSpinner className="border-black/25 border-t-black/80" />
                  <span>Submitting</span>
                </>
              ) : (
                "Submit & unlock discount"
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}


