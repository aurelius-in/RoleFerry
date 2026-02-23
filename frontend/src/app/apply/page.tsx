"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";

type RoleItem = {
  id: string;
  title: string;
  company: string;
  url?: string;
  location?: string;
  city?: string;
  state?: string;
  matchScore?: number;
};

type ApplicationRecord = {
  id: number;
  jobId: string;
  status: "queued" | "applied" | "failed" | "skipped" | "interviewing" | "offer" | "rejected";
  failureReason?: string | null;
  eligible?: boolean;
  job?: {
    id?: string;
    title?: string;
    company?: string;
    location?: string;
    url?: string;
    match_score?: number;
  };
};

type BulkApplyResponse = {
  applications: ApplicationRecord[];
  summary: { applied: number; failed: number; skipped: number; queued: number };
};

const TRACKER_KEY = "tracker_applications";

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeRoles(raw: any[]): RoleItem[] {
  const seen = new Set<string>();
  const out: RoleItem[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const id = String(r?.id || `${r?.company || ""}:${r?.title || ""}:${r?.url || ""}`).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: String(r?.title || "").trim(),
      company: String(r?.company || "").trim(),
      url: String(r?.url || "").trim(),
      location: String(r?.location || "").trim(),
      city: String(r?.city || "").trim(),
      state: String(r?.state || "").trim(),
      matchScore: Number.isFinite(Number(r?.matchScore))
        ? Number(r?.matchScore)
        : Number.isFinite(Number(r?.match_score))
        ? Number(r?.match_score)
        : undefined,
    });
  }
  return out;
}

