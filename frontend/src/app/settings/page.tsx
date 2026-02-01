"use client";
import { api } from "@/lib/api";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SubscriptionStatus {
  plan: string;
  plan_label: string;
  status: string;
  seats: number;
  renews_on?: string | null;
  limits: Record<string, number>;
}

export default function Settings() {
  const [s, setS] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState<SubscriptionStatus | null>(null);
  const [subMessage, setSubMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upgrade" | "cancel" | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // Load local user immediately for snappy UI
        try {
          const saved = localStorage.getItem("rf_user");
          if (saved) {
            const u = JSON.parse(saved);
            setProfile(u);
            setLinkedinUrl(String(u?.linkedin_url || ""));
          }
        } catch {}

        const [settingsData, subscriptionData] = await Promise.all([
          api("/settings", "GET"),
          api<SubscriptionStatus>("/subscription/status", "GET"),
        ]);
        setS(settingsData);
        setSub(subscriptionData);

        // Refresh from backend so it reflects DB truth
        try {
          const me = await api<any>("/auth/me", "GET");
          if (me?.user) {
            setProfile(me.user);
            setLinkedinUrl(String(me.user?.linkedin_url || ""));
            localStorage.setItem("rf_user", JSON.stringify(me.user));
          }
        } catch {}
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, []);

  const handleUpgrade = async () => {
    if (!sub) return;
    setBusy("upgrade");
    setSubMessage(null);
    try {
      const res = await api<{ message: string }>("/subscription/upgrade", "POST", {
        plan: sub.plan === "beta" ? "pro" : "beta",
      });
      setSubMessage(res.message);
    } catch (e: any) {
      setSubMessage(String(e?.message || "Failed to record upgrade intent"));
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    setBusy("cancel");
    setSubMessage(null);
    try {
      const res = await api<{ message: string }>("/subscription/cancel", "POST", {});
      setSubMessage(res.message);
    } catch (e: any) {
      setSubMessage(String(e?.message || "Failed to record cancel intent"));
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = async () => {
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const res = await api<any>("/auth/me", "PATCH", {
        linkedin_url: linkedinUrl || null,
      });
      if (res?.user) {
        setProfile(res.user);
        localStorage.setItem("rf_user", JSON.stringify(res.user));
      }
      setProfileMsg("Saved.");
    } catch (e: any) {
      setProfileMsg(String(e?.message || "Failed to save profile"));
    } finally {
      setProfileSaving(false);
      setTimeout(() => setProfileMsg(null), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-xl mx-auto rounded-lg bg-white/10 backdrop-blur border border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">Settings</h1>
          <Link href="/" className="px-2 py-1 rounded bg-white/10 border border-white/10 text-sm">
            Close
          </Link>
        </div>
        {err ? <div className="text-xs opacity-80 break-all">{err}</div> : null}
        {s ? (
          <>
            <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2 text-sm">
              <div className="font-medium">Your profile</div>
              <div className="text-xs opacity-70">
                {profile?.email ? `Signed in as ${profile.email}` : "Signed in"}
              </div>
              <div className="mt-2">
                <label htmlFor="linkedinUrl" className="block text-xs opacity-70 mb-1">
                  LinkedIn URL (optional)
                </label>
                <input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/your-handle"
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    className="px-3 py-2 rounded bg-white/10 border border-white/20 text-xs"
                  >
                    {profileSaving ? "Saving..." : "Save profile"}
                  </button>
                  {profileMsg ? <div className="text-xs opacity-80">{profileMsg}</div> : null}
                </div>
              </div>
            </div>

            <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2 text-sm">
              <div>Environment: {s.environment}</div>
              <div>MV Threshold: {s.mv_threshold}</div>
              <div>
                CORS Origins:{" "}
                {Array.isArray(s.cors_origins) ? s.cors_origins.join(", ") : String(s.cors_origins)}
              </div>
              <div>Instantly Enabled: {String(s.instantly_enabled)}</div>
            </div>

            {sub && (
              <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Subscription</div>
                    <div className="text-xs opacity-80">{sub.plan_label}</div>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                    {sub.status}
                  </span>
                </div>
                <div className="text-xs opacity-80">
                  Seats: {sub.seats} · Limits: campaigns {sub.limits.max_campaigns ?? "—"}, contacts{" "}
                  {sub.limits.max_contacts ?? "—"}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleUpgrade}
                    disabled={busy === "upgrade"}
                    className="px-3 py-2 rounded bg-white/10 border border-white/20 text-xs"
                  >
                    {busy === "upgrade" ? "Saving..." : sub.plan === "beta" ? "Request Pro Upgrade" : "Switch to Beta"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={busy === "cancel"}
                    className="px-3 py-2 rounded bg-red-500/20 border border-red-500/40 text-xs"
                  >
                    {busy === "cancel" ? "Saving..." : "Request Cancel"}
                  </button>
                </div>
                {subMessage && <div className="text-xs opacity-80 mt-1">{subMessage}</div>}
              </div>
            )}

            <ThresholdForm current={s.mv_threshold} />
            <Citizenship />
            <div className="text-sm space-x-4">
              <Link className="underline" href="/replies">
                Go to Replies tester
              </Link>
              <Link className="underline" href="/metrics">
                Metrics
              </Link>
            </div>
          </>
        ) : (
          <div className="text-sm opacity-80">Loading...</div>
        )}
      </div>
    </div>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input type="range" min={0.5} max={1.0} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
  );
}

async function saveThreshold(n: number) {
  await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mv_threshold: n }) });
}

