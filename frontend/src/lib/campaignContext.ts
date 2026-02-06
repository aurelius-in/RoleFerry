export type RFCampaignContextV1 = {
  version: 1;
  updated_at: string;
  sender_profile: {
    full_name?: string;
    phone?: string;
    linkedin_url?: string;
    email?: string;
  };
  contact_id: string;
  contact?: any;
  company_name?: string;
  job_preferences?: any;
  resume_extract?: any;
  personality_profile?: any;
  temperament_profile?: any;
  offer?: any;
  selected_job_description?: any;
  selected_job_description_id?: string;
  gap_analysis?: any;
  painpoint_matches?: any;
  company_research?: any;
  contact_research?: any;
  links?: {
    bio_page_url?: string;
    work_link?: string;
    portfolio_url?: string;
    linkedin_url?: string;
  };
};

const STORAGE_BY_CONTACT = "rf_campaign_context_v1_by_contact";

function nowIso() {
  return new Date().toISOString();
}

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function senderProfileFromLs() {
  const sender = safeJson<any>(lsGet("rf_user"), null);
  const full =
    String(sender?.full_name || "").trim() ||
    `${String(sender?.first_name || "").trim()} ${String(sender?.last_name || "").trim()}`.trim();
  return {
    full_name: full,
    phone: String(sender?.phone || "").trim(),
    linkedin_url: String(sender?.linkedin_url || "").trim(),
    email: String(sender?.email || "").trim(),
  };
}

export function buildCampaignContextV1(contactId: string): RFCampaignContextV1 {
  const cid = String(contactId || "").trim();

  const prefs = safeJson<any>(lsGet("job_preferences"), null) || safeJson<any>(lsGet("jobPreferences"), null);
  const resumeExtract = safeJson<any>(lsGet("resume_extract"), null);
  const personalityProfile = safeJson<any>(lsGet("personality_profile"), null);
  const temperamentProfile = safeJson<any>(lsGet("temperament_profile"), null);
  const offer = safeJson<any>(lsGet("rf_offer_v1"), null);
  const selectedJob = safeJson<any>(lsGet("selected_job_description"), null);
  const selectedJobId = String(lsGet("selected_job_description_id") || "").trim();

  const painpointByJob = safeJson<Record<string, any[]>>(lsGet("painpoint_matches_by_job"), {});
  const painpointMatches =
    selectedJobId && painpointByJob?.[selectedJobId]
      ? painpointByJob[selectedJobId]
      : safeJson<any[]>(lsGet("painpoint_matches"), []);

  const gapResultsByJob = safeJson<any>(lsGet("gap_analysis_results_by_job"), null);
  const gapResults = gapResultsByJob && selectedJobId ? gapResultsByJob[selectedJobId] : safeJson<any>(lsGet("gap_analysis_results"), null);

  const selectedContacts = safeJson<any[]>(lsGet("selected_contacts"), []);
  const c = selectedContacts.find((x: any) => String(x?.id || "") === cid) || null;

  const companyName =
    String(lsGet("selected_company_name") || "").trim() ||
    String(selectedJob?.company || "").trim() ||
    String(c?.company || "").trim();

  const companyResearchByCompany = safeJson<Record<string, any>>(lsGet("rf_company_research_by_company"), {});
  const companyResearch =
    (companyName && companyResearchByCompany && companyResearchByCompany[companyName]) || safeJson<any>(lsGet("company_research"), null);

  const contactResearchByContact = safeJson<Record<string, any>>(lsGet("context_research_by_contact"), {});
  const contactResearch = cid && contactResearchByContact ? contactResearchByContact[cid] : null;

  const bioPageUrl = String(lsGet("bio_page_url") || "").trim();

  const links = {
    bio_page_url: bioPageUrl,
    work_link: String(lsGet("work_link") || "").trim(),
    portfolio_url: String(lsGet("portfolio_url") || "").trim(),
    linkedin_url: String(c?.linkedin_url || "").trim() || String(c?.linkedin || "").trim(),
  };

  return {
    version: 1,
    updated_at: nowIso(),
    sender_profile: senderProfileFromLs(),
    contact_id: cid,
    contact: c,
    company_name: companyName,
    job_preferences: prefs,
    resume_extract: resumeExtract,
    personality_profile: personalityProfile,
    temperament_profile: temperamentProfile,
    offer,
    selected_job_description: selectedJob,
    selected_job_description_id: selectedJobId,
    gap_analysis: gapResults,
    painpoint_matches: painpointMatches,
    company_research: companyResearch,
    contact_research: contactResearch,
    links,
  };
}

export function readCampaignContextV1(contactId: string): RFCampaignContextV1 {
  const cid = String(contactId || "").trim();
  const by = safeJson<Record<string, RFCampaignContextV1>>(lsGet(STORAGE_BY_CONTACT), {});
  const hit = by && typeof by === "object" ? (by[cid] as any) : null;
  if (hit && hit.version === 1) return hit as RFCampaignContextV1;
  return buildCampaignContextV1(cid);
}

export function persistCampaignContextV1(contactId: string): RFCampaignContextV1 {
  const cid = String(contactId || "").trim();
  const nextCtx = buildCampaignContextV1(cid);
  const by = safeJson<Record<string, RFCampaignContextV1>>(lsGet(STORAGE_BY_CONTACT), {});
  const next = { ...(by || {}), [cid]: nextCtx };
  lsSet(STORAGE_BY_CONTACT, JSON.stringify(next));
  return nextCtx;
}

