export type Audience = "job-seeker" | "recruiter";

export const AUDIENCE_KEY = "rf_mode";

export function getAudience(): Audience {
  if (typeof window === "undefined") return "job-seeker";
  try {
    return window.localStorage.getItem(AUDIENCE_KEY) === "recruiter" ? "recruiter" : "job-seeker";
  } catch {
    return "job-seeker";
  }
}

export function setAudience(audience: Audience) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIENCE_KEY, audience);
    window.dispatchEvent(new CustomEvent("modeChanged", { detail: audience }));
  } catch {
    // ignore storage failures
  }
}

export function readAudienceFromLocation(): Audience | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("audience");
  if (value === "recruiter" || value === "job-seeker") return value;
  return null;
}
