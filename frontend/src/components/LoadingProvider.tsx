"use client";
import { createContext, useContext, useMemo, useRef, useState, ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";

type LoadingContextValue = {
  begin: () => void;
  end: () => void;
};

const LoadingCtx = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const counterRef = useRef(0);
  const startTsRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);
  const begin = () => {
    if (counterRef.current === 0) {
      startTsRef.current = Date.now();
    }
    counterRef.current += 1;
    setTick((x) => x + 1);
  };
  const end = () => {
    const doEnd = () => {
      counterRef.current = Math.max(0, counterRef.current - 1);
      setTick((x) => x + 1);
      if (counterRef.current === 0) {
        startTsRef.current = null;
      }
    };
    const startedAt = startTsRef.current;
    if (counterRef.current <= 0 || startedAt == null) return doEnd();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 1000 - elapsed);
    if (remaining > 0 && counterRef.current === 1) {
      setTimeout(doEnd, remaining);
    } else {
      doEnd();
    }
  };
  const value = useMemo(() => ({ begin, end }), []);
  const isLoading = counterRef.current > 0;
  // Watchdog: ensure spinner never persists beyond ~1.2s after the most recent begin
  useEffect(() => {
    if (!isLoading || startTsRef.current == null) return;
    const elapsed = Date.now() - startTsRef.current;
    const remaining = Math.max(0, 1200 - elapsed);
    const t = setTimeout(() => {
      counterRef.current = 0;
      startTsRef.current = null;
      setTick((x) => x + 1);
    }, remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return (
    <LoadingCtx.Provider value={value}>
      {children}
      {isLoading ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
          <img src="/ani-sm.gif" alt="Loading" className="opacity-70 w-24 h-24 transition-opacity" />
        </div>
      ) : null}
      <RouteTransitionLoader onBegin={begin} onEnd={end} />
    </LoadingCtx.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingCtx);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}

function RouteTransitionLoader({ onBegin, onEnd }: { onBegin: () => void; onEnd: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    // trigger a 1s loader on route change
    onBegin();
    const t = setTimeout(onEnd, 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  // Ensure the spinner never persists longer than 1200ms even if end() is missed
  useEffect(() => {
    const hardStop = setTimeout(onEnd, 1200);
    return () => clearTimeout(hardStop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