function ThresholdForm({ current }: { current: number }) {
  const [val, setVal] = (require("react") as any).useState(current);
  const [saved, setSaved] = (require("react") as any).useState(false);
  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
      <div className="text-sm">Email verification threshold: {val.toFixed(2)}</div>
      <Slider value={val} onChange={setVal} />
      <button onClick={async () => { await saveThreshold(val); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="px-3 py-2 rounded bg-white/10 border border-white/10 text-sm">Save</button>
      {saved ? <div className="text-xs opacity-80">Saved</div> : null}
    </div>
  );
}

function Citizenship() {
  const React = require("react");
  const [citizen, setCitizen] = React.useState<string>("US");
  const [status, setStatus] = React.useState<string>("Citizen");
  React.useEffect(() => {
    const c = localStorage.getItem("rf_citizenship_country") || "US";
    const s = localStorage.getItem("rf_citizenship_status") || "Citizen";
    setCitizen(c);
    setStatus(s);
  }, []);
  React.useEffect(() => {
    localStorage.setItem("rf_citizenship_country", citizen);
    localStorage.setItem("rf_citizenship_status", status);
  }, [citizen, status]);

  const RESIDENCE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "US", label: "United States" },
    { value: "CA", label: "Canada" },
    { value: "UK", label: "United Kingdom" },
    { value: "EU", label: "European Union" },
    { value: "SG", label: "Singapore" },
    { value: "AU", label: "Australia" },
    { value: "IN", label: "India" },
    { value: "BR", label: "Brazil" },
  ];
  const CITIZENSHIP_OPTIONS: Array<{ value: string; label: string }> = [
    { value: "Citizen", label: "Citizen" },
    { value: "Permanent Resident", label: "Permanent Resident" },
    { value: "Work Visa", label: "Work Visa" },
    { value: "Student Visa", label: "Student Visa" },
    { value: "Other", label: "Other" },
  ];

  const cycle = (current: string, options: Array<{ value: string }>) => {
    const idx = Math.max(0, options.findIndex((o) => o.value === current));
    const next = options[(idx + 1) % options.length]?.value;
    return next || options[0]?.value || current;
  };

  const citizenLabel = (RESIDENCE_OPTIONS.find((o) => o.value === citizen)?.label || citizen);
  const statusLabel = (CITIZENSHIP_OPTIONS.find((o) => o.value === status)?.label || status);

  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
      <div className="text-sm font-medium">Citizenship</div>
      <div className="text-xs opacity-70">
        Click a toggle to rotate through options.
      </div>
      <div className="flex gap-3">
        <div>
          <div className="text-xs opacity-70">Residence</div>
          <button
            type="button"
            onClick={() => setCitizen((v: string) => cycle(v, RESIDENCE_OPTIONS))}
            className="px-3 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 inline-flex items-center gap-2"
            title="Click to rotate"
          >
            <span className="text-sm">{citizenLabel}</span>
            <span className="text-xs opacity-70">↻</span>
          </button>
        </div>
        <div>
          <div className="text-xs opacity-70">Citizenship</div>
          <button
            type="button"
            onClick={() => setStatus((v: string) => cycle(v, CITIZENSHIP_OPTIONS))}
            className="px-3 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 inline-flex items-center gap-2"
            title="Click to rotate"
          >
            <span className="text-sm">{statusLabel}</span>
            <span className="text-xs opacity-70">↻</span>
          </button>
        </div>
      </div>
      <div className="text-xs opacity-70">Saved locally for personalization and compliance hints.</div>
    </div>
  );
}

