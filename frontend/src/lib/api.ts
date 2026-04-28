export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
import { getMockResponse } from "./mocks";

export async function api<T>(path: string, method: HttpMethod = "GET", body?: unknown, opts?: { signal?: AbortSignal }): Promise<T> {
  const isServer = typeof window === "undefined";
  
  let url: string;
  if (isServer) {
    // Server-side (SSR): Use the absolute URL from env
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    url = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  } else {
    // Client-side: ALWAYS use the /api prefix so auth cookies are same-origin (middleware expects it).
    // The proxy destination is configured in next.config.ts (with a safe prod fallback).
    url = path.startsWith("/") ? `/api${path}` : `/api/${path}`;
    console.log(`[API] Client request via proxy: ${url}`);
  }

  // Client-side mock behavior:
  // - If NEXT_PUBLIC_USE_CLIENT_MOCKS=true, prefer mocks (explicit demo/dev mode).
  // - Otherwise, call the backend and surface errors.
  // - If the backend is DOWN/500s, we fall back to mocks (only when available) so demos don't hard-break.
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  const useClientMocks = !isServer && (process.env.NEXT_PUBLIC_USE_CLIENT_MOCKS || "").toLowerCase() === "true";
  const tryMock = () => (!isServer ? getMockResponse(normalizedPath, method, body) : undefined);

  if (useClientMocks) {
    const mock = tryMock();
    if (mock !== undefined) return mock as T;
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isServer) {
      const token = localStorage.getItem("rf_token");
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      credentials: "include",
      signal: opts?.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      // On 5xx: only fall back to mocks when explicitly enabled (NEXT_PUBLIC_USE_CLIENT_MOCKS=true).
      // Silent mock fallback masks real backend errors.
      throw new Error(`API ${method} ${url} failed: ${res.status} ${text}`);
    }

    return (await res.json()) as T;
  } catch (err) {
    // Network error / fetch failure → only allow mock fallback when explicitly enabled.
    if (useClientMocks && !isServer) {
      const mock = tryMock();
      if (mock !== undefined) {
        console.warn(`[API] Falling back to mock for ${normalizedPath} due to network/error.`);
        return mock as T;
      }
    }
    throw err;
  }
}

