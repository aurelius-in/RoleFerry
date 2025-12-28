"use client";
import { useEffect, useState } from "react";

type Health = { status: string; env?: string; version?: string; ts?: string };

export default function HealthIndicator() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delay, setDelay] = useState<number>(5000);

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
          setDelay(5000);
        }
      } catch (e) {
        if (mounted) setError(String(e));
        // Backoff if errors like 429
        setDelay((d) => Math.min(d * 2, 60000));
      } finally {
        timer = setTimeout(poll, delay);
      }
    };
    poll();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [delay]);

  const status = (health?.status || "").toLowerCase();
  // Treat "degraded" as up (API reachable) but not perfect.
  const up = status === "ok" || status === "degraded";
  const label = status === "degraded" ? "API degraded" : up ? "API" : "API down";
  const secondsAgo = health?.ts ? Math.max(0, Math.round((Date.now() - new Date(health.ts).getTime()) / 1000)) : null;
  return (
    <a href="/api/health" target="_blank" className="flex items-center gap-2 text-sm opacity-90">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          up ? (status === "degraded" ? "bg-yellow-400" : "bg-green-400") : "bg-red-400"
        }`}
        aria-label={up ? (status === "degraded" ? "API degraded" : "API healthy") : "API down"}
      />
      <span>{label}</span>
      {health?.env ? <span>· {health.env}</span> : null}
      {health?.version ? <span>· v{health.version}</span> : null}
      {secondsAgo !== null ? <span>· {secondsAgo}s</span> : null}
      {error ? <span className="text-red-300">· error</span> : null}
    </a>
  );
}

