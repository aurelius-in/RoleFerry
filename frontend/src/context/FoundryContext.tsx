"use client";
import { createContext, useContext, useState, ReactNode } from "react";

export type FoundryState = {
  ijp?: any;
  jobs?: any[];
  candidate?: any;
  matches?: any[];
  contacts?: any[];
  sendableOnly?: boolean;
};

const FoundryCtx = createContext<{
  state: FoundryState;
  setState: (next: Partial<FoundryState>) => void;
}>({ state: {}, setState: () => {} });

export function FoundryProvider({ children }: { children: ReactNode }) {
  const [state, set] = useState<FoundryState>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("rf_foundry_state");
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return { sendableOnly: true };
  });
  const setState = (next: Partial<FoundryState>) =>
    set((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem("rf_foundry_state", JSON.stringify(merged));
      } catch {}
      return merged;
    });
  return <FoundryCtx.Provider value={{ state, setState }}>{children}</FoundryCtx.Provider>;
}

export function useFoundry() {
  return useContext(FoundryCtx);
}

