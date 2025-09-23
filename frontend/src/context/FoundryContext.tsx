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
  const [state, set] = useState<FoundryState>({ sendableOnly: true });
  const setState = (next: Partial<FoundryState>) => set((prev) => ({ ...prev, ...next }));
  return <FoundryCtx.Provider value={{ state, setState }}>{children}</FoundryCtx.Provider>;
}

export function useFoundry() {
  return useContext(FoundryCtx);
}

