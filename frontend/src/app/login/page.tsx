"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const primaryCta = useMemo(() => (mode === "login" ? "Log in" : "Create account"), [mode]);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        if (!email.trim()) throw new Error("Email is required.");
        if (!firstName.trim() || !lastName.trim()) throw new Error("First and last name are required.");
        if (!phone.trim()) throw new Error("Phone number is required.");
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== password2) throw new Error("Passwords do not match.");

        const resp = await api<any>("/auth/register", "POST", {
          email,
          password,
          password_verify: password2,
          first_name: firstName,
          last_name: lastName,
          phone,
          linkedin_url: linkedinUrl || undefined,
        });
        if (!resp?.success) throw new Error(resp?.message || "Failed to create account.");
        if (resp?.user) localStorage.setItem("rf_user", JSON.stringify(resp.user));
      } else {
        if (!email.trim()) throw new Error("Email is required.");
        if (!password) throw new Error("Password is required.");

        const resp = await api<any>("/auth/login", "POST", { email, password });
        if (!resp?.success) throw new Error(resp?.message || "Failed to log in.");
        if (resp?.user) localStorage.setItem("rf_user", JSON.stringify(resp.user));
      }

      router.push("/job-preferences");
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const Eye = ({ open }: { open: boolean }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
      {open ? (
        <path d="M12 5c-7.633 0-11 7-11 7s3.367 7 11 7 11-7 11-7-3.367-7-11-7zm0 12c-2.761 0-5-2.239-5-5s2.239-5 5-5 5 2.239 5 5-2.239 5-5 5zm0-8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3-1.343-3-3-3z" />
      ) : (
        <path d="M2.1 3.51L3.51 2.1 21.9 20.49 20.49 21.9l-2.28-2.28c-1.78.87-3.78 1.38-6.21 1.38C4.37 21 1 14 1 14s1.26-2.62 4.1-4.88L2.1 3.51zM12 7c1.41 0 2.74.26 3.99.72l-1.68 1.68A4.98 4.98 0 0012 9c-2.76 0-5 2.24-5 5 0 .8.19 1.55.52 2.22l-1.6 1.6C4.36 16.4 3.1 14 3.1 14S5.47 7 12 7zm10 7s-.96 2-3.12 3.97l-1.44-1.44C18.62 15.45 19.1 14 19.1 14S16.53 9 12 9c-.22 0-.44.01-.65.03L9.5 7.18C10.3 7.06 11.13 7 12 7c7.63 0 11 7 11 7z" />
      )}
    </svg>
  );

  return (
    <div className="min-h-screen py-10 text-slate-100">
      <div className="mx-auto max-w-lg px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex flex-col items-center text-center mb-8">
            <img src="/rf_logo.png" alt="RoleFerry Logo" className="h-20 w-auto opacity-100" />
            <img src="/rf_wordmark.png" alt="RoleFerry Wordmark" className="h-14 w-auto mt-2 opacity-100" />
            <div className="mt-6 text-sm text-white/70">Relationship-first outreach engine</div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            <button
              onClick={() => setMode("login")}
              className={`rounded-md px-3 py-2 text-sm font-semibold border ${mode === "login" ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/10 text-white/70 hover:text-white"}`}
            >
              Login
            </button>
            <button
              onClick={() => setMode("register")}
              className={`rounded-md px-3 py-2 text-sm font-semibold border ${mode === "register" ? "bg-white/10 border-white/20 text-white" : "bg-black/20 border-white/10 text-white/70 hover:text-white"}`}
            >
              Create account
            </button>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-red-300/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            {mode === "register" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">First name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Last name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20" />
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-xs text-white/70 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
              />
            </div>

            {mode === "register" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20" />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">LinkedIn URL (optional)</label>
                  <input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20" />
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-xs text-white/70 mb-1">Password</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPw1 ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 pr-10 text-sm text-white outline-none focus:border-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPw1((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                  aria-label={showPw1 ? "Hide password" : "Show password"}
                >
                  <Eye open={showPw1} />
                </button>
              </div>
            </div>

            {mode === "register" ? (
              <div>
                <label className="block text-xs text-white/70 mb-1">Verify password</label>
                <div className="relative">
                  <input
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    type={showPw2 ? "text" : "password"}
                    autoComplete="new-password"
                    className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 pr-10 text-sm text-white outline-none focus:border-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1"
                    aria-label={showPw2 ? "Hide password" : "Show password"}
                  >
                    <Eye open={showPw2} />
                  </button>
                </div>
              </div>
            ) : null}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Working…" : primaryCta}
            </button>

            <div className="text-xs text-white/50">
              By continuing, you agree this is a demo environment. In production, set `ROLEFERRY_JWT_SECRET` and enable secure cookies.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


