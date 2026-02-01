"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import placeholderPat from "@/profile-pat.png";
import { BIO_BG_OPTIONS, BIO_BULLET_STYLES, BIO_SLOGAN_PRESETS, computeBioColors, normalizeBioTheme, bulletGlyph } from "@/lib/bioTheme";

type BioPageTheme = {
  accent: string;
  bg_top?: string;
  bg_bottom?: string;
  bullet_style?: string;
  slogan_line?: string;
};

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
  theme: BioPageTheme;
};

const DRAFT_KEY = "bio_page_draft";
const PUBLISHED_KEY = "bio_page_published";
const BIO_URL_KEY = "bio_page_url";
const PROFILE_IMAGE_KEY = "bio_page_profile_image_url";
const VIDEO_KEY = "bio_page_video_url";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function formatDateLike(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    const low = s.toLowerCase();
    if (!s) return "";
    if (low === "null" || low === "none" || low === "n/a" || low === "na") return "";
    return s;
  }
  if (typeof v === "object") {
    // Handle shapes like { year: 2022, month: 3 } or { start_year: 2020 } etc.
    const y = (v as any)?.year ?? (v as any)?.start_year ?? (v as any)?.startYear ?? (v as any)?.y;
    const m = (v as any)?.month ?? (v as any)?.m;
    if (y && m) {
      const mm = String(m).padStart(2, "0");
      return `${mm}/${String(y)}`;
    }
    if (y) return String(y);
    const iso = (v as any)?.date ?? (v as any)?.value ?? (v as any)?.text;
    if (iso) return formatDateLike(iso);
  }
  return "";
}

