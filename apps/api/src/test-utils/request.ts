import { app } from "../app.js";

interface RequestOptions {
  body?: unknown;
  token?: string;
  query?: Record<string, string>;
}

export async function apiRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT",
  path: string,
  options: RequestOptions = {},
) {
  const url = new URL(path, "http://localhost");

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {};

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const init: RequestInit = { method, headers };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const res = await app.request(url.pathname + url.search, init);

  const status = res.status;

  let body: unknown;
  if (status === 204) {
    body = null;
  } else {
    body = await res.json();
  }

  return { status, body: body as Record<string, unknown> };
}
