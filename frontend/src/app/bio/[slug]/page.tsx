"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import placeholderPat from "@/profile-pat.png";

type BioPageDraft = {
  display_name: string;
  headline: string;
  subheadline: string;
  calendly_url: string;
  linkedin_url: string;
  proof_points: string[];
  fit_points: string[];
  resume_extract: any;
  portfolio_url: string;
  profile_image_url?: string;
  theme?: { accent?: string };
};

type BioPageResponse = {
  slug: string;
  published_at: string;
  draft: BioPageDraft;
};

function isNonEmpty(s: any) {
  return String(s ?? "").trim().length > 0;
}

function fmtTitleCase(s: string) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t;
}

export default function PublicBioPage() {
  const params = useParams();
  const slug = useMemo(() => String((params as any)?.slug || ""), [params]);
  const [data, setData] = useState<BioPageResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await api<BioPageResponse>(`/bio-pages/${encodeURIComponent(slug)}`, "GET");
        setData(res);
      } catch (e: any) {
        setErr(String(e?.message || "Bio page not found"));
      }
    })();
  }, [slug]);

  const d = data?.draft || null;
  const rx = d?.resume_extract || {};
  const positions = Array.isArray(rx?.positions) ? rx.positions : [];
  const skills = Array.isArray(rx?.skills) ? rx.skills : [];
  const education = Array.isArray(rx?.education) ? rx.education : [];

  if (err) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold">Bio Page not found</h1>
          <p className="mt-2 text-white/70 break-all">{err}</p>
        </div>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-white/70">Loading…</div>
        </div>
      </div>
    );
  }

  const profileSrc =
    isNonEmpty(d.profile_image_url) ? String(d.profile_image_url) : (placeholderPat as any).src || placeholderPat;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-black/20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-sm font-bold tracking-wide">RoleFerry</div>
          <div className="flex items-center gap-2">
            <a
              href={isNonEmpty(d.linkedin_url) ? d.linkedin_url : undefined}
              target="_blank"
              className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                isNonEmpty(d.linkedin_url)
                  ? "bg-white/5 border-white/10 hover:bg-white/10"
                  : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
              }`}
              aria-disabled={!isNonEmpty(d.linkedin_url)}
            >
              Let’s Connect on LinkedIn
            </a>
            <a
              href={isNonEmpty(d.calendly_url) ? d.calendly_url : undefined}
              target="_blank"
              className={`px-3 py-2 rounded-lg border text-sm font-semibold ${
                isNonEmpty(d.calendly_url)
                  ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25"
                  : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
              }`}
              aria-disabled={!isNonEmpty(d.calendly_url)}
            >
              Setup an interview with {d.display_name || "me"}
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={profileSrc}
                alt="Profile picture"
                className="h-20 w-20 rounded-full object-cover border border-white/10 bg-white/5"
              />
              <div className="min-w-0">
                <div className="text-sm text-white/60">Candidate</div>
                <div className="text-xl font-bold truncate">{d.display_name || "—"}</div>
              </div>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight">{d.headline}</h1>
            <p className="mt-4 text-white/70 text-lg">{d.subheadline}</p>

            {d.proof_points?.length ? (
              <div className="mt-8">
                <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                  Proof points
                </h2>
                <ul className="mt-3 space-y-2 text-white/85">
                  {d.proof_points.slice(0, 8).map((p, i) => (
                    <li key={`proof_${i}`} className="flex gap-2">
                      <span className="text-emerald-300">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {d.fit_points?.length ? (
              <div className="mt-8">
                <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">
                  Fit for this role
                </h2>
                <ul className="mt-3 space-y-2 text-white/85">
                  {d.fit_points.slice(0, 8).map((p, i) => (
                    <li key={`fit_${i}`} className="flex gap-2">
                      <span className="text-blue-300">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-bold">Resume snapshot</div>

              <div className="mt-4">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Experience
                </div>
                {positions.length ? (
                  <div className="space-y-3">
                    {positions.slice(0, 6).map((p: any, i: number) => (
                      <div key={`pos_${i}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="font-semibold">
                          {fmtTitleCase(String(p?.title || "")) || "Role"}{" "}
                          <span className="text-white/60">
                            @ {fmtTitleCase(String(p?.company || "")) || "Company"}
                          </span>
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {String(p?.start_date || "").trim() || "—"} –{" "}
                          {String(p?.end_date || "").trim() || (p?.current ? "Present" : "—")}
                        </div>
                        {isNonEmpty(p?.description) ? (
                          <div className="text-sm text-white/75 mt-2">{String(p.description)}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Skills
                </div>
                {skills.length ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.slice(0, 20).map((s: any, i: number) => (
                      <span
                        key={`skill_${i}`}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/5 border border-white/10 text-white/80"
                      >
                        {String(s)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  Education
                </div>
                {education.length ? (
                  <div className="space-y-2 text-sm text-white/80">
                    {education.slice(0, 5).map((e: any, i: number) => (
                      <div key={`edu_${i}`} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="font-semibold">{String(e?.school || "School")}</div>
                        <div className="text-white/70">
                          {String(e?.degree || "").trim() || "—"}
                          {String(e?.field || "").trim() ? ` · ${String(e.field)}` : ""}
                        </div>
                        <div className="text-xs text-white/50 mt-1">
                          {String(e?.start_year || "").trim() || "—"} – {String(e?.end_year || "").trim() || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

