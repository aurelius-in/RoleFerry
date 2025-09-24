type Props = { params: { step: string } };

const steps = ["ijp", "jobs", "candidate", "match", "contacts", "verify", "outreach", "sequence"] as const;

export default function FoundryStep({ params }: Props) {
  const current = params.step.toLowerCase();
  const idx = Math.max(0, steps.indexOf(current as any));
  const title = current.charAt(0).toUpperCase() + current.slice(1);
  const prev = idx > 0 ? steps[idx - 1] : null;
  const next = idx < steps.length - 1 ? steps[idx + 1] : null;
  const pct = Math.round(((idx + 1) / steps.length) * 100);
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="w-full h-2 bg-white/10 rounded">
        <div className="h-2 brand-gradient rounded" style={{ width: `${pct}%` }} />
      </div>
      <div className="rounded-lg p-4 bg-white/5 border border-white/10">
        Coming soon.
      </div>
      <div className="flex items-center justify-between">
        <div>{prev ? <a className="underline" href={`/foundry/${prev}`}>← {prev}</a> : <span />}</div>
        <div>{next ? <a className="underline" href={`/foundry/${next}`}>{next} →</a> : <span />}</div>
      </div>
    </main>
  );
}

