"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default function LeadsPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const sourceUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, []);

  async function submit() {
    setError(null);
    setSuccess(false);
    const name = safeStr(fullName);
    const em = safeStr(email);
    const ph = safeStr(phone);
    if (!name) {
      setError("Full name is required.");
      return;
    }
    if (!em || !em.includes("@")) {
      setError("A valid email is required.");
      return;
    }
    setSubmitting(true);
    try {
      const meta: any = {};
      try {
        if (typeof window !== "undefined") {
          const u = new URL(window.location.href);
          meta.utm_source = u.searchParams.get("utm_source") || "";
          meta.utm_medium = u.searchParams.get("utm_medium") || "";
          meta.utm_campaign = u.searchParams.get("utm_campaign") || "";
          meta.ref = u.searchParams.get("ref") || "";
        }
      } catch {}

      const resp = await api<{ success: boolean; message?: string }>("/leads/capture", "POST", {
        full_name: name,
        email: em,
        phone: ph || undefined,
        source_url: sourceUrl || undefined,
        meta,
      });
      if (!resp?.success) throw new Error(resp?.message || "Failed to submit.");
      setSuccess(true);
      setFullName("");
      setEmail("");
      setPhone("");
    } catch (e: any) {
      setError(String(e?.message || "Failed to submit."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-xl border border-black/10 bg-white p-8 shadow-lg">
          <div className="text-2xl font-semibold text-slate-900">Stay in the loop</div>
          <div className="mt-2 text-sm text-slate-600">
            Leave your details and we’ll reach out.
          </div>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Submitted. Thanks!
            </div>
          ) : null}

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Full Name <span className="text-red-600">*</span>
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="mt-2 w-full rounded-md border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="mt-2 w-full rounded-md border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-800">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className="mt-2 w-full rounded-md border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="tel"
              />
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-2 w-full rounded-md bg-sky-600 px-4 py-3 text-center text-sm font-semibold tracking-wide text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {submitting ? "SUBMITTING…" : "SUBMIT"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


