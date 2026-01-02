import { Suspense } from "react";
import GreenhouseBoardsClient from "./GreenhouseBoardsClient";

export default function GreenhouseBoardsPage() {
  // Next.js build requires useSearchParams() to be used in a client component wrapped in Suspense.
  // This keeps the page buildable on Railway while still supporting querystring-driven searches.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen py-8 text-slate-100">
          <div className="max-w-4xl mx-auto px-4">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl shadow-black/20">
              <div className="text-sm text-white/70">Loading…</div>
            </div>
          </div>
        </div>
      }
    >
      <GreenhouseBoardsClient />
    </Suspense>
  );
}

