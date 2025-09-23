type Props = { params: { step: string } };

export default function FoundryStep({ params }: Props) {
  const title = params.step.charAt(0).toUpperCase() + params.step.slice(1);
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="rounded-lg p-4 bg-white/5 border border-white/10">
        Coming soon.
      </div>
    </main>
  );
}

