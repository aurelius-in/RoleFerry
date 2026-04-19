"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import CollapsibleSection from "@/components/CollapsibleSection";

interface JobPreferences {
  values: string[];
  roleCategories: string[];
  locationPreferences: string[];
  locationText?: string;
  workType: string[];
  roleType: string[];
  companySize: string[];
  industries: string[];
  skills: string[];
  minimumSalary: string;
  jobSearchStatus: string;
  state?: string;
  metroAreas?: string[];
}

interface BackendJobPreferences {
  values: string[];
  role_categories: string[];
  location_preferences: string[];
  location_text?: string;
  work_type: string[];
  role_type: string[];
  company_size: string[];
  industries: string[];
  skills: string[];
  minimum_salary: string;
  job_search_status: string;
  state?: string;
  metro_areas?: string[];
  user_mode?: string;
}

interface JobPreferencesResponse {
  success: boolean;
  message: string;
  preferences?: BackendJobPreferences;
  helper?: {
    normalized_skills?: string[];
    suggested_skills?: string[];
    suggested_role_categories?: string[];
    notes?: string[];
  };
}

type JobRecommendation = {
  id: string;
  label: string;
  company: string;
  source: string;
  url: string;
  link_type?: "job_posting" | "job_board_search" | "career_search" | string;
  rationale: string;
  score?: number;
  created_at?: string;
};

type JobRecommendationsResponse = {
  success: boolean;
  message: string;
  recommendations: JobRecommendation[];
};

const VALUES_OPTIONS = [
  "Diversity & inclusion",
  "Impactful work",
  "Independence & autonomy",
  "Innovative product & tech",
  "Mentorship & career development",
  "Progressive leadership",
  "Recognition & reward",
  "Role mobility",
  "Social responsibility & sustainability",
  "Transparency & communication",
  "Work-life balance",
];

const ROLE_CATEGORIES = [
  "Technical & Engineering",
  "Finance & Operations & Strategy",
  "Creative & Design",
  "Education & Training",
  "Legal & Support & Administration",
  "Life Sciences",
  "Sales",
  "Marketing",
  "People Ops & Recruiting",
  "Coaching & Mentorship",
];

const LOCATION_PREFERENCES = ["In-Person", "Hybrid", "Remote (US only)", "Remote (Worldwide)"];

const WORK_TYPE = ["In-Person", "Hybrid", "Remote"];

const ROLE_TYPE = ["Internship", "Full-Time", "Part-Time", "Contract"];

const COMPANY_SIZE = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "501-1,000 employees",
  "1,001-5,000 employees",
  "5,001-10,000 employees",
  "10,001+ employees",
];

const INDUSTRIES = [
  "Aerospace",
  "AI & Machine Learning",
  "Automotive & Transportation",
  "Biotechnology",
  "Consulting",
  "Consumer Goods",
  "Consumer Software",
  "Crypto & Web3",
  "Cybersecurity",
  "Data & Analytics",
  "Defense",
  "Design",
  "Education",
  "Energy",
  "Enterprise Software",
  "Entertainment",
  "Financial Services",
  "Fintech",
  "Food & Agriculture",
  "Gaming",
  "Government & Public Sector",
  "Hardware",
  "Healthcare",
  "Industrial & Manufacturing",
  "Legal",
  "Quantitative Finance",
  "Real Estate",
  "Robotics & Automation",
  "Social Impact",
  "Venture Capital",
  "VR & AR",
  "Agriculture",
  "Restaurant Service",
  "Hospitality",
  "Other",
];

const JOB_SEARCH_STATUS = [
  "Actively looking",
  "Not looking but open to offers",
  "Not looking and closed to offers",
];

