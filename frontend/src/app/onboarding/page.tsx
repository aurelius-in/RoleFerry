export default function Onboarding() {
  const steps = [
    { label: "Set ENV keys (APIFY, INSTANTLY, MV)", href: "/settings" },
    { label: "Import job descriptions", href: "/job-descriptions" },
    { label: "Upload resume / candidate profile", href: "/resume" },
    { label: "Match pain points", href: "/painpoint-match" },
    { label: "Company research", href: "/company-research" },
    { label: "Find contacts (Email or LinkedIn)", href: "/find-contact" },
    { label: "Bio page (shareable link)", href: "/bio-page" },
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

