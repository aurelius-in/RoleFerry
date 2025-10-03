"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<any>({});
  const [mock, setMock] = useState<boolean>(false);
  const [preferred, setPreferred] = useState<string>("neverbounce");
  const [meshEnabled, setMeshEnabled] = useState<boolean>(true);

  useEffect(() => {
    api<any>("/health", "GET").then((h) => {
      setProviders(h.providers || {});
      setMock(Boolean(h.mock_mode));
    });
    api<any>("/settings", "GET").then((s) => {
      if (s.preferred_email_verifier) setPreferred(s.preferred_email_verifier);
      if (typeof s.mesh_clone_enabled === 'boolean') setMeshEnabled(Boolean(s.mesh_clone_enabled));
    });
  }, []);

  const entries = [
    { key: "serper", label: "Serper" },
    { key: "openai", label: "OpenAI" },
    { key: "findymail", label: "Findymail" },
    { key: "neverbounce", label: "NeverBounce" },
    { key: "millionverifier", label: "MillionVerifier" },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Integrations</h1>
      <div className="text-sm">Mock providers active: {mock ? "Yes" : "No"}</div>
      <div className="p-3 rounded border border-white/10 bg-white/5 max-w-md">
        <div className="text-sm mb-2">Preferred Email Verifier</div>
        <div className="flex gap-2 items-center">
          <select className="p-2 rounded bg-white/5 border border-white/10" value={preferred} onChange={(e)=>setPreferred(e.target.value)}>
            <option value="neverbounce">NeverBounce</option>
            <option value="millionverifier">MillionVerifier</option>
          </select>
          <button
            className="px-3 py-2 rounded bg-blue-600"
            onClick={async ()=>{
              await api("/settings", "PUT", { mv_threshold: 0.8, preferred_email_verifier: preferred });
            }}
          >Save</button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => (
          <div key={e.key} className="p-3 rounded border border-white/10 bg-white/5">
            <div className="font-medium">{e.label}</div>
            <div className="text-sm opacity-80">{providers[e.key] ? "Configured" : "Not configured"}</div>
          </div>
        ))}
      </div>
      <div className="text-xs opacity-80">Mesh features enabled: {meshEnabled ? 'Yes' : 'No'}</div>
    </div>
  );
}


