export type TableData = { title: string; columns: string[]; rows: Record<string, unknown>[] };

export type DataKey =
  | "messages"
  | "sequence"
  | "campaigns"
  | "onepager"
  | "warmAngles"
  | "audit"
  | "onboarding"
  | "deliverability"
  | "compliance"
  | "ijps"
  | "jobs"
  | "candidates"
  | "contacts"
  | "matches"
  | "offers";

export function getMockTable(key: DataKey): TableData {
  switch (key) {
    case "messages":
      return {
        title: "Messages",
        columns: ["id", "contact", "variant", "subject", "opened", "replied"],
        rows: [
          { id: "m_101", contact: "alex@acme.com", variant: "A", subject: "Quick intro on Product", opened: true, replied: false },
          { id: "m_102", contact: "jordan@globex.com", variant: "B", subject: "Idea on onboarding", opened: true, replied: true },
          { id: "m_103", contact: "sam@initech.com", variant: "A", subject: "Activation nudge", opened: false, replied: false },
        ],
      };
    case "sequence":
      return {
        title: "Sequence Rows",
        columns: ["email", "first_name", "last_name", "company", "title", "match_score", "verification_status"],
        rows: [
          { email: "alex@acme.com", first_name: "Alex", last_name: "Kim", company: "Acme", title: "Director of Product", match_score: 87, verification_status: "valid" },
          { email: "taylor@initech.com", first_name: "Taylor", last_name: "Wu", company: "Initech", title: "Recruiter", match_score: 74, verification_status: "accept_all" },
          { email: "morgan@globex.com", first_name: "Morgan", last_name: "Lee", company: "Globex", title: "VP Marketing", match_score: 81, verification_status: "invalid" },
        ],
      };
    case "campaigns":
      return {
        title: "Campaigns",
        columns: ["name", "delivered", "open_rate", "reply_rate", "positive"],
        rows: [
          { name: "April Launch", delivered: 1200, open_rate: 48, reply_rate: 12, positive: 4.1 },
          { name: "PM Hiring", delivered: 640, open_rate: 55, reply_rate: 15, positive: 6.4 },
        ],
      };
    case "onepager":
      return { title: "One‑pagers", columns: ["id", "owner", "type", "title", "url"], rows: [{ id: "op_1", owner: "Candidate#12", type: "deck", title: "Product Growth Wins", url: "https://example.com/op1" }] };
    case "warmAngles":
      return { title: "Warm Angles", columns: ["contact", "type", "note"], rows: [{ contact: "alex@acme.com", type: "mutual", note: "Both follow Same Podcast" }, { contact: "jordan@globex.com", type: "alma_mater", note: "Stanford 2016" }] };
    case "audit":
      return { title: "Audit Log", columns: ["id", "action", "timestamp"], rows: [{ id: 1, action: "verify_batch", timestamp: "2025-09-22T10:15:00Z" }] };
    case "onboarding":
      return { title: "Onboarding", columns: ["step", "status"], rows: [{ step: "Connect Instantly", status: "done" }, { step: "Add Calendly", status: "pending" }] };
    case "deliverability":
      return { title: "Deliverability", columns: ["mailbox", "spf", "dkim", "dmarc"], rows: [{ mailbox: "outreach@roleferry.com", spf: true, dkim: true, dmarc: "p=none" }] };
    case "compliance":
      return { title: "Compliance", columns: ["region", "opt_outs", "dnc"], rows: [{ region: "US", opt_outs: 3, dnc: 1 }] };
    case "ijps":
      return { title: "IJP Filters", columns: ["id", "titles", "levels", "locations", "skills_must"], rows: [{ id: "ijp_1", titles: "PM, Sr PM", levels: "Senior", locations: "SF, Remote", skills_must: "PLG, SQL" }] };
    case "jobs":
      return { title: "Roles", columns: ["id", "title", "company", "location", "role_url"], rows: [{ id: "role_101", title: "Senior PM", company: "Acme", location: "SF", role_url: "https://indeed.com/abc" }] };
    case "candidates":
      return { title: "Candidates", columns: ["id", "name", "email", "seniority", "domains"], rows: [{ id: "cand_1", name: "Alex Kim", email: "alex@example.com", seniority: "Senior", domains: "PLG, SaaS" }] };
    case "contacts":
      return { title: "Contacts", columns: ["id", "company", "name", "title", "email", "verification_status"], rows: [{ id: "ct_1", company: "Acme", name: "Jordan Blake", title: "VP Product", email: "jordan@acme.com", verification_status: "valid" }] };
    case "matches":
      return { title: "Matches", columns: ["candidate", "role", "score", "reasons"], rows: [{ candidate: "Alex Kim", role: "Senior PM @ Acme", score: 87, reasons: "PLG + enterprise rollout" }] };
    case "offers":
      return { title: "Offers", columns: ["id", "candidate", "portfolio_url", "deck_url"], rows: [{ id: "off_1", candidate: "Alex Kim", portfolio_url: "https://portfolio.example.com/alex", deck_url: "https://docs.example.com/deck" }] };
  }
}


