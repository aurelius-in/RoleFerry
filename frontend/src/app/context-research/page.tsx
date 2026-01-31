"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ContextResearchPage() {
  const router = useRouter();

  useEffect(() => {
    // Back-compat route: the flow is now Company Research → Decision Makers.
    router.replace("/company-research");
  }, [router]);

  return (
    <div className="min-h-screen py-10 text-slate-100">
      <div className="max-w-3xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6">
          <div className="text-lg font-semibold text-white">Redirecting…</div>
          <div className="mt-2 text-sm text-white/70">
            Company research now happens on{" "}
            <a className="underline" href="/company-research">
              Company Research
            </a>
            . Decision makers and contact research are on{" "}
            <a className="underline" href="/find-contact">
              Decision Makers
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

