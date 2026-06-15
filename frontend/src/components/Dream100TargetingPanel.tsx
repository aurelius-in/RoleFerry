"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import InlineSpinner from "@/components/InlineSpinner";
import { getActiveRoute } from "@/lib/workflowRoutes";

export type IdealCompanyCriteria = {
  headcount: string;
  growth_signals: string[];
  funding_stage: string;
  tech_stack_clues: string[];
  content_activity: string;
  summary: string;
};

export type ActiveNeedSignal = { signal: string; why_it_matters: string };
export type RedFlag = { flag: string; disqualify_reason: string };
export type ChannelPlaybookItem = {
  channel: string;
  how_to: string[];
  example_search?: string;
  url?: string;
};
export type ScoringFactor = { factor: string; weight: string; score_guide: string };
export type SampleTarget = {
  company_type: string;
  team_structure: string;
  why_fit: string;
  where_to_find_contact: string;
  hook_angle: string;
  example_score: number;
};

export type Dream100Targeting = {
  generated_at?: string;
  ideal_company: IdealCompanyCriteria;
  active_need_signals: ActiveNeedSignal[];
  red_flags: RedFlag[];
  channel_playbook: ChannelPlaybookItem[];
  scoring_rubric: {
    overview: string;
    factors: ScoringFactor[];
    how_to_use: string;
  };
  sample_targets: SampleTarget[];
};

type Props = {
  preferences: {
    values: string[];
    roleCategories: string[];
    locationPreferences: string[];
    workType: string[];
    roleType: string[];
    companySize: string[];
    industries: string[];
    skills: string[];
    minimumSalary: string;
    jobSearchStatus: string;
    state?: string;
    metroAreas?: string[];
    locationText?: string;
  };
  dream100?: {
    positioningLevel: string;
  };
  targeting: Dream100Targeting | null;
  onTargetingChange: (t: Dream100Targeting) => void;
};

function scoreColor(score: number) {
  if (score >= 8) return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
  if (score >= 5) return "text-yellow-300 border-yellow-500/30 bg-yellow-500/10";
  return "text-red-300 border-red-500/30 bg-red-500/10";
}