const US_METRO_AREAS = [
  "Atlanta, GA",
  "Austin, TX",
  "Baltimore, MD",
  "Birmingham, AL",
  "Boise, ID",
  "Boston, MA",
  "Buffalo, NY",
  "Charlotte, NC",
  "Chicago, IL",
  "Cincinnati, OH",
  "Cleveland, OH",
  "Columbus, OH",
  "Dallas, TX",
  "Denver, CO",
  "Des Moines, IA",
  "Detroit, MI",
  "El Paso, TX",
  "Hartford, CT",
  "Honolulu, HI",
  "Houston, TX",
  "Indianapolis, IN",
  "Jacksonville, FL",
  "Kansas City, MO",
  "Las Vegas, NV",
  "Los Angeles, CA",
  "Louisville, KY",
  "Memphis, TN",
  "Miami, FL",
  "Milwaukee, WI",
  "Minneapolis, MN",
  "Nashville, TN",
  "New Orleans, LA",
  "New York, NY",
  "Oklahoma City, OK",
  "Omaha, NE",
  "Orlando, FL",
  "Philadelphia, PA",
  "Phoenix, AZ",
  "Pittsburgh, PA",
  "Portland, OR",
  "Providence, RI",
  "Raleigh, NC",
  "Richmond, VA",
  "Sacramento, CA",
  "Salt Lake City, UT",
  "San Antonio, TX",
  "San Diego, CA",
  "San Francisco, CA",
  "San Jose, CA",
  "Seattle, WA",
  "St. Louis, MO",
  "Tampa, FL",
  "Tucson, AZ",
  "Virginia Beach, VA",
  "Washington, DC",
];

