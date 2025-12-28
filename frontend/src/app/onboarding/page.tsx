export default function Onboarding() {
  const steps = [
    { label: "Set ENV keys (APIFY, INSTANTLY, MV)", href: "/settings" },
    { label: "Import job descriptions", href: "/job-descriptions" },
    { label: "Upload resume / candidate profile", href: "/resume" },
    { label: "Match pain points", href: "/painpoint-match" },
    { label: "Find contacts (Email or LinkedIn)", href: "/find-contact" },
    { label: "Company + contact research", href: "/context-research" },
    { label: "Create an offer", href: "/offer-creation" },
    { label: "Compose outreach", href: "/compose" },
    { label: "Build a campaign", href: "/campaign" },
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

