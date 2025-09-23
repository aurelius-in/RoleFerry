export default function Onboarding() {
  const steps = [
    { label: "Set ENV keys (APIFY, INSTANTLY, MV)", href: "/settings" },
    { label: "Create IJP filters", href: "/foundry/ijp" },
    { label: "Ingest jobs", href: "/foundry/jobs" },
    { label: "Parse candidate", href: "/foundry/candidate" },
    { label: "Score matches", href: "/foundry/match" },
    { label: "Find and verify contacts", href: "/foundry/contacts" },
    { label: "Generate outreach", href: "/foundry/outreach" },
    { label: "Build & push sequence", href: "/foundry/sequence" },
    { label: "Track analytics", href: "/analytics" },
  ];
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Onboarding</h1>
      <ol className="space-y-2 list-decimal list-inside">
        {steps.map((s) => (
          <li key={s.label}>
            <a className="underline" href={s.href}>{s.label}</a>
          </li>
        ))}
      </ol>
    </main>
  );
}

