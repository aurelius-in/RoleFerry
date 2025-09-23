"use client";
import { useEffect, useState } from "react";

type Health = { status: string; env?: string; version?: string };

export default function HealthIndicator() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (mounted) setHealth(j);
      })
      .catch((e) => mounted && setError(String(e)));
    return () => {
      mounted = false;
    };
  }, []);

  const up = health?.status === "ok";
  return (
    <div className="flex items-center gap-2 text-xs opacity-80">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          up ? "bg-green-400" : "bg-red-400"
        }`}
        aria-label={up ? "API healthy" : "API down"}
      />
      <span>{up ? "API" : "API down"}</span>
      {health?.version ? <span>· v{health.version}</span> : null}
      {error ? <span className="text-red-300">· error</span> : null}
    </div>
  );
}