export default function JobPreferencesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"job-seeker" | "recruiter">("job-seeker");
  const [isSaving, setIsSaving] = useState(false);
  const [preferences, setPreferences] = useState<JobPreferences>({
    values: [],
    roleCategories: [],
    locationPreferences: [],
    locationText: "",
    workType: [],
    roleType: [],
    companySize: [],
    industries: [],
    skills: [],
    minimumSalary: "",
    jobSearchStatus: "",
    state: "",
    metroAreas: [],
  });
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [helper, setHelper] = useState<JobPreferencesResponse["helper"] | null>(null);

  const [skillSearch, setSkillSearch] = useState("");
  const [availableSkills, setAvailableSkills] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("rf_mode");
    if (stored === "recruiter") {
      setMode("recruiter");
    }

    try {
      const cached = localStorage.getItem("job_preferences");
      if (cached) {
        const parsed = JSON.parse(cached);
        const locs = Array.isArray(parsed?.locationPreferences) ? parsed.locationPreferences : [];
        const hasInPerson = locs.includes("In-Person") || locs.includes("Hybrid");
        // Migrate old "Remote" to "Remote (US only)"
        const migratedLocs = locs.map((l: string) => l === "Remote" ? "Remote (US only)" : l);
        setPreferences({
          ...parsed,
          locationPreferences: migratedLocs,
          locationText: String(parsed?.locationText || ""),
          state: hasInPerson ? String(parsed?.state || "") : "",
          metroAreas: Array.isArray(parsed?.metroAreas) ? parsed.metroAreas : [],
        });
      }
    } catch {
      // ignore malformed cache
    }

    (async () => {
      try {
        const resp = await api<JobPreferencesResponse>(
          "/job-preferences/demo-user",
          "GET"
        );
        if (resp.preferences) {
          const p = resp.preferences;
          const locs = Array.isArray(p.location_preferences) ? p.location_preferences : [];
          const hasInPerson = locs.includes("In-Person") || locs.includes("Hybrid");
          const migratedLocs = locs.map((l: string) => l === "Remote" ? "Remote (US only)" : l);
          const mapped: JobPreferences = {
            values: p.values || [],
            roleCategories: p.role_categories || [],
            locationPreferences: migratedLocs,
            locationText: String((p as any)?.location_text || ""),
            workType: p.work_type || [],
            roleType: p.role_type || [],
            companySize: p.company_size || [],
            industries: p.industries || [],
            skills: p.skills || [],
            minimumSalary: p.minimum_salary || "",
            jobSearchStatus: p.job_search_status || "",
            state: hasInPerson ? (p.state || "") : "",
            metroAreas: Array.isArray(p.metro_areas) ? p.metro_areas : [],
          };
          setPreferences(mapped);
        }
      } catch {
        // If backend is unavailable, continue with local-only state
      }
    })();

    (async () => {
      // Load skills from backend so the search UI feels "real" and comprehensive.
      // Fallback to a small seed list if the API isn't reachable.
      try {
        const resp = await api<{ skills: string[] }>("/job-preferences/options/skills", "GET");
        const list = Array.isArray(resp?.skills) ? resp.skills.map((s) => String(s).trim()).filter(Boolean) : [];
        setAvailableSkills(Array.from(new Set(list)));
      } catch {
        setAvailableSkills([
          "Python",
          "JavaScript",
          "TypeScript",
          "SQL",
          "React",
          "Next.js",
          "Product Management",
          "SEO",
          "Sales",
          "Recruiting",
          "Coaching",
          "Mentorship",
        ]);
      }
    })();

    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };

    window.addEventListener("modeChanged", handleModeChange as EventListener);
    return () =>
      window.removeEventListener("modeChanged", handleModeChange as EventListener);
  }, []);

  const handleMultiSelect = (field: keyof JobPreferences, value: string) => {
    setPreferences((prev) => {
      const currentValues = prev[field] as string[];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];

      if (field === "locationPreferences") {
        const hasInPerson = newValues.includes("In-Person") || newValues.includes("Hybrid");
        return {
          ...prev,
          [field]: newValues,
          state: hasInPerson ? (prev.state || "") : "",
          metroAreas: hasInPerson ? (prev.metroAreas || []) : [],
        };
      }

      return { ...prev, [field]: newValues };
    });
  };

  const handleSingleSelect = (field: keyof JobPreferences, value: string) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    localStorage.setItem("job_preferences", JSON.stringify(preferences));

    try {
      const payload: BackendJobPreferences = {
        values: preferences.values,
        role_categories: preferences.roleCategories,
        location_preferences: preferences.locationPreferences,
        location_text: String(preferences.locationText || "").trim() || undefined,
        work_type: preferences.workType,
        role_type: preferences.roleType,
        company_size: preferences.companySize,
        industries: preferences.industries,
        skills: preferences.skills,
        minimum_salary: preferences.minimumSalary,
        job_search_status: preferences.jobSearchStatus,
        state: preferences.state,
        metro_areas: preferences.metroAreas,
        user_mode: mode,
      };
      const res = await api<JobPreferencesResponse>(
        "/job-preferences/save",
        "POST",
        payload
      );
      setLastSaved(new Date().toLocaleTimeString());
      if (res?.helper) {
        setHelper(res.helper);
        localStorage.setItem("job_preferences_helper", JSON.stringify(res.helper));
      }
    } catch {
      // keep UX graceful even if API fails
    }

    router.push("/resume");
  };

  const filteredSkills = availableSkills.filter((skill) =>
    skill.toLowerCase().includes(skillSearch.toLowerCase())
  );
  const visibleSkills = filteredSkills.slice(0, 48);

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-4">
          <a href="/" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Dashboard
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="mt-2 text-center text-3xl font-bold text-white mb-2">Role Preferences</h1>
            <p className="text-center text-white/70">
              Tell us what you value in a new role and we&apos;ll help you define your ideal job profile (IJP).
            </p>
          </div>

          <div className="space-y-1">
            {/* Values */}
            <CollapsibleSection title={`What do you value in a ${mode === "job-seeker" ? "new role" : "client relationship"}?`} count={preferences.values.length}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {VALUES_OPTIONS.map((value) => (
                  <label
                    key={value}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.values.includes(value)}
                      onChange={() => handleMultiSelect("values", value)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{value}</span>
                  </label>
                ))}
              </div>
            </CollapsibleSection>

            {/* Role Categories */}
            <CollapsibleSection title="What kinds of roles are you interested in?" count={preferences.roleCategories.length}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {ROLE_CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.roleCategories.includes(category)}
                      onChange={() =>
                        handleMultiSelect("roleCategories", category)
                      }
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{category}</span>
                  </label>
                ))}
              </div>
            </CollapsibleSection>

            {/* Location Preferences */}
            <CollapsibleSection title="Where would you like to work?" count={preferences.locationPreferences.length}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium mb-3">
                    Work Location Preferences
                  </h3>
                  <div className="flex space-x-4">
                    {LOCATION_PREFERENCES.map((pref) => (
                      <label
                        key={pref}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={preferences.locationPreferences.includes(pref)}
                          onChange={() =>
                            handleMultiSelect("locationPreferences", pref)
                          }
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{pref}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">
                    Preferred location
                    {(preferences.locationPreferences.includes("In-Person") || preferences.locationPreferences.includes("Hybrid"))
                      ? "" : " (optional)"}
                  </h3>
                  <input
                    value={preferences.locationText || ""}
                    onChange={(e) => handleSingleSelect("locationText", e.target.value)}
                    placeholder='Examples: "New York, NY", "US only", "PST time zone", "London / Remote"'
                    className="w-full max-w-xl border border-gray-300 rounded-md px-3 py-2"
                  />
                  <div className="mt-1 text-xs text-white/70">
                    {(preferences.locationPreferences.includes("In-Person") || preferences.locationPreferences.includes("Hybrid"))
                      ? "Required for in-person or hybrid roles."
                      : "Used for gap analysis + personalization. Leave blank if you're fully flexible."}
                  </div>
                </div>

                {(preferences.locationPreferences.includes("In-Person") || preferences.locationPreferences.includes("Hybrid")) && (
                  <div>
                    <h3 className="text-lg font-medium mb-3">
                      Nearest metropolitan area(s)
                    </h3>
                    <p className="text-sm text-white/70 mb-3">
                      Select all metro areas you&apos;d consider working in.
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto rounded-md border border-white/10 bg-black/10 p-3">
                      {US_METRO_AREAS.map((metro) => (
                        <label
                          key={metro}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={(preferences.metroAreas || []).includes(metro)}
                            onChange={() => {
                              setPreferences((prev) => {
                                const current = prev.metroAreas || [];
                                const next = current.includes(metro)
                                  ? current.filter((m) => m !== metro)
                                  : [...current, metro];
                                return { ...prev, metroAreas: next };
                              });
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{metro}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Role Type */}
            <CollapsibleSection title="What type of roles are you looking for?" count={preferences.roleType.length}>
              <div className="flex space-x-4">
                {ROLE_TYPE.map((type) => (
                  <label
                    key={type}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.roleType.includes(type)}
                      onChange={() => handleMultiSelect("roleType", type)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </CollapsibleSection>

            {/* Company Size */}
            <CollapsibleSection title="What is your ideal company size?" count={preferences.companySize.length}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {COMPANY_SIZE.map((size) => (
                  <label
                    key={size}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.companySize.includes(size)}
                      onChange={() => handleMultiSelect("companySize", size)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{size}</span>
                  </label>
                ))}
              </div>
            </CollapsibleSection>

            {/* Industries */}
            <CollapsibleSection title="What industries are exciting to you?" count={preferences.industries.length}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {INDUSTRIES.map((industry) => (
                  <label
                    key={industry}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.industries.includes(industry)}
                      onChange={() => handleMultiSelect("industries", industry)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{industry}</span>
                  </label>
                ))}
              </div>
            </CollapsibleSection>

            {/* Minimum Salary */}
            <CollapsibleSection title="What is your minimum expected salary?">
              <input
                type="text"
                placeholder="e.g., $80,000"
                value={preferences.minimumSalary}
                onChange={(e) => handleSingleSelect("minimumSalary", e.target.value)}
                className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2"
              />
            </CollapsibleSection>

            {/* Role Search Status */}
            <CollapsibleSection title="What's the status of your role search?">
              <div className="space-y-2">
                {JOB_SEARCH_STATUS.map((status) => (
                  <label
                    key={status}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="jobSearchStatus"
                      value={status}
                      checked={preferences.jobSearchStatus === status}
                      onChange={(e) =>
                        handleSingleSelect("jobSearchStatus", e.target.value)
                      }
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{status}</span>
                  </label>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          {helper && (
            <div className="mt-8 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-bold text-white mb-2">Smart Helper: preference suggestions</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-white/70 font-semibold mb-1">Normalized skills</div>
                  <div className="flex flex-wrap gap-2">
                    {(helper.normalized_skills || []).slice(0, 12).map((s) => (
                      <span key={s} className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-white/70 font-semibold mb-1">Suggested skills</div>
                  <div className="flex flex-wrap gap-2">
                    {(helper.suggested_skills || []).slice(0, 10).map((s) => (
                      <span key={s} className="px-2 py-1 rounded-full border border-white/10 bg-blue-50 text-blue-200 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {(helper.notes || []).length > 0 && (
                <ul className="mt-3 list-disc list-inside text-white/70 text-sm space-y-1">
                  {(helper.notes || []).slice(0, 4).map((n, i) => (
                    <li key={`n_${i}`}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <div className="flex items-center space-x-4">
              {lastSaved && (
                <span className="text-sm text-gray-500">
                  Saved just now ({lastSaved})
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`px-6 py-3 rounded-md font-medium transition-colors inline-flex items-center gap-2 ${
                  isSaving
                    ? "bg-blue-700 text-white/90 cursor-not-allowed shadow-inner"
                    : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 active:translate-y-[1px]"
                }`}
              >
                {isSaving ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    />
                    <span>Saving…</span>
                  </>
                ) : (
                  "Save & Continue"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
