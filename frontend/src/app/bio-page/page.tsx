"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import placeholderPat from "@/profile-pat.png";

type BioPageTheme = {
  accent: string;
};

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
  theme: BioPageTheme;
};

const DRAFT_KEY = "bio_page_draft";
const PUBLISHED_KEY = "bio_page_published";
const BIO_URL_KEY = "bio_page_url";
const PROFILE_IMAGE_KEY = "bio_page_profile_image_url";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export default function BioPageStep() {
  const profileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<BioPageDraft | null>(null);
  const [busy, setBusy] = useState<"generate" | "publish" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resumeExtract, setResumeExtract] = useState<any>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [painpointMatches, setPainpointMatches] = useState<any>(null);
  const [offerDraft, setOfferDraft] = useState<any>(null);
  const [bioUrl, setBioUrl] = useState<string>("");
  const [profileImageUrl, setProfileImageUrl] = useState<string>("");

  useEffect(() => {
    // Load cached draft if available for quick UX
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    // Load dependencies from localStorage (client-only)
    try {
      const rawResume = localStorage.getItem("resume_extract");
      setResumeExtract(rawResume ? JSON.parse(rawResume) : null);
    } catch {
      setResumeExtract(null);
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
  }, []);

  const onPickProfilePhoto = () => {
    profileInputRef.current?.click();
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
        const merged = { ...res.draft, profile_image_url: profileImageUrl || res.draft.profile_image_url || "" };
        setDraft(merged);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(merged));
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
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
                <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-6">
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
                      className="group rounded-full border border-white/10 bg-white/5 p-1 hover:bg-white/10 transition-colors"
                      aria-label="Upload profile picture"
                      title="Upload profile picture"
                    >
                      <img
                        src={profileImageUrl || (placeholderPat as any).src || placeholderPat}
                        alt="Profile picture"
                        className="h-24 w-24 rounded-full object-cover"
                      />
                    </button>
                    <div className="mt-2 text-xs text-white/50">upload your own profile picture.</div>
                  </div>

                  <div className="text-xs text-white/50 mb-2">CTA</div>
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                      Setup an interview with <span className="font-semibold">{draft.display_name || "you"}</span>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
                      Let’s connect on LinkedIn
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-2xl font-extrabold">{draft.headline || "Your headline"}</div>
                    <div className="text-white/70 mt-2">{draft.subheadline || "Your subheadline"}</div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                        Proof
                      </div>
                      {draft.proof_points?.length ? (
                        <ul className="text-sm text-white/80 list-disc list-inside space-y-1">
                          {draft.proof_points.slice(0, 6).map((p, i) => (
                            <li key={`pp_${i}`}>{p}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-red-300 font-semibold">Missing details</div>
                      )}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                        Fit for this role
                      </div>
                      {draft.fit_points?.length ? (
                        <ul className="text-sm text-white/80 list-disc list-inside space-y-1">
                          {draft.fit_points.slice(0, 6).map((p, i) => (
                            <li key={`fp_${i}`}>{p}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-red-300 font-semibold">Missing details</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                      Resume snapshot (from parsed resume)
                    </div>
                    <div className="text-sm text-white/70">
                      This section will render from your Resume step data on the public page.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href="/compose"
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
          >
            Continue to Compose →
          </Link>
        </div>
      </div>
    </div>
  );
}

