export default function Tools() {
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Tools</h1>
      <ul className="list-disc list-inside space-y-1">
        <li><a className="underline" href="/replies">Reply Classifier</a></li>
        <li><a className="underline" href="/warm-angles">Warm Angles</a></li>
        <li><a className="underline" href="/onepager">One-pager Generator</a></li>
        <li><a className="underline" href="/deliverability">Deliverability</a></li>
        <li><a className="underline" href="/compliance">Compliance</a></li>
      </ul>
    </main>
  );
}

