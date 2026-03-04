"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export default function ApplyStudioPage() {
  const [copied, setCopied] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "/tools/apply-studio";
    return `${window.location.origin}/tools/apply-studio`;
  }, []);

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 text-slate-100">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-200">RoleFerry Tool</div>
            <h1 className="mt-1 text-3xl font-bold">Apply Studio</h1>
            <p className="mt-2 text-sm text-white/70">
              A standalone, linkable workflow for job import, fit validation, and one-click apply execution.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-white/15 bg-black/30 px-3 py-1 text-xs text-white/75">
            Branded for RoleFerry
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <StepCard number="1" title="Import Roles" href="/job-descriptions" />
          <StepCard number="2" title="Run Gap Analysis" href="/gap-analysis" />
          <StepCard number="3" title="Pain Point Match" href="/painpoint-match" />
          <StepCard number="4" title="Apply Workflow" href="/apply" />
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold">Quick Launch</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href="/job-descriptions" className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              Start at Roles
            </Link>
            <Link href="/apply" className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30">
              Open Apply Step
            </Link>
            <Link href="/tracker" className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              View Tracker
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold">Share This Tool</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={shareUrl}
              readOnly
              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/80"
            />
            <button
              type="button"
              onClick={copyShareUrl}
              className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15"
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function StepCard({ number, title, href }: { number: string; title: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-white/10 bg-black/20 p-4 hover:bg-black/30 transition-colors">
      <div className="text-[11px] uppercase tracking-wider text-white/50">Step {number}</div>
      <div className="mt-1 text-sm font-semibold text-white">{title}</div>
      <div className="mt-2 text-xs text-emerald-200">Open</div>
    </Link>
  );
}

