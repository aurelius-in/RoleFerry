"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function IntegrationsPage() {
  const [providers, setProviders] = useState<any>({});
  const [mock, setMock] = useState<boolean>(false);

  useEffect(() => {
    api<any>("/health", "GET").then((h) => {
      setProviders(h.providers || {});
      setMock(Boolean(h.mock_mode));
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
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((e) => (
          <div key={e.key} className="p-3 rounded border border-white/10 bg-white/5">
            <div className="font-medium">{e.label}</div>
            <div className="text-sm opacity-80">{providers[e.key] ? "Configured" : "Not configured"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


