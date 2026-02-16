# Week 15 Follow-Ups

## Role Sourcing Integration (Post-Launch)

Meeting note: explore a post-launch integration that imports fresh role leads from third-party "auto-apply" or role-crawling providers into Role Search.

### Goal
- Reduce manual URL copy/paste for job seekers.
- Keep the `Roles` screen continuously populated with relevant openings.
- Preserve user control: discovery is automated, apply/send actions remain user-driven.

### Proposed Scope
- Add a provider abstraction for external role-feed APIs.
- Support polling on a schedule plus manual refresh.
- Normalize provider payloads into RoleFerry `ScrapedRole` shape.
- Reuse existing salary floor and relevance filters before showing roles.

### Guardrails
- Do not auto-apply on behalf of users.
- Surface source attribution for each discovered role.
- Respect provider terms, rate limits, and user data privacy requirements.

### Suggested Milestones
1. Technical spike on 1-2 candidate providers and API quality.
2. Backend adapter + caching layer behind a feature flag.
3. Roles page UX for imported-feed labels and refresh behavior.
4. Limited beta with telemetry on role volume, relevance, and click-through.
