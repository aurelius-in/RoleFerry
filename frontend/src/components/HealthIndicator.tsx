"use client";
import { useEffect, useState } from "react";

type Health = { status: string; env?: string; version?: string };

export default function HealthIndicator() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: any;
    const poll = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        const j = await r.json();
        if (mounted) {
          setHealth(j);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(String(e));
      } finally {
        timer = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
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
      {health?.env ? <span>· {health.env}</span> : null}
      {health?.version ? <span>· v{health.version}</span> : null}
      {error ? <span className="text-red-300">· error</span> : null}
    </div>
  );
}

