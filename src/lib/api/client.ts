import { AUTH_COOKIE } from "@/config/constants";

/**
 * Browser API client. Responsibilities:
 *  - Attach the CSRF header (read from the non-httpOnly CSRF cookie) on mutations.
 *  - Send cookies (credentials) for our httpOnly session cookies.
 *  - Transparently refresh the access token once on a 401, then retry.
 *  - Unwrap the { success, data | error } envelope into data or a thrown error.
 */

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]!) : null;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function rawRequest(path: string, options: RequestOptions = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (MUTATING.has(method)) {
    const csrf = readCookie(AUTH_COOKIE.CSRF);
    if (csrf) headers.set("x-csrf-token", csrf);
  }

  return fetch(path, {
    ...options,
    method,
    headers,
    credentials: "same-origin",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  // De-dupe concurrent refreshes.
  if (!refreshing) {
    refreshing = rawRequest("/api/auth/refresh", { method: "POST" })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) res = await rawRequest(path, options);
  }

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  const envelope = json as
    | { success: true; data: T }
    | { success: false; error: { code: string; message: string; details?: unknown } }
    | null;

  if (!res.ok || !envelope || envelope.success === false) {
    const err = envelope && envelope.success === false ? envelope.error : null;
    throw new ApiError(
      err?.message ?? `Request failed (${res.status})`,
      err?.code ?? "REQUEST_FAILED",
      res.status,
      err?.details,
    );
  }

  return envelope.data;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
