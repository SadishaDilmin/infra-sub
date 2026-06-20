import type { NextRequest } from "next/server";

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

/** Parse a JSON body safely; returns undefined on empty/invalid bodies. */
export async function readJson<T = unknown>(
  req: NextRequest,
): Promise<T | undefined> {
  try {
    const text = await req.text();
    if (!text) return undefined;
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/** Parse pagination query params with sane bounds. */
export function getPagination(req: NextRequest): {
  page: number;
  limit: number;
  skip: number;
} {
  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20),
  );
  return { page, limit, skip: (page - 1) * limit };
}
