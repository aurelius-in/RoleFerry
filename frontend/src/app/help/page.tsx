"use client";

import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="min-h-screen py-10 text-slate-100">
      <div className="max-w-3xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6">
          <h1 className="text-2xl font-bold text-white">Help</h1>
          <p className="mt-2 text-white/70">
            Start on the dashboard, pick a route, then walk the steps from preferences to campaign.
          </p>

          <div className="mt-4 space-y-2 text-sm">
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/">
                Dashboard
              </Link>
              <span className="text-white/60">: choose your route and see the path.</span>
            </div>
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/settings">
                Settings
              </Link>
              <span className="text-white/60">: profile and subscription.</span>
            </div>
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/feedback">
                Feedback
              </Link>
              <span className="text-white/60">: tell us what broke or what you want next.</span>
            </div>
            <div>
              <Link className="underline text-white/80 hover:text-white" href="/privacy">
                Privacy
              </Link>
              <span className="text-white/60">: what we keep and why.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
