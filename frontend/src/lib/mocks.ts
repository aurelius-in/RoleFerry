// Centralized mock responses used when backend is unavailable.

type MockFn = (body?: any, url?: string, method?: string) => any;

const randomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const companies = [
  "Acme", "Globex", "Initech", "Umbrella", "Soylent", "Hooli", "Vehement", "Massive Dynamic", "Wayne", "Stark",
];
const domains = companies.map((c) => `${c.toLowerCase().replace(/\s/g, '')}.com`);
const firstNames = ["Alex","Jordan","Taylor","Morgan","Riley","Casey","Avery","Quinn","Jamie","Drew","Parker","Cameron","Kendall"]; 
const lastNames = ["Kim","Lee","Patel","Garcia","Nguyen","Chen","Singh","Brown","Davis","Martinez","Lopez","Clark"]; 
const titles = ["CEO","Head of Talent","VP Product","Director of Engineering","Recruiter","CTO","COO","Head of Marketing"]; 

const buildProspects = (n: number) => {
  const rows = [] as any[];
  for (let i = 0; i < n; i++) {
    const company = randomChoice(companies);
    const domain = `${company.toLowerCase().replace(/\s/g, '')}.com`;
    const fn = randomChoice(firstNames);
    const ln = randomChoice(lastNames);
    const title = randomChoice(titles);
    const decision = title.includes("CEO") || title.includes("VP") || title.includes("Head") ? (Math.random() < 0.7 ? "yes" : "maybe") : (Math.random() < 0.2 ? "maybe" : "no");
    const email = decision === "yes" ? `${fn.toLowerCase()}.${ln.toLowerCase()}@${domain}` : "";
    const vStatus = email ? (Math.random() < 0.8 ? "valid" : "accept_all") : (Math.random() < 0.5 ? "unknown" : "invalid");
    const vScore = vStatus === "valid" ? (85 + Math.floor(Math.random() * 14)) : (vStatus === "accept_all" ? (65 + Math.floor(Math.random() * 20)) : "");
    rows.push({
      domain,
      name: `${fn} ${ln}`,
      title,
      linkedin_url: `https://www.linkedin.com/in/${fn.toLowerCase()}-${ln.toLowerCase()}-${company.toLowerCase()}`,
      decision,
      reason: decision === "yes" ? `Likely decision maker for ${title}` : (decision === "maybe" ? "Influencer, verify org fit" : "Not a decision maker"),
      email,
      verification_status: vStatus,
      verification_score: vScore,
      cost_usd: (0.05 + Math.random() * 0.04).toFixed(2),
    });
  }
  return rows;
};

const mocks: Record<string, MockFn> = {
  "GET /health": () => ({ status: "ok", env: "dev", version: "0.1.0" }),
  "GET /health/llm": () => ({
    configured: false,
    mock_mode: true,
    llm_mode: "openai",
    should_use_real_llm: false,
    model: "gpt-4o-mini",
    probe_ok: true,
    probe_preview: "[Stubbed GPT] LLM health probe: respond with a short acknowledgement.",
  }),
  "GET /lead-qual/prospects": () => ({ prospects: buildProspects(12), count: 12 }),
  "GET /prospects": () => ({ prospects: buildProspects(12), count: 12 }),
  "POST /lead-qual/pipeline/run": (_b: any) => ({ ok: true, results: buildProspects(6).map(p=>({ domain: p.domain, top_prospect: { name: p.name, title: p.title, linkedin_url: p.linkedin_url, decision: p.decision, reason: p.reason, email: p.email || null, verification_status: p.verification_status, verification_score: p.verification_score || null, cost_usd: Number(p.cost_usd) } })), summary: { avg_cost_per_qualified: 0.064, steps: { serper:{count:6}, gpt:{count:6}, findymail:{count:4}, neverbounce:{count:4} } } }),
  "GET /costs/compare": () => ({ per_lead: { roleferry: 0.0625, clay: 0.25 }, monthly: { roleferry: 6.25, clay: 355.00 }, sample: 100 }),
  "GET /analytics/campaign": () => ({ campaigns: Array.from({length: 10}).map((_,i)=>({ name:`Campaign ${i+1}`, delivered: 400 + i*50, open_rate: 35 + (i%15), reply_rate: 5 + (i%8), positive: (2 + (i%6) + Math.random()).toFixed(1) })) }),
  "GET /crm/board": () => ({ lanes: { People: Array.from({length: 6}).map((_,i)=>({ id:`p_${i}`, name:`${randomChoice(firstNames)} ${randomChoice(lastNames)}`, title: randomChoice(["Recruiter","Director of Product","Head of Talent"]), company: randomChoice(companies), note: "", assignee: "", due_date: null })), Conversation: [], Meeting: [], Deal: [] } }),
  "GET /messages": () => ({ messages: Array.from({length: 20}).map((_,i)=>({ id:`m_${i+100}`, contact:`${randomChoice(firstNames).toLowerCase()}@${randomChoice(domains)}`, variant: i%2?"B":"A", subject:`Subject ${i+1}`, opened: i%3===0, replied: i%5===0 })) }),
  "POST /painpoint-match/generate": () => ({
    success: true,
    message: "Pain point matches generated successfully",
    matches: [
      {
        painpoint_1: "Need to reduce time-to-fill for engineering roles",
        solution_1: "Cut time-to-fill by streamlining screening, tightening role requirements, and running structured interviews with calibrated scorecards.",
        metric_1: "40% faster (30 → 18 days) with maintained offer-accept rate",
        painpoint_2: "Struggling with candidate quality and cultural fit",
        solution_2: "Improved candidate signal by adding work-sample tasks and structured culture/values interview rounds with consistent rubrics.",
        metric_2: "35% improvement in onsite-to-offer conversion",
        painpoint_3: "High turnover in engineering team affecting project delivery",
        solution_3: "Reduced churn by implementing growth plans, manager 1:1 cadence, and clearer leveling/promotion criteria to boost retention.",
        metric_3: "25% lower turnover over 6 months",
        alignment_score: 0.85,
      },
    ],
  }),
};

export function getMockResponse(path: string, method: string, body?: any): any | undefined {
  const keyExact = `${method.toUpperCase()} ${path.split('?')[0]}`;
  if (mocks[keyExact]) return mocks[keyExact](body, path, method);
  // prefix matches for paths with params
  for (const k of Object.keys(mocks)) {
    const [m, p] = k.split(' ');
    if (m === method.toUpperCase() && path.startsWith(p)) return mocks[k](body, path, method);
  }
  return undefined;
}


