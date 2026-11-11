import { AppError } from "@/lib/errors";

export function verifySameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "").split(",")[0]?.trim();

  if (!origin || !host) {
    throw new AppError(403, "CSRF_ORIGIN_REQUIRED", "Same-origin Origin header is required.");
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "CSRF_INVALID_ORIGIN", "Malformed Origin header.");
  }

  if (originHost.toLowerCase() !== host.toLowerCase()) {
    throw new AppError(403, "CSRF_MISMATCH", "Cross-origin state-changing request rejected.");
  }
}

/**
 * Prevents open redirects by accepting only clean relative paths on this origin.
 */
export function sanitizeNextPath(candidate: string | null | undefined, fallback = "/app"): string {
  if (!candidate || typeof candidate !== "string") return fallback;
  const trimmed = candidate.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("://") ||
    /[\r\n\0]/.test(trimmed)
  ) {
    return fallback;
  }
  return trimmed;
}
