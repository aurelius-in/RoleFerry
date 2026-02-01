"use client";

import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="min-h-screen py-10 text-slate-100">
      <div className="max-w-3xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6">
          <h1 className="text-2xl font-bold text-white">Help</h1>
          <p className="mt-2 text-white/70">
            Quick links for common issues.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/settings">
                Settings
              </Link>
              <span className="text-white/60"> — API keys, integrations, account.</span>
            </div>
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/tools">
                Tools
              </Link>
              <span className="text-white/60"> — utilities and diagnostics.</span>
            </div>
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/feedback">
                Feedback
              </Link>
              <span className="text-white/60"> — report bugs / request features.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

