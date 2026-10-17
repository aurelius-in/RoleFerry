export type ClientRecord = {
  id: string;
  name: string;
  company: string;
  focus: string;
  createdAt: string;
};

const CLIENTS_KEY = "rf_clients";
const ACTIVE_CLIENT_KEY = "rf_active_client_id";
const WORKSPACE_KEY = "rf_workspace";
const JOBSEEKER_BLOB = "rf_jobseeker_blob";

const KEEP_KEYS = new Set([
  "rf_mode",
  "rf_user",
  "rf_token",
  "rf_data_mode",
  "rf_show_debug",
  CLIENTS_KEY,
  ACTIVE_CLIENT_KEY,
  WORKSPACE_KEY,
  JOBSEEKER_BLOB,
  "rf_citizenship_country",
  "rf_citizenship_status",
]);

function canUseStorage() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function blobKey(clientId: string) {
  return `rf_client_blob_${clientId}`;
}

function workflowSnapshot(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!canUseStorage()) return out;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || KEEP_KEYS.has(key) || key.startsWith("rf_client_blob_")) continue;
    const value = window.localStorage.getItem(key);
    if (value != null) out[key] = value;
  }
  return out;
}

function persistCurrentWorkspace() {
  if (!canUseStorage()) return;
  const current = window.localStorage.getItem(WORKSPACE_KEY);
  const snapshot = JSON.stringify(workflowSnapshot());
  if (current && current !== "job-seeker") {
    window.localStorage.setItem(blobKey(current), snapshot);
    return;
  }
  window.localStorage.setItem(JOBSEEKER_BLOB, snapshot);
}

function clearWorkflowKeys() {
  if (!canUseStorage()) return;
  const keys = Object.keys(workflowSnapshot());
  keys.forEach((key) => window.localStorage.removeItem(key));
}

function loadSnapshot(raw: string | null) {
  clearWorkflowKeys();
  if (!raw || !canUseStorage()) return;
  try {
    const data = JSON.parse(raw) as Record<string, string>;
    Object.entries(data).forEach(([key, value]) => {
      if (!KEEP_KEYS.has(key) && !key.startsWith("rf_client_blob_")) {
        window.localStorage.setItem(key, value);
      }
    });
  } catch {
    // ignore a broken snapshot
  }
}

export function listClients(): ClientRecord[] {
  return readJson<ClientRecord[]>(CLIENTS_KEY, []);
}

export function getActiveClient(): ClientRecord | null {
  if (!canUseStorage()) return null;
  const id = window.localStorage.getItem(ACTIVE_CLIENT_KEY);
  if (!id) return null;
  return listClients().find((client) => client.id === id) || null;
}

export function addClient(input: { name: string; company: string; focus: string }): ClientRecord {
  const client: ClientRecord = {
    id: `client_${Date.now()}`,
    name: input.name.trim(),
    company: input.company.trim(),
    focus: input.focus.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...listClients(), client];
  window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(next));
  return client;
}

export function selectClient(id: string) {
  if (!canUseStorage()) return;
  if (window.localStorage.getItem(WORKSPACE_KEY) === id) {
    window.localStorage.setItem(ACTIVE_CLIENT_KEY, id);
    return;
  }
  persistCurrentWorkspace();
  loadSnapshot(window.localStorage.getItem(blobKey(id)));
  window.localStorage.setItem(WORKSPACE_KEY, id);
  window.localStorage.setItem(ACTIVE_CLIENT_KEY, id);
  window.dispatchEvent(new CustomEvent("rf-client-changed"));
}

export function removeClient(id: string) {
  if (!canUseStorage()) return;
  const active = window.localStorage.getItem(ACTIVE_CLIENT_KEY) === id;
  if (active) persistCurrentWorkspace();
  const next = listClients().filter((client) => client.id !== id);
  window.localStorage.setItem(CLIENTS_KEY, JSON.stringify(next));
  window.localStorage.removeItem(blobKey(id));
  if (active) {
    clearWorkflowKeys();
    window.localStorage.removeItem(ACTIVE_CLIENT_KEY);
    window.localStorage.removeItem(WORKSPACE_KEY);
    window.dispatchEvent(new CustomEvent("rf-client-changed"));
  }
}

export function activateJobSeekerWorkspace() {
  if (!canUseStorage()) return;
  if (window.localStorage.getItem(WORKSPACE_KEY) === "job-seeker") return;
  persistCurrentWorkspace();
  loadSnapshot(window.localStorage.getItem(JOBSEEKER_BLOB));
  window.localStorage.setItem(WORKSPACE_KEY, "job-seeker");
  window.localStorage.removeItem(ACTIVE_CLIENT_KEY);
  window.dispatchEvent(new CustomEvent("rf-client-changed"));
}
