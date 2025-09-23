export default function Deliverability() {
  const items = [
    "SPF record set",
    "DKIM keys configured",
    "DMARC policy published",
    "Mailbox warm-up active",
    "Daily send caps respected",
  ];
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Deliverability Checklist</h1>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i} className="rounded-lg p-3 bg-white/5 border border-white/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

