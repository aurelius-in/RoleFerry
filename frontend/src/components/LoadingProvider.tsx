"use client";
import { createContext, useContext, useMemo, useRef, useState, ReactNode } from "react";

type LoadingContextValue = {
  begin: () => void;
  end: () => void;
};

const LoadingCtx = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const counterRef = useRef(0);
  const [, force] = useState(0);
  const begin = () => {
    counterRef.current += 1;
    force((x) => x + 1);
  };
  const end = () => {
    counterRef.current = Math.max(0, counterRef.current - 1);
    force((x) => x + 1);
  };
  const value = useMemo(() => ({ begin, end }), []);
  const isLoading = counterRef.current > 0;
  return (
    <LoadingCtx.Provider value={value}>
      {children}
      {isLoading ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <img src="/ani-sm.gif" alt="Loading" className="opacity-80 w-24 h-24" />
        </div>
      ) : null}
    </LoadingCtx.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingCtx);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}

