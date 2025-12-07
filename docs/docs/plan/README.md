## RoleFerry Backend Planning Docs (`docs/plan`)

This folder contains the Week 9–12 backend planning docs for RoleFerry. They outline **what services we need, what they cost, and how to phase them in** while keeping the beta affordable and realistic.

### Documents

- [AI_backend_price_estimates.md](AI_backend_price_estimates.md)  
  High‑level **cost estimates for AI and AI‑adjacent services** (GPT‑4o, Serper, Apify, Findymail, NeverBounce/MillionVerifier, Instantly, Gamma, warmup tools), ordered from cheapest to most expensive at beta scale.

- [AI_for_cursor_to_build.md](AI_for_cursor_to_build.md)  
  Lists **AI‑flavored features we can implement with rules, regex, templates, and prebuilt code** (resume/JD parsing, pain‑point mapping, offers, sequences, spam checks, analytics) so we can demo a “smart” app without paying for per‑request LLMs.

- [non-AI-backend-services.md](non-AI-backend-services.md)  
  Inventories **non‑AI backend services** (Postgres, Redis/queues, storage, email, auth, logging, CSV/Sheets imports, orchestration) and ranks them by **ease, cost, and MVP importance**, with free/low‑cost options first.

- [full_backend_service_report.md](full_backend_service_report.md)  
  A synthesized **Week 9–12 roadmap** that pulls the other three docs together, mapping which services to enable each week, how much they’re likely to cost, and which **screens/endpoints** become truly live as we go.


