"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";

export default function OutreachPage() {
  const { setState } = useFoundry();
  const [mode, setMode] = useState("email");
  const [length, setLength] = useState("short");
  const [vars, setVars] = useState({ FirstName: "Alex", Company: "Acme", RoleTitle: "Director of Product", CalendlyURL: "https://calendly.com/you/15" });
  const [variants, setVariants] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [abHint, setAbHint] = useState<boolean>(true);

  const generate = async () => {
    const res = await api<{ variants: any[] }>("/outreach/generate", "POST", { mode, length, variables: vars });
    setVariants(res.variants);
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Outreach</h1>
      <div className="flex gap-2">
        <select className="px-3 py-2 rounded bg-white/5 border border-white/10" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
          <option value="intro-via-mutual">Intro-via-Mutual</option>
        </select>
        <select className="px-3 py-2 rounded bg-white/5 border border-white/10" value={length} onChange={(e) => setLength(e.target.value)}>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
        <button onClick={generate} className="px-4 py-2 rounded brand-gradient text-black font-medium">Generate</button>
      </div>
      <div className="rounded-lg border border-white/10 divide-y divide-white/10">
        {variants.map((v, i) => (
          <div key={i} className={`p-3 space-y-2 ${selected === i ? 'bg-white/[.08]' : ''}`} onClick={() => setSelected(i)}>
            <div className="text-sm opacity-80">Variant {v.variant}</div>
            {v.subject ? <div className="font-medium">{v.subject}</div> : null}
            <pre className="whitespace-pre-wrap text-sm opacity-90">{v.body}</pre>
            <button
              onClick={() => navigator.clipboard.writeText(`${v.subject ? v.subject + "\n\n" : ""}${v.body}`)}
              className="px-3 py-1 rounded bg-white/10 border border-white/10 text-sm"
            >
              Copy
            </button>
          </div>
        ))}
      </div>
      {abHint ? (
        <div className="text-xs opacity-70">Tip: Try A/B with subject tweaks to lift opens.</div>
      ) : null}
      {selected !== null ? (
        <div className="text-sm opacity-80">Calendly line: {vars.CalendlyURL}</div>
      ) : null}
      <div>
        <button
          disabled={selected === null}
          onClick={() => {
            if (selected === null) return;
            const v = variants[selected];
            setState({ seqSubject: v.subject || "", seqMessage: v.body || "", selectedVariantTag: v.variant || "" });
            alert("Saved to Sequence fields");
          }}
          className="px-4 py-2 rounded bg-white/10 border border-white/10 disabled:opacity-50"
        >
          Use selected in Sequence
        </button>
      </div>
    </main>
  );
}

