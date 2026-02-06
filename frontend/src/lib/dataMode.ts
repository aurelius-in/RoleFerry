export type DataMode = "demo" | "live";

const STORAGE_KEY = "rf_data_mode";
const EVENT_NAME = "dataModeChanged";

export function getCurrentDataMode(): DataMode {
  // We run RoleFerry in Live mode by default.
  // "Demo" is an internal fallback used only when an API is down.
  return "live";
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


