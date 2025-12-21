import { test, expect } from "@playwright/test";

const BACKEND_BASE_URL = process.env.E2E_BACKEND_URL || "http://localhost:8000";

async function bootstrapDemo(request: any) {
  const resp = await request.post(`${BACKEND_BASE_URL}/demo/bootstrap`, {
    data: { mode: "job-seeker" },
  });
  expect(resp.ok()).toBeTruthy();
  return await resp.json();
}

test.describe("RoleFerry workflow (Week 10)", () => {
  test("click-through all core workflow screens", async ({ page, request }) => {
    const seeded = await bootstrapDemo(request);

    // Make the frontend have enough local state to flow.
    await page.addInitScript(({ seeded }) => {
      try {
        if (seeded?.job_preferences) localStorage.setItem("job_preferences", JSON.stringify(seeded.job_preferences));
        if (seeded?.job_description_id) localStorage.setItem("selected_job_description_id", String(seeded.job_description_id));
        if (seeded?.painpoint_matches) localStorage.setItem("painpoint_matches", JSON.stringify(seeded.painpoint_matches));
        if (seeded?.selected_contacts) {
          localStorage.setItem("selected_contacts", JSON.stringify(seeded.selected_contacts));
          localStorage.setItem("found_contacts", JSON.stringify(seeded.selected_contacts));
        }
      } catch {
        // ignore
      }
    }, { seeded });

    // 1) Job Preferences
    await page.goto("/job-preferences");
    await expect(page.getByRole("heading", { name: /job preferences/i }).first()).toBeVisible();

    // 2) Resume
    await page.goto("/resume");
    await expect(page.getByRole("heading", { name: "Resume / Candidate Profile", exact: true })).toBeVisible();

    // 3) Job Descriptions
    await page.goto("/job-descriptions");
    await expect(page.getByRole("heading", { name: "Job Descriptions", exact: true })).toBeVisible();

    // 4) Pain Point Match
    await page.goto("/painpoint-match");
    await expect(page.getByRole("heading", { name: "Pain Point Match", exact: true })).toBeVisible();

    // 5) Find Contact
    await page.goto("/find-contact");
    await expect(page.getByRole("heading", { name: "Decision Makers", exact: true })).toBeVisible();

    // 6) Context Research
    await page.goto("/context-research");
    await expect(page.getByRole("heading", { name: "Company Research", exact: true })).toBeVisible();

    // 7) Offer Creation
    await page.goto("/offer-creation");
    await expect(page.getByRole("heading", { name: /offer creation/i }).first()).toBeVisible();

    // 8) Compose
    await page.goto("/compose");
    await expect(page.getByRole("heading", { name: /compose/i }).first()).toBeVisible();

    // 9) Campaign
    await page.goto("/campaign");
    await expect(page.getByRole("heading", { name: "Campaign", exact: true })).toBeVisible();

    // 10) Deliverability Launch
    await page.goto("/deliverability-launch");
    await expect(page.getByRole("heading", { name: /deliverability/i }).first()).toBeVisible();

    // 11) Analytics
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { name: /analytics/i }).first()).toBeVisible();
  });
});
