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

  const up = health?.status === "ok";
  const secondsAgo = health?.ts ? Math.max(0, Math.round((Date.now() - new Date(health.ts).getTime()) / 1000)) : null;
  return (
    <a href="/api/health" target="_blank" className="flex items-center gap-2 text-sm opacity-90">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          up ? "bg-green-400" : "bg-red-400"
        }`}
        aria-label={up ? "API healthy" : "API down"}
      />
      <span>{up ? "API" : "API down"}</span>
      {health?.env ? <span>· {health.env}</span> : null}
      {health?.version ? <span>· v{health.version}</span> : null}
      {secondsAgo !== null ? <span>· {secondsAgo}s</span> : null}
      {error ? <span className="text-red-300">· error</span> : null}
    </a>
  );
}

