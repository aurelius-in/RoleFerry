"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

type RoleItem = {
  id: string;
  title: string;
  company: string;
  url?: string;
  location?: string;
  city?: string;
  state?: string;
  matchScore?: number;
  isFavorite?: boolean;
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
type SingleApplyResponse = { application: ApplicationRecord; status?: string };
type EnrichedExportResponse = { filename: string; content: string; columns?: string[] };

type RequiredProfileKey =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "city"
  | "postal_code"
  | "resume";

const TRACKER_KEY = "tracker_applications";

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeRoles(raw: any[], painpointByJob: Record<string, any[]> = {}): RoleItem[] {
  const seen = new Set<string>();
  const out: RoleItem[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const id = String(r?.id || `${r?.company || ""}:${r?.title || ""}:${r?.url || ""}`).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const directScore = Number.isFinite(Number(r?.matchScore))
      ? Number(r?.matchScore)
      : Number.isFinite(Number(r?.match_score))
      ? Number(r?.match_score)
      : undefined;
    const painpointScore = (() => {
      const arr = Array.isArray(painpointByJob?.[id]) ? painpointByJob[id] : [];
      const first = arr[0] || null;
      const s = Number(first?.alignment_score);
      if (!Number.isFinite(s)) return undefined;
      // pain point alignment_score is 0..1; convert to percent.
      return Math.max(0, Math.min(100, Math.round(s * 100)));
    })();
    out.push({
      id,
      title: String(r?.title || "").trim(),
      company: String(r?.company || "").trim(),
      url: String(r?.url || "").trim(),
      location: String(r?.location || "").trim(),
      city: String(r?.city || "").trim(),
      state: String(r?.state || "").trim(),
      matchScore: directScore ?? painpointScore,
      isFavorite: Boolean(
        (Number.isFinite(Number(r?.preferenceStars)) && Number(r?.preferenceStars) >= 1) ||
          (Number.isFinite(Number(r?.favoriteRank)) && Number(r?.favoriteRank) >= 1) ||
          r?.isFavorite
      ),
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
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [autoApply, setAutoApply] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [resumePresent, setResumePresent] = useState(false);
  const [citizenshipCountry, setCitizenshipCountry] = useState("");
  const [citizenshipStatus, setCitizenshipStatus] = useState("");
  const [appsByJobId, setAppsByJobId] = useState<Record<string, ApplicationRecord>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Cover letter state
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterBusy, setCoverLetterBusy] = useState(false);
  const [coverLetterMsg, setCoverLetterMsg] = useState<string | null>(null);
  const [coverLetterRoleId, setCoverLetterRoleId] = useState<string | null>(null);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [coverLetterTone, setCoverLetterTone] = useState("professional yet personable");
  const [coverLetterExtra, setCoverLetterExtra] = useState("");
  const coverLetterRef = useRef<HTMLTextAreaElement>(null);

  // Upstream context loaded once from localStorage
  const [upstreamCtx, setUpstreamCtx] = useState<{
    resume: any; preferences: any; personality: any; temperament: any;
    companyResearch: Record<string, any>; companySignals: any[];
    contactSignals: any[]; painpointByJob: Record<string, any[]>;
    selectedJobRaw: Record<string, any>;
  }>({
    resume: null, preferences: null, personality: null, temperament: null,
    companyResearch: {}, companySignals: [], contactSignals: [],
    painpointByJob: {}, selectedJobRaw: {},
  });

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
    const painpointByJob = safeJson<Record<string, any[]>>(localStorage.getItem("painpoint_matches_by_job"), {});
    const normalized = normalizeRoles(storedRoles, painpointByJob);
    setRoles(normalized);
    setFavoriteIds(new Set(normalized.filter((r) => r.isFavorite).map((r) => r.id)));
    setSelectedIds(new Set(normalized.map((r) => r.id)));

    const user = safeJson<any>(localStorage.getItem("rf_user"), {});
    setFirstName(String(user?.first_name || user?.firstName || ""));
    setLastName(String(user?.last_name || user?.lastName || ""));
    setEmail(String(user?.email || ""));
    setPhone(String(user?.phone || ""));
    setLinkedinUrl(String(user?.linkedin_url || ""));
    const prefs = safeJson<any>(localStorage.getItem("job_preferences"), {});
    setCity(String(user?.city || prefs?.city || ""));
    setStateCode(String(user?.state || prefs?.state || ""));
    setPostalCode(String(user?.postal_code || user?.zip || prefs?.postal_code || prefs?.zip || ""));
    setCitizenshipCountry(String(localStorage.getItem("rf_citizenship_country") || ""));
    setCitizenshipStatus(String(localStorage.getItem("rf_citizenship_status") || ""));
    setResumePresent(Boolean(localStorage.getItem("resume_extract")));

    // Load all upstream context for cover letter generation
    const resume = safeJson<any>(localStorage.getItem("resume_extract"), null);
    const personality = safeJson<any>(localStorage.getItem("personality_profile"), null);
    const temperament = safeJson<any>(localStorage.getItem("temperament_profile"), null);
    const companyResearchByCompany = safeJson<Record<string, any>>(localStorage.getItem("company_research_by_company"), {});
    const companySignals = safeJson<any[]>(localStorage.getItem("rf_selected_company_signals"), []);
    const contactSignals = safeJson<any[]>(localStorage.getItem("rf_selected_contact_signals"), []);
    const selectedJobRawMap: Record<string, any> = {};
    for (const jd of storedRoles) {
      const id = String(jd?.id || `${jd?.company || ""}:${jd?.title || ""}:${jd?.url || ""}`).trim();
      if (id) selectedJobRawMap[id] = jd;
    }
    setUpstreamCtx({
      resume, preferences: prefs, personality, temperament,
      companyResearch: companyResearchByCompany, companySignals,
      contactSignals, painpointByJob, selectedJobRaw: selectedJobRawMap,
    });

    loadApplications().catch(() => {});
  }, []);

  const isRoleEligible = (r: RoleItem): boolean => {
    const hasCoreFields = Boolean(String(r.title || "").trim() && String(r.company || "").trim() && String(r.url || "").trim());
    const appStatus = appsByJobId[r.id]?.status;
    const notAlreadyApplied = appStatus !== "applied" && appStatus !== "offer" && appStatus !== "interviewing";
    return hasCoreFields && notAlreadyApplied;
  };

  const filteredRoles = useMemo(() => {
    const base = favoritesOnly ? roles.filter((r) => favoriteIds.has(r.id)) : roles;
    if (!eligibleOnly) return base;
    return base.filter((r) => isRoleEligible(r));
  }, [roles, eligibleOnly, favoritesOnly, favoriteIds, appsByJobId]);

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

  const missingRequiredFields = useMemo(() => {
    const missing: Array<{ key: RequiredProfileKey; label: string }> = [];
    if (!firstName.trim()) missing.push({ key: "first_name", label: "First name" });
    if (!lastName.trim()) missing.push({ key: "last_name", label: "Last name" });
    if (!email.trim()) missing.push({ key: "email", label: "Email" });
    if (!phone.trim()) missing.push({ key: "phone", label: "Phone" });
    if (!city.trim()) missing.push({ key: "city", label: "City" });
    if (!postalCode.trim()) missing.push({ key: "postal_code", label: "Postal code" });
    if (!resumePresent) missing.push({ key: "resume", label: "Resume" });
    return missing;
  }, [firstName, lastName, email, phone, city, postalCode, resumePresent]);
  const missingRequiredKeys = useMemo(() => new Set(missingRequiredFields.map((f) => f.key)), [missingRequiredFields]);

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

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      const willFavorite = !next.has(id);
      if (willFavorite) next.add(id);
      else next.delete(id);

      setRoles((curr) => curr.map((r) => (r.id === id ? { ...r, isFavorite: willFavorite } : r)));
      try {
        const stored = safeJson<any[]>(localStorage.getItem("job_descriptions"), []);
        const mapped = (Array.isArray(stored) ? stored : []).map((r) => {
          const rid = String(r?.id || `${r?.company || ""}:${r?.title || ""}:${r?.url || ""}`).trim();
          if (rid !== id) return r;
          const nextRow: any = { ...r, isFavorite: willFavorite };
          if (willFavorite) {
            if (!Number.isFinite(Number(nextRow.preferenceStars))) nextRow.preferenceStars = 5;
            if (!Number.isFinite(Number(nextRow.favoriteRank))) nextRow.favoriteRank = 1;
          } else {
            delete nextRow.favoriteRank;
          }
          return nextRow;
        });
        localStorage.setItem("job_descriptions", JSON.stringify(mapped));
      } catch {}
      return next;
    });
  };

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
    if (autoApply && missingRequiredFields.length) {
      setErr(`Please complete these fields first: ${missingRequiredFields.map((f) => f.label).join(", ")}. Or uncheck "Verify profile completeness" to skip.`);
      return;
    }

    setBusy(true);
    try {
      const payload = {
        auto_apply: autoApply,
        profile: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          city: city.trim() || null,
          state: stateCode.trim() || null,
          postal_code: postalCode.trim() || null,
          citizenship_country: citizenshipCountry.trim() || null,
          citizenship_status: citizenshipStatus.trim() || null,
          resume_present: resumePresent,
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
      const showApplyResult = (summary: { applied: number; failed: number; skipped: number }) => {
        const parts: string[] = [];
        if (summary.applied > 0) parts.push(`${summary.applied} role${summary.applied > 1 ? "s" : ""} marked as applied`);
        if (summary.failed > 0) parts.push(`${summary.failed} failed`);
        if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
        const detail = parts.join(", ") || "No roles were processed.";
        setMsg(`${detail}. Applied roles now appear below with an "Applied" badge and have been added to your Tracker.`);
        if (summary.applied > 0) setEligibleOnly(false);
      };

      try {
        const resp = await api<BulkApplyResponse>("/applications/bulk", "POST", payload);
        await loadApplications();
        syncTrackerFromApplications(resp.applications || []);
        showApplyResult(resp.summary);
      } catch (bulkErr: any) {
        const detail = String(bulkErr?.message || "");
        if (!/404/.test(detail)) throw bulkErr;

        const created: ApplicationRecord[] = [];
        for (const role of payload.roles) {
          const single = await api<SingleApplyResponse>("/applications", "POST", {
            ...role,
            auto_apply: payload.auto_apply,
          });
          if (single?.application) created.push(single.application);
        }
        await loadApplications();
        syncTrackerFromApplications(created);
        showApplyResult({
          applied: created.filter((a) => a?.status === "applied").length,
          failed: created.filter((a) => a?.status === "failed").length,
          skipped: created.filter((a) => a?.status === "skipped").length,
        });
      }
    } catch (e: any) {
      setErr(String(e?.message || "Failed to run apply flow."));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setErr(null);
    try {
      const rawJobs = safeJson<any[]>(localStorage.getItem("job_descriptions"), []);
      const selectedContacts = safeJson<any[]>(localStorage.getItem("selected_contacts"), []);
      const rfUser = safeJson<any>(localStorage.getItem("rf_user"), {});
      const byId: Record<string, any> = {};
      for (const jd of rawJobs) {
        const id = String(jd?.id || `${jd?.company || ""}:${jd?.title || ""}:${jd?.url || ""}`).trim();
        if (id) byId[id] = jd;
      }
      const rolesPayload = roles.map((r) => {
        const jd = byId[r.id] || {};
        const req = Array.isArray(jd?.requiredSkills) ? jd.requiredSkills : Array.isArray(jd?.required_skills) ? jd.required_skills : [];
        const reqSummary = req.length
          ? req.slice(0, 12).join("; ")
          : String(jd?.content || "").replace(/\s+/g, " ").trim().slice(0, 500);
        const app = appsByJobId[r.id];
        return {
          job_id: r.id,
          title: r.title,
          company: r.company,
          location: r.location || `${r.city || ""}${r.city && r.state ? ", " : ""}${r.state || ""}`,
          job_url: r.url || "",
          match_score: Number(r.matchScore || 0),
          eligible: isRoleEligible(r),
          requirements_summary: reqSummary,
          date_posted: String(jd?.postedDate || jd?.posted_date || jd?.postedText || jd?.posted_text || "").trim(),
          application_status: app?.status || "pending",
        };
      });
      const contactsPayload = (Array.isArray(selectedContacts) ? selectedContacts : []).map((c) => ({
        id: String(c?.id || ""),
        name: String(c?.name || ""),
        title: String(c?.title || ""),
        email: String(c?.email || ""),
        linkedin_url: String(c?.linkedin_url || c?.linkedinUrl || ""),
        company: String(c?.company || ""),
        department: String(c?.department || ""),
        level: String(c?.level || ""),
        verification_status: String(c?.verification_status || c?.verificationStatus || ""),
        verification_score: Number(c?.verification_score || c?.verificationScore || 0) || null,
      }));
      const customerName =
        String(
          rfUser?.name ||
            [rfUser?.first_name || rfUser?.firstName, rfUser?.last_name || rfUser?.lastName].filter(Boolean).join(" ")
        ).trim() || "customer";
      const resp = await api<EnrichedExportResponse>("/applications/export/enriched", "POST", {
        customer_name: customerName,
        roles: rolesPayload,
        contacts: contactsPayload,
      });
      const blob = new Blob([resp.content || ""], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resp.filename || "job_matches_enriched.csv";
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

  const generateCoverLetter = useCallback(async (roleId: string) => {
    setCoverLetterBusy(true);
    setCoverLetterMsg(null);
    setCoverLetterRoleId(roleId);
    setCoverLetterOpen(true);
    try {
      const roleRaw = upstreamCtx.selectedJobRaw[roleId] || {};
      const company = String(roleRaw?.company || "").trim();
      const companyResearch = company
        ? (upstreamCtx.companyResearch[company] || upstreamCtx.companyResearch[company.toLowerCase()] || null)
        : null;
      const painMatches = upstreamCtx.painpointByJob[roleId] || [];

      const resp = await api<{ success: boolean; cover_letter: string; word_count: number; message: string }>(
        "/applications/cover-letter", "POST", {
          resume: upstreamCtx.resume,
          preferences: upstreamCtx.preferences,
          personality: upstreamCtx.personality,
          temperament: upstreamCtx.temperament,
          role: roleRaw,
          company_research: companyResearch,
          company_signals: upstreamCtx.companySignals,
          painpoint_match: painMatches[0] || null,
          contact_signals: upstreamCtx.contactSignals,
          tone: coverLetterTone,
          extra_instructions: coverLetterExtra || null,
        }
      );
      setCoverLetter(resp.cover_letter || "");
      setCoverLetterMsg(resp.message || "Cover letter generated.");
    } catch (e: any) {
      setCoverLetterMsg(String(e?.message || "Failed to generate cover letter."));
    } finally {
      setCoverLetterBusy(false);
    }
  }, [upstreamCtx, coverLetterTone, coverLetterExtra]);

  const downloadCoverLetter = () => {
    if (!coverLetter) return;
    const role = roles.find((r) => r.id === coverLetterRoleId);
    const company = String(role?.company || "company").replace(/[^a-zA-Z0-9]+/g, "_");
    const blob = new Blob([coverLetter], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover_letter_${company}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyCoverLetter = async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      setCoverLetterMsg("Copied to clipboard.");
      setTimeout(() => setCoverLetterMsg(null), 2000);
    } catch {}
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
                Select roles to track your applications. Click a job link to apply on the company site, then mark it here to keep your Tracker up to date.
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
              <div className="text-sm font-semibold text-white">Application Tracker</div>
              <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-white/70">
                Mark selected roles as &quot;Applied&quot; to track your progress. Open each job link to submit your application on the company&apos;s site.
              </div>
              <label className="flex items-center gap-2 text-sm text-white/85">
                <input type="checkbox" checked={autoApply} onChange={(e) => setAutoApply(e.target.checked)} />
                Verify profile completeness before marking
              </label>
              {autoApply && missingRequiredFields.length > 0 ? (
                <div className="rounded-md border border-yellow-400/30 bg-yellow-500/10 p-2 text-xs text-yellow-200">
                  Complete these fields first: {missingRequiredFields.map((f) => f.label).join(", ")}.
                </div>
              ) : null}

              {autoApply && missingRequiredFields.length > 0 ? (
                <div className="space-y-2 rounded-md border border-yellow-400/30 bg-yellow-500/10 p-3">
                  <div className="text-xs font-semibold text-yellow-100">Complete required fields</div>
                  <div className="grid grid-cols-2 gap-2">
                    {missingRequiredKeys.has("first_name") && (
                      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
                    )}
                    {missingRequiredKeys.has("last_name") && (
                      <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
                    )}
                  </div>
                  {missingRequiredKeys.has("email") && (
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
                  )}
                  {missingRequiredKeys.has("phone") && (
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {missingRequiredKeys.has("city") && (
                      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
                    )}
                    {missingRequiredKeys.has("postal_code") && (
                      <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal code" className="w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white" />
                    )}
                  </div>
                  {missingRequiredKeys.has("resume") && (
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-2 text-xs text-white/80">
                        <input type="checkbox" checked={resumePresent} onChange={(e) => setResumePresent(e.target.checked)} />
                        Resume uploaded
                      </label>
                      <button type="button" onClick={() => router.push("/resume")} className="px-2 py-1 rounded border border-white/10 bg-white/10 hover:bg-white/15 text-xs">
                        Go to Resume
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="text-[11px] text-white/55">
                Profile info auto-filled from your account and resume.
              </div>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="w-full px-3 py-2 rounded-md border border-white/10 bg-white/10 hover:bg-white/15 text-xs"
              >
                Open Settings
              </button>
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={runBulkApply}
                  disabled={busy}
                  className="w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-sm font-semibold"
                >
                  {busy ? "Saving..." : `Mark ${selectedRoles.length} as Applied`}
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
                  <label className="text-xs text-white/75 inline-flex items-center gap-1">
                    <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} />
                    Favorites only
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
                  <div className="col-span-5">Role</div>
                  <div className="col-span-2 pl-2">Match</div>
                  <div className="col-span-2">Eligibility</div>
                  <div className="col-span-2">Status</div>
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
                          <div className="col-span-5 min-w-0">
                            <label className="inline-flex items-start gap-2 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleSelected(r.id)}
                                disabled={!eligible}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate leading-tight">{r.title || "Untitled role"}</div>
                                <div className="text-xs text-white/70 truncate leading-tight">{formatCompanyName(r.company || "Unknown company")}</div>
                                <div className="text-[11px] text-white/55 truncate mt-0.5 leading-tight">
                                  {r.location || [r.city, r.state].filter(Boolean).join(", ") || "Location unavailable"}
                                </div>
                              </div>
                            </label>
                          </div>
                          <div className="col-span-2 pl-2 text-xs text-white/80">
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
                          <div className="col-span-2">
                            <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold ${statusUi.className}`}>
                              {statusUi.label}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleFavorite(r.id)}
                                className={`inline-flex items-center px-2 py-1 rounded border text-[11px] font-semibold ${
                                  favoriteIds.has(r.id)
                                    ? "border-amber-400/40 bg-amber-500/20 text-amber-100"
                                    : "border-white/15 bg-white/10 hover:bg-white/15"
                                }`}
                                title={favoriteIds.has(r.id) ? "Remove from favorites" : "Add to favorites"}
                              >
                                {favoriteIds.has(r.id) ? "★" : "☆"}
                              </button>
                              {r.url ? (
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center px-2 py-1 rounded border border-white/15 bg-white/10 hover:bg-white/15 text-[11px] font-semibold"
                                  title="Open job link"
                                >
                                  Website
                                </a>
                              ) : (
                                <span className="text-[11px] text-white/40">No link</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Cover Letter Generator */}
          <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-6">
            <button
              type="button"
              onClick={() => setCoverLetterOpen((v) => !v)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <h2 className="text-lg font-semibold text-white">Cover Letter Generator</h2>
                <p className="text-xs text-white/60 mt-0.5">
                  Create a personalized cover letter using your resume, preferences, personality, company research, and pain point analysis.
                </p>
              </div>
              <span className="text-white/50 text-lg ml-4">{coverLetterOpen ? "▾" : "▸"}</span>
            </button>

            {coverLetterOpen && (
              <div className="mt-4 space-y-4">
                {/* Role selector */}
                <div>
                  <label className="block text-xs text-white/70 mb-1">Select a role to tailor the letter for</label>
                  <select
                    value={coverLetterRoleId || ""}
                    onChange={(e) => setCoverLetterRoleId(e.target.value || null)}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Choose a role...</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} — {formatCompanyName(r.company)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tone + instructions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Tone</label>
                    <select
                      value={coverLetterTone}
                      onChange={(e) => setCoverLetterTone(e.target.value)}
                      className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    >
                      <option value="professional yet personable">Professional yet personable</option>
                      <option value="confident and assertive">Confident and assertive</option>
                      <option value="warm and conversational">Warm and conversational</option>
                      <option value="formal and traditional">Formal and traditional</option>
                      <option value="creative and bold">Creative and bold</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/70 mb-1">Extra instructions (optional)</label>
                    <input
                      value={coverLetterExtra}
                      onChange={(e) => setCoverLetterExtra(e.target.value)}
                      placeholder="e.g., Emphasize leadership experience"
                      className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                {/* Context signals summary */}
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${upstreamCtx.resume ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/40"}`}>
                    Resume {upstreamCtx.resume ? "✓" : "—"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${upstreamCtx.preferences ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/40"}`}>
                    Preferences {upstreamCtx.preferences ? "✓" : "—"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${upstreamCtx.personality ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/40"}`}>
                    Personality {upstreamCtx.personality ? "✓" : "—"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${upstreamCtx.companySignals.length > 0 || Object.keys(upstreamCtx.companyResearch).length > 0 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/40"}`}>
                    Company Research {upstreamCtx.companySignals.length > 0 || Object.keys(upstreamCtx.companyResearch).length > 0 ? "✓" : "—"}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${Object.keys(upstreamCtx.painpointByJob).length > 0 ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-white/5 text-white/40"}`}>
                    Pain Points {Object.keys(upstreamCtx.painpointByJob).length > 0 ? "✓" : "—"}
                  </span>
                </div>

                {/* Generate button */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => coverLetterRoleId && generateCoverLetter(coverLetterRoleId)}
                    disabled={coverLetterBusy || !coverLetterRoleId}
                    className="px-4 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold inline-flex items-center gap-2"
                  >
                    {coverLetterBusy ? (
                      <>
                        <InlineSpinner className="h-4 w-4" />
                        Generating...
                      </>
                    ) : (
                      "Generate Cover Letter"
                    )}
                  </button>
                  {coverLetterMsg ? <span className="text-xs text-white/70">{coverLetterMsg}</span> : null}
                </div>

                {/* Cover letter output */}
                {coverLetter && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-white/60">
                        {coverLetter.split(/\s+/).length} words
                        {coverLetterRoleId && roles.find((r) => r.id === coverLetterRoleId)
                          ? ` — ${roles.find((r) => r.id === coverLetterRoleId)!.title} at ${formatCompanyName(roles.find((r) => r.id === coverLetterRoleId)!.company)}`
                          : ""}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={copyCoverLetter}
                          className="px-3 py-1.5 rounded border border-white/15 bg-white/10 hover:bg-white/15 text-xs"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={downloadCoverLetter}
                          className="px-3 py-1.5 rounded border border-white/15 bg-white/10 hover:bg-white/15 text-xs"
                        >
                          Download .txt
                        </button>
                      </div>
                    </div>
                    <textarea
                      ref={coverLetterRef}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      rows={16}
                      className="w-full rounded-md border border-white/15 bg-black/30 px-4 py-3 text-sm text-white/90 leading-relaxed resize-y focus:border-blue-500/50 focus:outline-none"
                    />
                    <p className="text-[11px] text-white/50">
                      Edit the letter above to your liking, then copy or download it.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

