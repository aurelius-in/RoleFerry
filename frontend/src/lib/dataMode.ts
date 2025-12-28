export type DataMode = "demo" | "live";

const STORAGE_KEY = "rf_data_mode";
const EVENT_NAME = "dataModeChanged";

export function getCurrentDataMode(): DataMode {
  if (typeof window === "undefined") {
    // Default to live in server-rendered contexts so API-backed demos "just work"
    // without requiring the operator to toggle Demo/Live.
    return "live";
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // Default to live unless the user explicitly chose demo.
    return stored === "demo" ? "demo" : "live";
  } catch {
    return "live";
  }
}

export function setCurrentDataMode(mode: DataMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore storage failures; mode will still update in-memory
  }
  const event = new CustomEvent(EVENT_NAME, { detail: mode });
  window.dispatchEvent(event);
}

export function subscribeToDataModeChanges(
  callback: (mode: DataMode) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = (event: Event) => {
    try {
      const custom = event as CustomEvent<DataMode>;
      if (custom.detail) {
        callback(custom.detail);
      }
    } catch {
      // ignore malformed events
    }
  };
  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}