export default function Dream100TargetingPanel({
  preferences,
  dream100,
  targeting,
  onTargetingChange,
}: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTarget, setExpandedTarget] = useState<number | null>(0);

  const canGenerate =
    preferences.roleCategories.length > 0 ||
    preferences.industries.length > 0 ||
    preferences.skills.length > 0;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      let resumeExtract: unknown = null;
      try {
        resumeExtract = JSON.parse(localStorage.getItem("resume_extract") || "null");
      } catch {}

      const res = await api<{
        success: boolean;
        targeting: Dream100Targeting;
        used_llm?: boolean;
      }>("/job-preferences/dream100-targeting", "POST", {
        preferences: {
          values: preferences.values,
          role_categories: preferences.roleCategories,
          location_preferences: preferences.locationPreferences,
          location_text: preferences.locationText || "",
          work_type: preferences.workType,
          role_type: preferences.roleType,
          company_size: preferences.companySize,
          industries: preferences.industries,
          skills: preferences.skills,
          minimum_salary: preferences.minimumSalary,
          job_search_status: preferences.jobSearchStatus,
          state: preferences.state || "",
          metro_areas: preferences.metroAreas || [],
        },
        dream100: {
          positioning_level: dream100?.positioningLevel || getActiveRoute() || "",
          career_result: localStorage.getItem("rf_career_result") || "",
          free_deliverable: localStorage.getItem("rf_free_deliverable") || "",
        },
        resume_extract: resumeExtract,
      });

      if (res?.targeting) {
        const next = { ...res.targeting, generated_at: new Date().toISOString() };
        onTargetingChange(next);
        try {
          localStorage.setItem("rf_dream100_targeting", JSON.stringify(next));
        } catch {}
      }
    } catch (e: unknown) {
      setError(String((e as Error)?.message || "Failed to generate targeting plan."));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-white/70 flex-1">
          Define who to pursue, where to find them, how to score companies, and get 10 example target types tailored to your background.
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className="shrink-0 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          title={!canGenerate ? "Fill in at least role category, industry, or skills below first" : undefined}
        >
          {isGenerating ? (
            <>
              <InlineSpinner className="h-4 w-4" />
              Generating...
            </>
          ) : targeting ? (
            "Regenerate plan"
          ) : (
            "Generate targeting plan"
          )}
        </button>
      </div>

      {!canGenerate && (
        <p className="text-xs text-amber-300/80 border border-amber-500/20 bg-amber-500/10 rounded px-3 py-2">
          Select at least one role category, industry, or skill in the preference sections above before generating.
        </p>
      )}

      {error && (
        <p className="text-xs text-red-300 border border-red-500/20 bg-red-500/10 rounded px-3 py-2">{error}</p>
      )}

      {!targeting && !isGenerating && (
        <p className="text-sm text-white/40 italic">
          No targeting plan yet. Generate one to see ideal company criteria, channel playbook, scoring rubric, and sample targets.
        </p>
      )}

      {targeting && (
        <div className="space-y-5">
          {/* 1. Ideal company criteria */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">1. Ideal Target Company Profile</div>
            {targeting.ideal_company.summary && (
              <p className="text-sm text-white/80">{targeting.ideal_company.summary}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {targeting.ideal_company.headcount && (
                <div>
                  <span className="text-white/50 uppercase tracking-wider font-semibold">Headcount</span>
                  <p className="text-white/80 mt-0.5">{targeting.ideal_company.headcount}</p>
                </div>
              )}
              {targeting.ideal_company.funding_stage && (
                <div>
                  <span className="text-white/50 uppercase tracking-wider font-semibold">Funding stage</span>
                  <p className="text-white/80 mt-0.5">{targeting.ideal_company.funding_stage}</p>
                </div>
              )}
              {targeting.ideal_company.content_activity && (
                <div className="md:col-span-2">
                  <span className="text-white/50 uppercase tracking-wider font-semibold">Content activity</span>
                  <p className="text-white/80 mt-0.5">{targeting.ideal_company.content_activity}</p>
                </div>
              )}
            </div>
            {targeting.ideal_company.growth_signals?.length > 0 && (
              <div>
                <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold mb-1">Growth signals</div>
                <ul className="space-y-1">
                  {targeting.ideal_company.growth_signals.map((s, i) => (
                    <li key={i} className="text-xs text-white/75 flex gap-2">
                      <span className="text-emerald-400 shrink-0">+</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {targeting.ideal_company.tech_stack_clues?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {targeting.ideal_company.tech_stack_clues.map((t, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/70">{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Active need signals + red flags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
              <div className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Actively in need (pursue)</div>
              {(targeting.active_need_signals || []).map((s, i) => (
                <div key={i} className="text-xs">
                  <div className="text-white/90 font-medium">{s.signal}</div>
                  {s.why_it_matters && <div className="text-white/50 mt-0.5">{s.why_it_matters}</div>}
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 space-y-2">
              <div className="text-xs font-bold text-red-300 uppercase tracking-wider">Red flags (skip immediately)</div>
              {(targeting.red_flags || []).map((r, i) => (
                <div key={i} className="text-xs">
                  <div className="text-white/90 font-medium">{r.flag}</div>
                  {r.disqualify_reason && <div className="text-white/50 mt-0.5">{r.disqualify_reason}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* 2. Channel playbook */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">2. Where to Find Them</div>
            <div className="space-y-3">
              {(targeting.channel_playbook || []).map((ch, i) => (
                <div key={i} className="border border-white/10 rounded-md p-3 bg-white/5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="text-sm font-semibold text-white">{ch.channel}</div>
                    {ch.url && (
                      <a
                        href={ch.url.startsWith("/") ? ch.url : ch.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-blue-300 hover:text-blue-200 underline shrink-0"
                      >
                        Open search
                      </a>
                    )}
                  </div>
                  <ul className="space-y-1 mb-2">
                    {(ch.how_to || []).map((step, j) => (
                      <li key={j} className="text-xs text-white/70 flex gap-2">
                        <span className="text-white/30 shrink-0">{j + 1}.</span>{step}
                      </li>
                    ))}
                  </ul>
                  {ch.example_search && (
                    <div className="text-[10px] font-mono text-white/50 bg-black/30 rounded px-2 py-1 break-all">
                      {ch.example_search}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Scoring rubric */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">3. Company Scoring Rubric (1-10)</div>
            {targeting.scoring_rubric?.overview && (
              <p className="text-sm text-white/75">{targeting.scoring_rubric.overview}</p>
            )}
            <div className="space-y-2">
              {(targeting.scoring_rubric?.factors || []).map((f, i) => (
                <div key={i} className="border border-white/10 rounded-md p-2.5 bg-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">{f.factor}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                      f.weight === "high" ? "border-orange-500/30 text-orange-300 bg-orange-500/10" :
                      f.weight === "low" ? "border-white/20 text-white/40" :
                      "border-white/20 text-white/60"
                    }`}>{f.weight}</span>
                  </div>
                  <p className="text-[11px] text-white/60">{f.score_guide}</p>
                </div>
              ))}
            </div>
            {targeting.scoring_rubric?.how_to_use && (
              <p className="text-xs text-white/50 italic border-t border-white/10 pt-2">{targeting.scoring_rubric.how_to_use}</p>
            )}
          </div>

          {/* 4. Sample targets */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="text-xs font-bold text-blue-300 uppercase tracking-wider">4. Sample Target List (10 archetypes)</div>
            <div className="space-y-2">
              {(targeting.sample_targets || []).map((t, i) => {
                const open = expandedTarget === i;
                return (
                  <div key={i} className="border border-white/10 rounded-md overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedTarget(open ? null : i)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-white/5 hover:bg-white/10 text-left transition-colors"
                    >
                      <span className="text-sm text-white font-medium">{t.company_type}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${scoreColor(t.example_score)}`}>
                        {t.example_score}/10
                      </span>
                    </button>
                    {open && (
                      <div className="px-3 py-2.5 space-y-2 border-t border-white/10 text-xs">
                        {t.team_structure && (
                          <div>
                            <span className="text-white/50 uppercase tracking-wider font-semibold text-[10px]">Team structure</span>
                            <p className="text-white/75 mt-0.5">{t.team_structure}</p>
                          </div>
                        )}
                        {t.why_fit && (
                          <div>
                            <span className="text-white/50 uppercase tracking-wider font-semibold text-[10px]">Why you fit</span>
                            <p className="text-white/75 mt-0.5">{t.why_fit}</p>
                          </div>
                        )}
                        {t.where_to_find_contact && (
                          <div>
                            <span className="text-white/50 uppercase tracking-wider font-semibold text-[10px]">Find contact via</span>
                            <p className="text-white/75 mt-0.5">{t.where_to_find_contact}</p>
                          </div>
                        )}
                        {t.hook_angle && (
                          <div className="rounded border border-blue-500/20 bg-blue-600/10 px-2.5 py-2">
                            <span className="text-blue-300 uppercase tracking-wider font-semibold text-[10px]">Hook angle</span>
                            <p className="text-white/90 mt-0.5 font-medium">{t.hook_angle}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {targeting.generated_at && (
            <p className="text-[10px] text-white/30 text-right">
              Generated {new Date(targeting.generated_at).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
