"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import placeholderPat from "@/profile-pat.png";
import { formatCompanyName } from "@/lib/format";
import { computeBioColors, bulletGlyph } from "@/lib/bioTheme";
import { formatDateLike } from "@/lib/formatDateLike";

type BioPageDraft = {
  display_name: string;
  headline: string;
  subheadline: string;
  calendly_url: string;
  linkedin_url: string;
  video_url?: string;
  proof_points: string[];
  fit_points: string[];
  resume_extract: any;
  portfolio_url: string;
  profile_image_url?: string;
  theme?: { accent?: string };
};

const DRAFT_KEY = "bio_page_draft";
const PROFILE_IMAGE_KEY = "bio_page_profile_image_url";

function isNonEmpty(s: any) {
  return String(s ?? "").trim().length > 0;
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function firstNameFromDisplayName(name: any) {
  const t = String(name ?? "").trim();
  if (!t) return "me";
  return t.split(/\s+/).filter(Boolean)[0] || "me";
}

export default function LocalBioPreview() {
  const [draft, setDraft] = useState<BioPageDraft | null>(null);
  const [resumeExtractLocal, setResumeExtractLocal] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      setDraft(raw ? JSON.parse(raw) : null);
    } catch {
      setDraft(null);
    }
    try {
      const rawResume = localStorage.getItem("resume_extract");
      setResumeExtractLocal(rawResume ? JSON.parse(rawResume) : null);
    } catch {
      setResumeExtractLocal(null);
    }
  }, []);

  const profileSrc = useMemo(() => {
    const fromDraft = safeStr(draft?.profile_image_url);
    if (fromDraft) return fromDraft;
    try {
      const fromKey = safeStr(localStorage.getItem(PROFILE_IMAGE_KEY));
      if (fromKey) return fromKey;
    } catch {}
    return (placeholderPat as any).src || placeholderPat;
  }, [draft]);

  const rx = draft?.resume_extract || resumeExtractLocal || {};
  const positions = Array.isArray(rx?.positions) ? rx.positions : [];
  const skills = Array.isArray(rx?.skills) ? rx.skills : [];
  const education = Array.isArray(rx?.education) ? rx.education : [];
  const colors = useMemo(() => computeBioColors((draft as any)?.theme || null), [draft]);
  const bullet = useMemo(() => bulletGlyph((draft as any)?.theme?.bullet_style), [draft]);

  if (!draft) {
    return (
      <div className="min-h-screen bg-slate-950 text-white px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-white/70">
            No draft found. Go to{" "}
            <Link className="underline text-white" href="/bio-page">
              Bio Page
            </Link>{" "}
            and click Generate first.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(to bottom, ${colors.bg_top}, ${colors.bg_bottom})`,
        color: colors.fg,
      }}
    >
      <div style={{ borderBottom: `1px solid ${colors.border}`, background: colors.cardStrong }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="text-sm font-bold tracking-wide">RoleFerry • Preview</div>
          <div className="flex items-center gap-2">
            <a
              href={isNonEmpty(draft.linkedin_url) ? draft.linkedin_url : undefined}
              target="_blank"
              className="px-3 py-2 rounded-lg border text-sm font-semibold"
              style={{
                borderColor: colors.border,
                background: isNonEmpty(draft.linkedin_url) ? colors.card : "transparent",
                color: colors.fg,
                borderStyle: isNonEmpty(draft.linkedin_url) ? "solid" : "dashed",
              }}
              aria-disabled={!isNonEmpty(draft.linkedin_url)}
            >
              Let’s Connect on LinkedIn
            </a>
            <a
              href={isNonEmpty(draft.calendly_url) ? draft.calendly_url : undefined}
              target="_blank"
              className="px-3 py-2 rounded-lg border text-sm font-semibold"
              style={{
                borderColor: colors.border,
                background: isNonEmpty(draft.calendly_url) ? colors.buttonBg : "transparent",
                color: isNonEmpty(draft.calendly_url) ? colors.buttonFg : colors.fg,
                borderStyle: isNonEmpty(draft.calendly_url) ? "solid" : "dashed",
              }}
              aria-disabled={!isNonEmpty(draft.calendly_url)}
            >
              Setup an interview with {firstNameFromDisplayName(draft.display_name)}
            </a>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6">
          <Link href="/bio-page" className="text-sm underline" style={{ color: colors.fg }}>
            ← Back to Bio Page editor
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <div className="flex items-center gap-4 mb-6">
              <img
                src={profileSrc}
                alt="Profile picture"
                className="h-20 w-20 rounded-full object-cover border"
                style={{ borderColor: colors.border, background: colors.card }}
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Candidate</div>
                <div className="text-xl font-bold truncate">{draft.display_name || "—"}</div>
              </div>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight">{draft.headline}</h1>
            {(draft as any)?.theme?.slogan_line ? (
              <div className="mt-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold"
                style={{ borderColor: colors.border, background: colors.cardStrong }}
              >
                {String((draft as any).theme.slogan_line)}
              </div>
            ) : null}
            <p className="mt-4 text-lg">{draft.subheadline}</p>

            {isNonEmpty(draft.video_url) ? (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-wider">Intro video</h2>
                <div className="mt-3">
                  <video
                    className="w-full rounded-xl border"
                    controls
                    playsInline
                    src={String(draft.video_url)}
                    style={{ borderColor: colors.border, background: colors.cardStrong }}
                  />
                </div>
              </div>
            ) : null}

            {draft.proof_points?.length ? (
              <div className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-wider">Proof points</h2>
                <ul className="mt-3 space-y-2">
                  {draft.proof_points.slice(0, 8).map((p, i) => (
                    <li key={`proof_${i}`} className="flex gap-2">
                      <span className="font-bold" aria-hidden="true">{bullet}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {draft.fit_points?.length ? (
              <div className="mt-8">
                <h2 className="text-sm font-bold uppercase tracking-wider">Core strengths</h2>
                <ul className="mt-3 space-y-2">
                  {draft.fit_points.slice(0, 8).map((p, i) => (
                    <li key={`fit_${i}`} className="flex gap-2">
                      <span className="font-bold" aria-hidden="true">{bullet}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-2xl border p-5" style={{ borderColor: colors.border, background: colors.card }}>
              <div className="text-sm font-bold">Resume snapshot</div>

              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2">Experience</div>
                {positions.length ? (
                  <div className="space-y-3">
                    {positions.slice(0, 6).map((p: any, i: number) => (
                      <div key={`pos_${i}`} className="rounded-lg border p-3" style={{ borderColor: colors.border, background: colors.cardStrong }}>
                        <div className="font-semibold">
                          {safeStr(p?.title) || "Role"}{" "}
                          <span>@ {formatCompanyName(String(p?.company || "")) || "Company"}</span>
                        </div>
                        <div className="text-xs font-semibold mt-1">
                          {formatDateLike(p?.startDate ?? p?.start_date ?? p?.start ?? p?.from ?? p?.startYear ?? p?.start_year) || "—"} –{" "}
                          {formatDateLike(p?.endDate ?? p?.end_date ?? p?.end ?? p?.to ?? p?.endYear ?? p?.end_year) || (p?.current ? "Present" : "—")}
                        </div>
                        {isNonEmpty(p?.description) ? (
                          <div className="text-sm mt-2">{String(p.description)}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm font-semibold">Missing details</div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2">Skills</div>
                {skills.length ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.slice(0, 20).map((s: any, i: number) => (
                      <span
                        key={`skill_${i}`}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold border"
                        style={{ borderColor: colors.border, background: colors.cardStrong }}
                      >
                        {String(s)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm font-semibold">Missing details</div>
                )}
              </div>

              <div className="mt-5">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2">Education</div>
                {education.length ? (
                  <ul className="space-y-2 text-sm">
                    {education.slice(0, 4).map((e: any, i: number) => (
                      <li key={`edu_${i}`} className="rounded-lg border p-3" style={{ borderColor: colors.border, background: colors.cardStrong }}>
                        <div className="font-semibold">{safeStr(e?.school) || "School"}</div>
                        <div className="text-xs mt-1">
                          {[safeStr(e?.degree), safeStr(e?.field)].filter(Boolean).join(" • ") || "—"}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm font-semibold">Missing details</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

