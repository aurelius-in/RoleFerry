export default function Foundry() {
  const steps = ["IJP", "Jobs", "Candidate", "Match", "Contacts", "Verify", "Outreach", "Sequence"];
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Foundry</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((s) => (
          <a key={s} href={`/foundry/${s.toLowerCase()}`} className="rounded-lg p-4 bg-white/5 hover:bg-white/10 border border-white/10">
            {s}
          </a>
        ))}
      </div>
    </main>
  );
}

