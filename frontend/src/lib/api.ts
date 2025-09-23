export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function api<T>(path: string, method: HttpMethod = "GET", body?: any): Promise<T> {
  const url = path.startsWith("/") ? `/api${path}` : `/api/${path}`;
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${url} failed: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