function statusPill(status: string): { label: string; className: string } {
  const key = String(status || "pending").toLowerCase();
  if (key === "applied") return { label: "Applied", className: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100" };
  if (key === "failed") return { label: "Failed", className: "border-red-400/35 bg-red-500/15 text-red-100" };
  if (key === "skipped") return { label: "Skipped", className: "border-amber-400/35 bg-amber-500/15 text-amber-100" };
  if (key === "interviewing") return { label: "Interviewing", className: "border-violet-400/35 bg-violet-500/15 text-violet-100" };
  if (key === "offer") return { label: "Offer", className: "border-cyan-400/35 bg-cyan-500/15 text-cyan-100" };
  if (key === "rejected") return { label: "Rejected", className: "border-rose-400/35 bg-rose-500/15 text-rose-100" };
  if (key === "queued") return { label: "Queued", className: "border-blue-400/35 bg-blue-500/15 text-blue-100" };
  return { label: "Pending", className: "border-white/20 bg-white/10 text-white/75" };
}

export default function ApplyPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [autoApply, setAutoApply] = useState(true);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [appsByJobId, setAppsByJobId] = useState<Record<string, ApplicationRecord>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadApplications = async () => {
    const resp = await api<{ applications: ApplicationRecord[] }>("/applications", "GET");
    const by: Record<string, ApplicationRecord> = {};
    for (const app of resp?.applications || []) {
      if (!app?.jobId) continue;
      by[String(app.jobId)] = app;
    }
    setAppsByJobId(by);
  };

  useEffect(() => {
    const storedRoles = safeJson<any[]>(localStorage.getItem("job_descriptions"), []);
    const normalized = normalizeRoles(storedRoles);
    setRoles(normalized);
    setSelectedIds(new Set(normalized.map((r) => r.id)));

    const user = safeJson<any>(localStorage.getItem("rf_user"), {});
    setLinkedinUrl(String(user?.linkedin_url || ""));
    setCity(String(user?.city || ""));
    setStateCode(String(user?.state || ""));
    setPostalCode(String(user?.postal_code || user?.zip || ""));

    loadApplications().catch(() => {
      // If backend is unavailable, page remains usable for manual link opening.
    });
  }, []);

  const isRoleEligible = (r: RoleItem): boolean => {
    const hasCoreFields = Boolean(String(r.title || "").trim() && String(r.company || "").trim() && String(r.url || "").trim());
    const appStatus = appsByJobId[r.id]?.status;
    const notAlreadyApplied = appStatus !== "applied" && appStatus !== "offer" && appStatus !== "interviewing";
    return hasCoreFields && notAlreadyApplied;
  };

  const filteredRoles = useMemo(() => {
    if (!eligibleOnly) return roles;
    return roles.filter((r) => isRoleEligible(r));
  }, [roles, eligibleOnly, appsByJobId]);

  const selectedRoles = useMemo(() => filteredRoles.filter((r) => selectedIds.has(r.id)), [filteredRoles, selectedIds]);
  const roleStateSummary = useMemo(() => {
    const summary = { pending: 0, applied: 0, failed: 0, skipped: 0 };
    for (const r of filteredRoles) {
      const st = String(appsByJobId[r.id]?.status || "pending").toLowerCase();
      if (st === "applied") summary.applied += 1;
      else if (st === "failed") summary.failed += 1;
      else if (st === "skipped") summary.skipped += 1;
      else summary.pending += 1;
    }
    return summary;
  }, [filteredRoles, appsByJobId]);

  const profileMissing = useMemo(() => {
    const missing: string[] = [];
    if (!linkedinUrl.trim()) missing.push("LinkedIn URL");
    if (!city.trim()) missing.push("City");
    if (!postalCode.trim()) missing.push("Postal code");
    return missing;
  }, [linkedinUrl, city, postalCode]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllShown = () => setSelectedIds(new Set(filteredRoles.map((r) => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const syncTrackerFromApplications = (applications: ApplicationRecord[]) => {
    const existing = safeJson<any[]>(localStorage.getItem(TRACKER_KEY), []);
    const byId = new Map<string, any>();
    for (const app of existing) byId.set(String(app?.id || ""), app);

    const trackerStatus = (s: string): string => {
      if (s === "applied" || s === "interviewing" || s === "offer" || s === "rejected") return s;
      if (s === "failed") return "rejected";
      return "saved";
    };

    for (const app of applications) {
      const job = app.job || {};
      const trackerId = String(app.jobId || app.id);
      byId.set(trackerId, {
        id: trackerId,
        company: { name: String(job.company || "") },
        role: String(job.title || ""),
        status: trackerStatus(String(app.status || "saved")),
        appliedDate: new Date().toISOString().slice(0, 10),
        lastContact: new Date().toISOString().slice(0, 10),
        source: "apply-step",
      });
    }

    const next = Array.from(byId.values());
    localStorage.setItem(TRACKER_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("trackerUpdated"));
  };

  const runBulkApply = async () => {
    setErr(null);
    setMsg(null);
    if (!selectedRoles.length) {
      setErr("Select at least one role to apply.");
      return;
    }
    if (autoApply && profileMissing.length) {
      setErr(`Auto-apply requires: ${profileMissing.join(", ")}.`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        auto_apply: autoApply,
        profile: {
          linkedin_url: linkedinUrl.trim() || null,
          city: city.trim() || null,
          state: stateCode.trim() || null,
          postal_code: postalCode.trim() || null,
        },
        roles: selectedRoles.map((r) => ({
          jobId: r.id,
          jobUrl: r.url || null,
          title: r.title,
          company: r.company,
          location: r.location || [r.city, r.state].filter(Boolean).join(", "),
          match_score: Number.isFinite(Number(r.matchScore)) ? Number(r.matchScore) : null,
          eligible: isRoleEligible(r),
          source: "apply-step",
        })),
      };
      const resp = await api<BulkApplyResponse>("/applications/bulk", "POST", payload);
      await loadApplications();
      syncTrackerFromApplications(resp.applications || []);
      setMsg(
        `Applied: ${resp.summary.applied}, Failed: ${resp.summary.failed}, Skipped: ${resp.summary.skipped}.`
      );
    } catch (e: any) {
      setErr(String(e?.message || "Failed to run apply flow."));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setErr(null);
    try {
      const resp = await api<{ filename: string; content: string }>("/applications/export", "GET");
      const blob = new Blob([resp.content || ""], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resp.filename || "applications_export.csv";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(String(e?.message || "Export failed."));
    }
  };

  const deleteMatches = () => {
    localStorage.setItem("job_descriptions", JSON.stringify([]));
    localStorage.removeItem("painpoint_matches_by_job");
    localStorage.removeItem("painpoint_matches");
    localStorage.removeItem("selected_job_description");
    localStorage.removeItem("selected_job_description_id");
    setRoles([]);
    setSelectedIds(new Set());
    setMsg("Cleared current matched roles.");
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-4">
          <a href="/painpoint-match" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Match
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
            <div>
              <div className="text-xs text-white/60">Step 7 of 12</div>
              <h1 className="text-3xl font-bold text-white">Apply</h1>
              <p className="text-white/70 text-sm mt-1">
                Select matched roles, run apply status updates, and hand off applied roles to Tracker.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/job-descriptions")}
                className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/15 text-sm"
              >
                Find More Jobs
              </button>
              <button
                type="button"
                onClick={deleteMatches}
                className="px-3 py-2 rounded-md border border-red-400/30 bg-red-500/10 hover:bg-red-500/15 text-sm text-red-100"
              >
                Delete Matches
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/15 text-sm"
              >
                Export CSV
              </button>
            </div>
          </div>

          {err ? <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{err}</div> : null}
          {msg ? <div className="mb-4 rounded-md border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{msg}</div> : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="text-sm font-semibold text-white">Auto-Apply Requirements</div>
              <label className="flex items-center gap-2 text-sm text-white/85">
                <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
                Enable auto-apply mode
              </label>
              <input
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="LinkedIn URL"
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={stateCode}
                  onChange={(e) => setStateCode(e.target.value)}
                  placeholder="State"
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                />
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="Postal code"
                  className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </div>
              {autoApply && profileMissing.length ? (
                <div className="text-xs text-yellow-200 bg-yellow-500/10 border border-yellow-400/30 rounded-md p-2">
                  Missing required profile fields: {profileMissing.join(", ")}.
                </div>
              ) : null}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={runBulkApply}
                  disabled={busy}
                  className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold"
                >
                  {busy ? "Applying..." : `Apply to Selected (${selectedRoles.length})`}
                </button>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/offer")}
                  className="w-full px-4 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/15 text-sm"
                >
                  Save &amp; Continue
                </button>
              </div>
              <div className="pt-2 border-t border-white/10">
                <div className="text-xs text-white/60 mb-2">Next workflow shortcuts</div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => router.push("/offer")} className="px-2 py-1 rounded border border-white/10 bg-white/10 text-xs">
                    Offer
                  </button>
                  <button type="button" onClick={() => router.push("/company-research")} className="px-2 py-1 rounded border border-white/10 bg-white/10 text-xs">
                    Research
                  </button>
                  <button type="button" onClick={() => router.push("/find-contact")} className="px-2 py-1 rounded border border-white/10 bg-white/10 text-xs">
                    Contact
                  </button>
                  <button type="button" onClick={() => router.push("/campaign")} className="px-2 py-1 rounded border border-white/10 bg-white/10 text-xs">
                    Campaign
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 rounded-lg border border-white/10 bg-black/20 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">Matched Roles ({filteredRoles.length})</div>
                  <div className="text-xs text-white/55">Select roles, review status, then apply in bulk.</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-2 py-0.5 text-[11px] text-white/80">
                      Pending: {roleStateSummary.pending}
                    </span>
                    <span className="inline-flex items-center rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-100">
                      Applied: {roleStateSummary.applied}
                    </span>
                    <span className="inline-flex items-center rounded-md border border-red-400/35 bg-red-500/15 px-2 py-0.5 text-[11px] text-red-100">
                      Failed: {roleStateSummary.failed}
                    </span>
                    <span className="inline-flex items-center rounded-md border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-100">
                      Skipped: {roleStateSummary.skipped}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/75 inline-flex items-center gap-1">
                    <input type="checkbox" checked={eligibleOnly} onChange={(e) => setEligibleOnly(e.target.checked)} />
                    Eligible only
                  </label>
                  <button type="button" onClick={selectAllShown} className="text-xs px-2 py-1 rounded border border-white/15 bg-white/10">
                    Select all shown
                  </button>
                  <button type="button" onClick={clearSelection} className="text-xs px-2 py-1 rounded border border-white/15 bg-white/10">
                    Clear
                  </button>
                </div>
              </div>
              <div className="px-4 py-2 border-b border-white/10 bg-black/30">
                <div className="grid grid-cols-12 gap-3 text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  <div className="col-span-6">Role</div>
                  <div className="col-span-2">Match</div>
                  <div className="col-span-2">Eligibility</div>
                  <div className="col-span-1">Status</div>
                  <div className="col-span-1 text-right">Action</div>
                </div>
              </div>
              <div className="max-h-[640px] overflow-auto">
                {filteredRoles.length === 0 ? (
                  <div className="p-6 text-sm text-white/70">No roles available. Use “Find More Jobs” to populate matches.</div>
                ) : (
                  filteredRoles.map((r) => {
                    const app = appsByJobId[r.id];
                    const eligible = isRoleEligible(r);
                    const status = app?.status || "pending";
                    const statusUi = statusPill(status);
                    return (
                      <div key={r.id} className="px-4 py-2.5 border-b border-white/10">
                        <div className="grid grid-cols-12 gap-3 items-center">
                          <div className="col-span-6 min-w-0">
                            <label className="inline-flex items-start gap-2 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleSelected(r.id)}
                                disabled={!eligible}
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white truncate leading-tight">{r.title || "Untitled role"}</div>
                                <div className="text-xs text-white/70 truncate leading-tight">{formatCompanyName(r.company || "Unknown company")}</div>
                                <div className="text-[11px] text-white/55 truncate mt-0.5 leading-tight">
                                  {r.location || [r.city, r.state].filter(Boolean).join(", ") || "Location unavailable"}
                                </div>
                              </div>
                            </label>
                          </div>
                          <div className="col-span-2 text-xs text-white/80">
                            {typeof r.matchScore === "number" ? (
                              <span className="inline-flex items-center rounded-md border border-white/15 bg-white/5 px-2 py-1">
                                {Math.round(r.matchScore)}%
                              </span>
                            ) : (
                              <span className="text-white/40">—</span>
                            )}
                          </div>
                          <div className="col-span-2">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${
                                eligible
                                  ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-100"
                                  : "border-amber-400/35 bg-amber-500/15 text-amber-100"
                              }`}
                            >
                              {eligible ? "Eligible" : "Needs review"}
                            </span>
                            {app?.failureReason ? (
                              <div className="mt-1 text-[11px] text-red-200 truncate" title={app.failureReason}>
                                {app.failureReason}
                              </div>
                            ) : null}
                          </div>
                          <div className="col-span-1">
                            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${statusUi.className}`}>
                              {statusUi.label}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            {r.url ? (
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center px-2 py-1 rounded border border-white/15 bg-white/10 hover:bg-white/15 text-[11px] font-semibold"
                                title="Open job link"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-[11px] text-white/40">No link</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

