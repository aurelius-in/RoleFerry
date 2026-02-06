"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OfferCreationRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Offer Creation has been consolidated into Campaign.
    router.replace("/campaign");
  }, [router]);

  return (
    <div className="min-h-screen py-10 text-slate-100">
      <div className="max-w-3xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6">
          <div className="text-lg font-semibold text-white">Redirecting…</div>
          <div className="mt-2 text-sm text-white/70">
            Offer Creation is now part of{" "}
            <a className="underline" href="/campaign">
              Campaign
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

