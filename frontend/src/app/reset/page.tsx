"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function clearRoleFerryDemoState() {
  try {
    const legacyPainpointKey = ["pin", "point_matches"].join("");
    const keysToClear = [
      // progress / flow
      "roleferry-progress",

      // resume + jobs + matching
      "resume_extract",
      "job_preferences",
      "job_preferences_helper",
      "job_recommendations",
      "job_descriptions",
      "selected_job_description",
      "selected_job_description_id",
      "painpoint_matches",
      "painpoint_matches_by_job",
      legacyPainpointKey,
      "pain_point_matches",

      // contacts + research
      "found_contacts",
      "selected_contacts",
      "context_research",
      "context_research_by_contact",
      "context_research_active_contact_id",
      "context_research_helper",
      "context_research_history",
      "research_data",

      // offer + compose
      "offer_draft",
      "created_offers",
      "composed_email",
      "compose_helper",

      // campaign
      "campaign_data",
      "campaign_by_contact",
      "campaign_active_contact_id",

      // tracker
      "tracker_applications",
    ];
    for (const k of keysToClear) localStorage.removeItem(k);
    return { ok: true as const, cleared: keysToClear.length };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "Failed to clear localStorage" };
  }
}

export default function ResetPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "cleared" | "failed">("idle");
  const [detail, setDetail] = useState<string>("");

  const title = useMemo(() => {
    if (status === "cleared") return "Demo state cleared";
    if (status === "failed") return "Couldn’t clear demo state";
    return "Reset demo state";
  }, [status]);

  useEffect(() => {
    const res = clearRoleFerryDemoState();
    if (res.ok) {
      setStatus("cleared");
      setDetail(`Cleared ${res.cleared} cached keys. Redirecting…`);
      const t = window.setTimeout(() => router.replace("/"), 600);
      return () => window.clearTimeout(t);
    }
    setStatus("failed");
    setDetail(res.error);
  }, [router]);

  return (
    <div className="min-h-[70vh] px-6 py-14">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/70">
          This clears your locally cached resume extract, job prefs, selected jobs, contacts, research, offers, compose, campaign,
          and tracker state (but keeps theme/mode).
        </p>

        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            status === "failed"
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : status === "cleared"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                : "border-white/10 bg-black/20 text-white/80"
          }`}
        >
          {detail || "Working…"}
        </div>

        {status === "failed" ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="px-3 py-2 rounded-md bg-white text-black font-bold hover:bg-white/90"
            >
              Back to Dashboard
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}


