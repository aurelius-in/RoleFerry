"use client";

import { useMemo, useState } from "react";
import { getActiveRoute, ROUTE_DEFINITIONS } from "@/lib/workflowRoutes";

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function WorkflowSummary() {
  const [open, setOpen] = useState(false);

  const summary = useMemo(() => {
    if (typeof window === "undefined") return null;
    const route = getActiveRoute();
    const routeDef = ROUTE_DEFINITIONS.find((r) => r.id === route);
    const prefs = safeJson<any>(localStorage.getItem("job_preferences"), null);
    const resume = safeJson<any>(localStorage.getItem("resume_extract"), null);
    const careerResult = localStorage.getItem("rf_career_result") || "";
    const deliverable = localStorage.getItem("rf_free_deliverable") || "";
    const targeting = safeJson<any>(localStorage.getItem("rf_dream100_targeting"), null);
    const company = localStorage.getItem("selected_company_name") || "";

    const roles = (prefs?.roleCategories || []).slice(0, 3).join(", ");
    const industries = (prefs?.industries || []).slice(0, 3).join(", ");
    const sizes = (prefs?.companySize || []).slice(0, 2).join(", ");
    const title = resume?.positions?.[0]?.title || resume?.Name || "";
    const topMetric = resume?.key_metrics?.[0]?.metric
      ? `${resume.key_metrics[0].metric}: ${resume.key_metrics[0].value || ""}`.trim()
      : "";

    return {
      route: routeDef ? `${routeDef.badge} — ${routeDef.title}` : "Not selected",
      roleFunction: roles || title || "Not set",
      idealCompany: targeting?.ideal_company?.summary || sizes || industries || "Not set",
      careerResult: careerResult || topMetric || "Add on Resume page",
      deliverable: deliverable || "Add on Offer page",
      industries: industries || "Not set",
      company: company || "",
    };
  }, [open]);

  if (!summary) return null;

  const rows: Array<{ label: string; value: string }> = [
    { label: "Active route", value: summary.route },
    { label: "Role / function", value: summary.roleFunction },
    { label: "Ideal company type", value: summary.idealCompany },
    { label: "Strongest career result", value: summary.careerResult },
    { label: "Free deliverable", value: summary.deliverable },
    { label: "Target industries", value: summary.industries },
  ];
  if (summary.company) rows.push({ label: "Current company focus", value: summary.company });

  return (
    <div className="mt-8 rounded-lg border border-white/10 bg-black/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div>
          <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">Overview</div>
          <div className="text-sm text-white/70">This is what we gathered so far</div>
        </div>
        <span className="text-white/40 text-sm">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/10 pt-3">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 text-xs">
              <span className="text-white/45 font-medium">{r.label}</span>
              <span className="text-white/85">{r.value}</span>
            </div>
          ))}
          <p className="text-[10px] text-white/35 pt-2">
            Review and fix anything that looks wrong before generating outreach.
          </p>
        </div>
      )}
    </div>
  );
}