export default function BioPageStep() {
  const profileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BioPageDraft | null>(null);
  const [busy, setBusy] = useState<"generate" | "publish" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resumeExtract, setResumeExtract] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [painpointMatches, setPainpointMatches] = useState<any>(null);
  const [offerDraft, setOfferDraft] = useState<any>(null);
  const [bioUrl, setBioUrl] = useState<string>("");
  const [profileImageUrl, setProfileImageUrl] = useState<string>("");
  const [resumeMeta, setResumeMeta] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");

  useEffect(() => {
    // Load cached draft if available for quick UX
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft(JSON.parse(raw));
    } catch {}
  }, []);

  const persistDraft = (next: BioPageDraft | null) => {
    setDraft(next);
    if (!next) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {}
  };

  const updateTheme = (patch: Partial<BioPageTheme>) => {
    const cur = draft || ({} as any);
    const base = { ...(cur.theme || {}) };
    const mergedTheme: any = { ...base, ...(patch || {}) };
    // Enforce a single readable "mode" (both backgrounds light or both dark).
    if (patch?.bg_top) {
      const topKind = normalizeBioTheme({ bg_top: String(patch.bg_top), bg_bottom: String(mergedTheme.bg_bottom || "") }).kind;
      const bottomKind = normalizeBioTheme({ bg_top: String(mergedTheme.bg_bottom || patch.bg_top), bg_bottom: String(mergedTheme.bg_bottom || patch.bg_top) }).kind;
      if (bottomKind !== topKind) mergedTheme.bg_bottom = String(patch.bg_top);
    }
    if (patch?.bg_bottom) {
      const bottomKind = normalizeBioTheme({ bg_top: String(mergedTheme.bg_top || patch.bg_bottom), bg_bottom: String(patch.bg_bottom) }).kind;
      const topKind = normalizeBioTheme({ bg_top: String(mergedTheme.bg_top || patch.bg_bottom), bg_bottom: String(mergedTheme.bg_top || patch.bg_bottom) }).kind;
      if (topKind !== bottomKind) mergedTheme.bg_top = String(patch.bg_bottom);
    }
    const norm = normalizeBioTheme(mergedTheme);
    persistDraft({ ...cur, theme: { ...mergedTheme, ...norm } } as any);
  };

  useEffect(() => {
    // Load dependencies from localStorage (client-only)
    try {
      const rawResume = localStorage.getItem("resume_extract");
      setResumeExtract(rawResume ? JSON.parse(rawResume) : null);
    } catch {
      setResumeExtract(null);
    }

    try {
      const metaRaw = localStorage.getItem("resume_extract_meta");
      setResumeMeta(metaRaw ? JSON.parse(metaRaw) : null);
    } catch {
      setResumeMeta(null);
    }

    try {
      const rawJob = localStorage.getItem("selected_job_description");
      setSelectedJob(rawJob ? JSON.parse(rawJob) : null);
    } catch {
      setSelectedJob(null);
    }

    try {
      const rawMatches = localStorage.getItem("painpoint_matches");
      setPainpointMatches(rawMatches ? JSON.parse(rawMatches) : null);
    } catch {
      setPainpointMatches(null);
    }

    try {
      const rawOffer = localStorage.getItem("offer_draft");
      setOfferDraft(rawOffer ? JSON.parse(rawOffer) : null);
    } catch {
      setOfferDraft(null);
    }

    try {
      setBioUrl(safeStr(localStorage.getItem(BIO_URL_KEY)));
    } catch {
      setBioUrl("");
    }

    try {
      setProfileImageUrl(safeStr(localStorage.getItem(PROFILE_IMAGE_KEY)));
    } catch {
      setProfileImageUrl("");
    }

    try {
      setVideoUrl(safeStr(localStorage.getItem(VIDEO_KEY)));
    } catch {
      setVideoUrl("");
    }
  }, []);

  const onPickProfilePhoto = () => {
    profileInputRef.current?.click();
  };

  const onPickVideo = () => {
    videoInputRef.current?.click();
  };

  const onProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      setMsg("Please upload an image file (PNG/JPG).");
      setTimeout(() => setMsg(null), 2500);
      try {
        e.target.value = "";
      } catch {}
      return;
    }

    // Keep this small-ish since we're storing a data URL in localStorage.
    if (file.size > 2.5 * 1024 * 1024) {
      setMsg("Please use an image under 2.5MB.");
      setTimeout(() => setMsg(null), 2500);
      try {
        e.target.value = "";
      } catch {}
      return;
    }

    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

    setProfileImageUrl(dataUrl);
    try {
      localStorage.setItem(PROFILE_IMAGE_KEY, dataUrl);
    } catch {}
    try {
      e.target.value = "";
    } catch {}
  };

  const onVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith("video/")) {
      setMsg("Please upload a video file (MP4/MOV/WebM).");
      setTimeout(() => setMsg(null), 2500);
      try {
        e.target.value = "";
      } catch {}
      return;
    }

    // IMPORTANT: localStorage is small. Keep this strict or it will fail silently.
    // If you need larger videos, paste a hosted URL below instead.
    const MAX_BYTES = 4.5 * 1024 * 1024; // ~4.5MB
    if (file.size > MAX_BYTES) {
      setMsg("Video too large for in-app upload. Please upload to Loom/Drive and paste the URL instead.");
      setTimeout(() => setMsg(null), 3200);
      try {
        e.target.value = "";
      } catch {}
      return;
    }

    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

    setVideoUrl(dataUrl);
    try {
      localStorage.setItem(VIDEO_KEY, dataUrl);
    } catch {
      setMsg("Couldn’t save the video (storage limit). Please paste a hosted video URL instead.");
      setTimeout(() => setMsg(null), 3500);
    }

    // Keep draft in sync so it publishes/loads on the public page.
    persistDraft({ ...(draft || ({} as any)), video_url: dataUrl } as any);

    try {
      e.target.value = "";
    } catch {}
  };

  const generate = async () => {
    setBusy("generate");
    setMsg(null);
    try {
      const res = await api<{ draft: BioPageDraft }>("/bio-pages/generate", "POST", {
        resume_extract: resumeExtract,
        selected_job_description: selectedJob,
        painpoint_matches: Array.isArray(painpointMatches) ? painpointMatches : [],
        offer_draft: offerDraft,
      });
      if (res?.draft) {
        // Preserve user-entered URLs across regenerations.
        const merged = {
          ...res.draft,
          linkedin_url: safeStr(draft?.linkedin_url) || safeStr(res.draft.linkedin_url),
          calendly_url: safeStr(draft?.calendly_url) || safeStr(res.draft.calendly_url),
          video_url: safeStr(draft?.video_url) || safeStr(res.draft.video_url),
          profile_image_url: profileImageUrl || res.draft.profile_image_url || "",
          theme: {
            ...(res.draft.theme || {}),
            ...(draft?.theme || {}),
          },
        };
        persistDraft(merged);
      }
      setMsg("Draft generated.");
    } catch (e: any) {
      setMsg(String(e?.message || "Failed to generate bio page"));
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  const publish = async () => {
    if (!draft) return;
    setBusy("publish");
    setMsg(null);
    try {
      const res = await api<{ slug: string; public_url: string }>("/bio-pages/publish", "POST", {
        draft: { ...draft, profile_image_url: profileImageUrl || draft.profile_image_url || "" },
      });
      const url = safeStr(res?.public_url);
      if (url) {
        localStorage.setItem(PUBLISHED_KEY, JSON.stringify(res));
        localStorage.setItem(BIO_URL_KEY, url);
        setBioUrl(url);
      }
      setMsg(url ? "Published." : "Published (no URL returned).");
    } catch (e: any) {
      setMsg(String(e?.message || "Failed to publish"));
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 2500);
    }
  };

  const copyLink = async () => {
    if (!bioUrl) {
      setMsg("Publish first to get a link.");
      setTimeout(() => setMsg(null), 2500);
      return;
    }
    try {
      await navigator.clipboard.writeText(bioUrl);
      setMsg("Copied link.");
    } catch {
      setMsg("Couldn’t copy automatically. (Clipboard blocked)");
    } finally {
      setTimeout(() => setMsg(null), 2500);
    }
  };

  const previewHref = useMemo(() => {
    if (bioUrl) return bioUrl;
    // If not published, we can still preview using a local-only route in this step (below)
    return "";
  }, [bioUrl, draft]);

  const localPreviewHref = useMemo(() => {
    return draft ? "/bio/preview" : "";
  }, [draft]);

  const resumeSnapshot = useMemo(() => {
    // Prefer the parsed resume from the Resume step (source of truth for public rendering).
    // Fall back to whatever came back in the draft payload.
    return resumeExtract || (draft as any)?.resume_extract || null;
  }, [resumeExtract, draft]);

  const asArr = (v: any) => (Array.isArray(v) ? v : []);

  const colors = useMemo(() => computeBioColors(draft?.theme || null), [draft]);
  const bullet = useMemo(() => bulletGlyph((draft?.theme as any)?.bullet_style), [draft]);

  return (
    <div className="min-h-screen py-8" style={{ background: "linear-gradient(to bottom, #020617, #0B1020)", color: "#FFFFFF" }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <div className="text-xs text-white/60">Step 10 of 12</div>
            <h1 className="text-3xl font-bold">Bio Page</h1>
            <p className="text-white/70 mt-1">
              Generate a public bio page link you can paste into email or a LinkedIn note.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10">
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-sm font-bold">Actions</div>
              <div className="text-xs text-white/60 mt-1">
                Click Generate to draft your bio page. Publish to get a permanent URL.
              </div>
              <div className="mt-3 flex flex-col gap-2">
                <a
                  href={localPreviewHref || undefined}
                  target="_blank"
                  className={`w-full px-4 py-2 rounded-lg border font-semibold text-center ${
                    localPreviewHref
                      ? "bg-white/5 border-white/10 hover:bg-white/10"
                      : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
                  }`}
                  aria-disabled={!localPreviewHref}
                >
                  Preview (local)
                </a>
                <button
                  onClick={generate}
                  disabled={busy === "generate"}
                  className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold hover:shadow-md disabled:opacity-60"
                >
                  {busy === "generate" ? "Generating..." : "Generate / Regenerate"}
                </button>
                <button
                  onClick={publish}
                  disabled={!draft || busy === "publish"}
                  className="w-full px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold hover:bg-emerald-500/25 disabled:opacity-50"
                >
                  {busy === "publish" ? "Publishing..." : "Publish"}
                </button>
                <button
                  onClick={copyLink}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 font-semibold"
                >
                  Copy link
                </button>
                {previewHref ? (
                  <a
                    href={previewHref}
                    target="_blank"
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 font-semibold text-center"
                  >
                    Open public page
                  </a>
                ) : null}
              </div>
              {msg ? <div className="mt-3 text-xs text-white/70 break-all">{msg}</div> : null}
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-sm font-bold">Style</div>
              <div className="text-xs text-white/60 mt-1">
                Pick backgrounds + bullet style. We automatically choose readable text colors.
              </div>

              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                    Slogan line (optional)
                  </label>
                  <select
                    value={safeStr((draft?.theme as any)?.slogan_line)}
                    onChange={(e) => updateTheme({ slogan_line: e.target.value })}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">None</option>
                    {BIO_SLOGAN_PRESETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                      Top background
                    </label>
                    <select
                      value={colors.bg_top}
                      onChange={(e) => updateTheme({ bg_top: e.target.value })}
                      className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {BIO_BG_OPTIONS.map((o) => (
                        <option key={o.id} value={o.hex}>
                          {o.kind === "dark" ? "Dark" : "Light"} · {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                      Bottom background
                    </label>
                    <select
                      value={colors.bg_bottom}
                      onChange={(e) => updateTheme({ bg_bottom: e.target.value })}
                      className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {BIO_BG_OPTIONS.map((o) => (
                        <option key={o.id} value={o.hex}>
                          {o.kind === "dark" ? "Dark" : "Light"} · {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                    Bullet icon
                  </label>
                  <select
                    value={safeStr((draft?.theme as any)?.bullet_style) || "dot"}
                    onChange={(e) => updateTheme({ bullet_style: e.target.value })}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BIO_BULLET_STYLES.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.glyph} · {b.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/70">
                    Preview mode: <span className="font-semibold">{colors.kind === "dark" ? "Dark" : "Light"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-sm font-bold">Intro video</div>
              <div className="text-xs text-white/60 mt-1">
                Upload a small MP4 (under ~4.5MB) or paste a hosted video URL.
              </div>
              <div className="mt-3 space-y-2">
                <input ref={videoInputRef} type="file" accept="video/*" onChange={onVideoChange} className="hidden" />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onPickVideo}
                    className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10"
                  >
                    Upload video
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVideoUrl("");
                      try {
                        localStorage.removeItem(VIDEO_KEY);
                      } catch {}
                      persistDraft({ ...(draft || ({} as any)), video_url: "" } as any);
                    }}
                    className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white/70 text-xs font-bold hover:bg-white/10"
                  >
                    Remove
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                    Video URL (optional)
                  </label>
                  <input
                    value={safeStr(draft?.video_url || videoUrl)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setVideoUrl(v);
                      try {
                        localStorage.setItem(VIDEO_KEY, v);
                      } catch {}
                      persistDraft({ ...(draft || ({} as any)), video_url: v } as any);
                    }}
                    placeholder="https://www.loom.com/share/... or direct .mp4 URL"
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {safeStr(draft?.video_url || videoUrl) ? (
                  <video
                    className="mt-2 w-full rounded-lg border border-white/10 bg-black/30"
                    controls
                    src={safeStr(draft?.video_url || videoUrl)}
                  />
                ) : (
                  <div className="text-xs text-white/60">No video selected.</div>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-sm font-bold">Links (CTA)</div>
              <div className="text-xs text-white/60 mt-1">These appear on the public bio page buttons.</div>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    value={safeStr(draft?.linkedin_url)}
                    onChange={(e) => {
                      const next = { ...(draft || ({} as any)), linkedin_url: e.target.value };
                      persistDraft(next as any);
                    }}
                    placeholder="https://www.linkedin.com/in/your-handle"
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                    Calendly URL
                  </label>
                  <input
                    value={safeStr(draft?.calendly_url)}
                    onChange={(e) => {
                      const next = { ...(draft || ({} as any)), calendly_url: e.target.value };
                      persistDraft(next as any);
                    }}
                    placeholder="https://calendly.com/your-handle/intro"
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="text-sm font-bold">What will show up</div>
              <ul className="mt-2 text-xs text-white/60 space-y-1 list-disc list-inside">
                <li>Headline + summary</li>
                <li>Proof points grounded in your resume metrics/accomplishments</li>
                <li>Fit points tied to the selected job’s responsibilities/pain points</li>
                <li>Resume section rendered from your parsed resume (no invented facts)</li>
                <li>Calls-to-action: Calendly + LinkedIn</li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-8">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">Preview</div>
                <div className="text-xs text-white/60">
                  {draft ? `Draft ready for ${draft.display_name || "user"}` : "No draft yet"}
                </div>
              </div>

              {!draft ? (
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/70">
                  Click <span className="font-semibold text-white">Generate</span> to create your first Bio Page draft.
                </div>
              ) : (
                <div
                  className="mt-4 rounded-lg border p-6"
                  style={{
                    background: `linear-gradient(to bottom, ${colors.bg_top}, ${colors.bg_bottom})`,
                    borderColor: colors.border,
                    color: colors.fg,
                  }}
                >
                  <div className="flex flex-col items-center text-center">
                    <input
                      ref={profileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={onProfilePhotoChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={onPickProfilePhoto}
                      className="group rounded-full border p-1 transition-colors"
                      style={{ borderColor: colors.border, background: colors.card }}
                      aria-label="Upload profile picture"
                      title="Upload profile picture"
                    >
                      <img
                        src={profileImageUrl || (placeholderPat as any).src || placeholderPat}
                        alt="Profile picture"
                        className="h-24 w-24 rounded-full object-cover"
                      />
                    </button>
                    <div className="mt-2 text-xs font-semibold">upload your own profile picture.</div>
                  </div>

                  <div className="text-xs font-semibold mb-2">CTA</div>
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: colors.border, background: colors.card }}>
                      Setup an interview with <span className="font-semibold">{draft.display_name || "you"}</span>
                    </div>
                    <div className="px-3 py-2 rounded-lg border text-sm" style={{ borderColor: colors.border, background: colors.card }}>
                      Let’s connect on LinkedIn
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-2xl font-extrabold">{draft.headline || "Your headline"}</div>
                    {safeStr((draft.theme as any)?.slogan_line) ? (
                      <div className="mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold"
                        style={{ borderColor: colors.border, background: colors.cardStrong }}
                      >
                        {safeStr((draft.theme as any)?.slogan_line)}
                      </div>
                    ) : null}
                    <div className="mt-2">{draft.subheadline || "Your subheadline"}</div>
                  </div>

                  {safeStr(draft.video_url || videoUrl) ? (
                    <div className="mt-6">
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2">
                        Intro video
                      </div>
                      <video
                        className="w-full rounded-xl border"
                        controls
                        playsInline
                        src={safeStr(draft.video_url || videoUrl)}
                        style={{ borderColor: colors.border, background: colors.cardStrong }}
                      />
                    </div>
                  ) : null}

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border p-4" style={{ borderColor: colors.border, background: colors.card }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2">
                        Proof
                      </div>
                      {draft.proof_points?.length ? (
                        <ul className="text-sm space-y-1">
                          {draft.proof_points.slice(0, 6).map((p, i) => (
                            <li key={`pp_${i}`} className="flex gap-2">
                              <span className="shrink-0 font-bold" aria-hidden="true">
                                {bullet}
                              </span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm font-semibold">Missing details</div>
                      )}
                    </div>
                    <div className="rounded-lg border p-4" style={{ borderColor: colors.border, background: colors.card }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2">
                        Core strengths
                      </div>
                      {draft.fit_points?.length ? (
                        <ul className="text-sm space-y-1">
                          {draft.fit_points.slice(0, 6).map((p, i) => (
                            <li key={`fp_${i}`} className="flex gap-2">
                              <span className="shrink-0 font-bold" aria-hidden="true">
                                {bullet}
                              </span>
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm font-semibold">Missing details</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                      Resume snapshot (from parsed resume)
                    </div>
                    {!resumeSnapshot ? (
                      <div className="text-sm text-white/70">
                        No resume data found yet. Go to{" "}
                        <a href="/resume" className="underline text-white/80 hover:text-white">
                          Resume
                        </a>{" "}
                        and upload a file to populate this section.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-[11px] text-white/50">
                          Source: <span className="text-white/70 font-mono">resume_extract</span>
                          {safeStr(resumeMeta?.filename) ? (
                            <span className="text-white/50"> • {safeStr(resumeMeta.filename)}</span>
                          ) : null}
                          {safeStr(resumeMeta?.updated_at) ? (
                            <span className="text-white/50"> • updated {safeStr(resumeMeta.updated_at)}</span>
                          ) : null}
                        </div>

                        {/* Experience */}
                        <div>
                          <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Experience</div>
                          {asArr((resumeSnapshot as any)?.positions).length ? (
                            <div className="space-y-2">
                              {asArr((resumeSnapshot as any)?.positions)
                                .slice(0, 3)
                                .map((p: any, i: number) => {
                                  const company = safeStr(p?.company);
                                  const title = safeStr(p?.title);
                                  const startRaw =
                                    p?.startDate ?? p?.start_date ?? p?.start ?? p?.from ?? p?.startYear ?? p?.start_year;
                                  const endRaw = p?.endDate ?? p?.end_date ?? p?.end ?? p?.to ?? p?.endYear ?? p?.end_year;
                                  const start = formatDateLike(startRaw);
                                  const end = formatDateLike(endRaw);
                                  const current =
                                    p?.current === true || String(p?.current || "").trim().toLowerCase() === "true";

                                  const range =
                                    start && (current || end)
                                      ? `${start} — ${current ? "Present" : end}`
                                      : start || (current ? "Present" : end);
                                  const dates = range || "Dates not listed";
                                  return (
                                    <div key={`pos_${i}`} className="rounded-md border border-white/10 bg-black/20 p-3">
                                      <div className="text-sm text-white/85 font-semibold">
                                        {company || "Company"}{title ? <span className="text-white/60"> • {title}</span> : null}
                                      </div>
                                      <div className="mt-1 text-xs text-white/55">{dates}</div>
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <div className="text-sm text-white/60">No positions extracted.</div>
                          )}
                        </div>

                        {/* Skills */}
                        <div>
                          <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Skills</div>
                          {asArr((resumeSnapshot as any)?.skills).length ? (
                            <div className="flex flex-wrap gap-2">
                              {asArr((resumeSnapshot as any)?.skills)
                                .slice(0, 14)
                                .map((s: any, i: number) => (
                                  <span
                                    key={`sk_${i}`}
                                    className="px-2.5 py-1 rounded-full border border-white/10 bg-black/20 text-xs text-white/75"
                                  >
                                    {safeStr(s) || "Skill"}
                                  </span>
                                ))}
                            </div>
                          ) : (
                            <div className="text-sm text-white/60">No skills extracted.</div>
                          )}
                        </div>

                        {/* Highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Key metrics</div>
                            {asArr((resumeSnapshot as any)?.keyMetrics).length ? (
                              <ul className="text-sm text-white/75 list-disc list-inside space-y-1">
                                {asArr((resumeSnapshot as any)?.keyMetrics)
                                  .slice(0, 4)
                                  .map((m: any, i: number) => (
                                    <li key={`km_${i}`}>
                                      {safeStr(m?.metric) || "Metric"}{safeStr(m?.value) ? `: ${safeStr(m.value)}` : ""}
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <div className="text-sm text-white/60">No metrics extracted.</div>
                            )}
                          </div>
                          <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Accomplishments</div>
                            {asArr((resumeSnapshot as any)?.accomplishments).length ? (
                              <ul className="text-sm text-white/75 list-disc list-inside space-y-1">
                                {asArr((resumeSnapshot as any)?.accomplishments)
                                  .slice(0, 4)
                                  .map((t: any, i: number) => (
                                    <li key={`acc_${i}`}>{safeStr(t) || "Accomplishment"}</li>
                                  ))}
                              </ul>
                            ) : (
                              <div className="text-sm text-white/60">No accomplishments extracted.</div>
                            )}
                          </div>
                        </div>

                        {/* Education */}
                        <div>
                          <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Education</div>
                          {asArr((resumeSnapshot as any)?.education).length ? (
                            <ul className="text-sm text-white/75 list-disc list-inside space-y-1">
                              {asArr((resumeSnapshot as any)?.education)
                                .slice(0, 2)
                                .map((e: any, i: number) => {
                                  const school = safeStr(e?.school);
                                  const degree = safeStr(e?.degree);
                                  const field = safeStr(e?.field);
                                  const years = [safeStr(e?.startYear || e?.start_year), safeStr(e?.endYear || e?.end_year)]
                                    .filter(Boolean)
                                    .join("–");
                                  const line = [school, [degree, field].filter(Boolean).join(" • "), years].filter(Boolean).join(" — ");
                                  return <li key={`edu_${i}`}>{line || "Education"}</li>;
                                })}
                            </ul>
                          ) : (
                            <div className="text-sm text-white/60">No education extracted.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href="/deliverability-launch"
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
          >
            Continue to Deliverability + Launch →
          </Link>
        </div>
      </div>
    </div>
  );
}

