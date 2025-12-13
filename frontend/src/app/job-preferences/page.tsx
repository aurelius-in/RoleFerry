"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface JobPreferences {
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
}

interface BackendJobPreferences {
  values: string[];
  role_categories: string[];
  location_preferences: string[];
  work_type: string[];
  role_type: string[];
  company_size: string[];
  industries: string[];
  skills: string[];
  minimum_salary: string;
  job_search_status: string;
  state?: string;
  user_mode?: string;
}

interface JobPreferencesResponse {
  success: boolean;
  message: string;
  preferences?: BackendJobPreferences;
}

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
];

const LOCATION_PREFERENCES = ["In-Person", "Hybrid", "Remote"];

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
];

const JOB_SEARCH_STATUS = [
  "Actively looking",
  "Not looking but open to offers",
  "Not looking and closed to offers",
];

const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

export default function JobPreferencesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"job-seeker" | "recruiter">("job-seeker");
  const [preferences, setPreferences] = useState<JobPreferences>({
    values: [],
    roleCategories: [],
    locationPreferences: [],
    workType: [],
    roleType: [],
    companySize: [],
    industries: [],
    skills: [],
    minimumSalary: "",
    jobSearchStatus: "",
    state: "",
  });
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const [skillSearch, setSkillSearch] = useState("");
  const [availableSkills] = useState([
    "Adobe Illustrator",
    "Business Analytics",
    "Excel/Numbers/Sheets",
    "Git",
    "HTML/CSS",
    "Java",
    "MailChimp",
    "MATLAB",
    "Operations Research",
    "Python",
    "SEO",
    "Zendesk",
  ]);

  useEffect(() => {
    const stored = localStorage.getItem("rf_mode");
    if (stored === "recruiter") {
      setMode("recruiter");
    }

    try {
      const cached = localStorage.getItem("job_preferences");
      if (cached) {
        setPreferences(JSON.parse(cached));
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
          const mapped: JobPreferences = {
            values: p.values || [],
            roleCategories: p.role_categories || [],
            locationPreferences: p.location_preferences || [],
            workType: p.work_type || [],
            roleType: p.role_type || [],
            companySize: p.company_size || [],
            industries: p.industries || [],
            skills: p.skills || [],
            minimumSalary: p.minimum_salary || "",
            jobSearchStatus: p.job_search_status || "",
            state: p.state || "",
          };
          setPreferences(mapped);
        }
      } catch {
        // If backend is unavailable, continue with local-only state
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
      return { ...prev, [field]: newValues };
    });
  };

  const handleSingleSelect = (field: keyof JobPreferences, value: string) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    localStorage.setItem("job_preferences", JSON.stringify(preferences));

    try {
      const payload: BackendJobPreferences = {
        values: preferences.values,
        role_categories: preferences.roleCategories,
        location_preferences: preferences.locationPreferences,
        work_type: preferences.workType,
        role_type: preferences.roleType,
        company_size: preferences.companySize,
        industries: preferences.industries,
        skills: preferences.skills,
        minimum_salary: preferences.minimumSalary,
        job_search_status: preferences.jobSearchStatus,
        state: preferences.state,
        user_mode: mode,
      };
      await api<JobPreferencesResponse>(
        "/job-preferences/save",
        "POST",
        payload
      );
      setLastSaved(new Date().toLocaleTimeString());
    } catch {
      // keep UX graceful even if API fails
    }

    router.push("/resume");
  };

  const filteredSkills = availableSkills.filter((skill) =>
    skill.toLowerCase().includes(skillSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">
              {mode === "job-seeker"
                ? "Job Preferences"
                : "Ideal Client Profile (ICP)"}
            </h1>
            <p className="text-white/70">
              {mode === "job-seeker"
                ? "Tell us what you value in a new role and what you're looking for."
                : "Define your ideal client profile for candidate sourcing."}
            </p>
          </div>

          <div className="space-y-8">
            {/* Values */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What do you value in a {" "}
                {mode === "job-seeker" ? "new role" : "client relationship"}?
              </h2>
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
            </div>

            {/* Role Categories */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What kinds of roles are you interested in?
              </h2>
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
            </div>

            {/* Location Preferences */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Where would you like to work?
              </h2>
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

                {preferences.locationPreferences.includes("In-Person") && (
                  <div>
                    <h3 className="text-lg font-medium mb-3">
                      United States - what state?
                    </h3>
                    <select
                      value={preferences.state || ""}
                      onChange={(e) =>
                        handleSingleSelect("state", e.target.value)
                      }
                      className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="">Select a state</option>
                      {US_STATES.map((state) => (
                        <option key={state} value={state}>
                          {state}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Role Type */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What type of roles are you looking for?
              </h2>
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
            </div>

            {/* Company Size */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What is your ideal company size?
              </h2>
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
            </div>

            {/* Industries */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What industries are exciting to you?
              </h2>
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
            </div>

            {/* Skills */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What skills do you have or enjoy working with?
              </h2>
              <p className="text-gray-600 mb-4">
                Heart a skill to indicate that you'd prefer roles that utilize that
                skill!
              </p>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search all skills..."
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {filteredSkills.map((skill) => (
                  <label
                    key={skill}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={preferences.skills.includes(skill)}
                      onChange={() => handleMultiSelect("skills", skill)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm">{skill}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Minimum Salary */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                What is your minimum expected salary?
              </h2>
              <input
                type="text"
                placeholder="e.g., $80,000"
                value={preferences.minimumSalary}
                onChange={(e) => handleSingleSelect("minimumSalary", e.target.value)}
                className="w-full max-w-xs border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            {/* Job Search Status */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Lastly, what's the status of your job search?
              </h2>
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
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <div className="flex items-center space-x-4">
              {lastSaved && (
                <span className="text-sm text-gray-500">
                  Saved just now ({lastSaved})
                </span>
              )}
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
