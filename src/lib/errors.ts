/**
 * Typed application errors. Throw these from services; the API handler wrapper
 * (`withApi`) maps them to consistent HTTP responses. This keeps services free
 * of HTTP concerns (SOLID: single responsibility).
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "PAYMENT_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: unknown;
  public readonly expose: boolean;

  constructor(
    message: string,
    opts: {
      statusCode?: number;
      code?: ErrorCode;
      details?: unknown;
      expose?: boolean;
    } = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = opts.statusCode ?? 500;
    this.code = opts.code ?? "INTERNAL";
    this.details = opts.details;
    // Whether the message is safe to show to the client.
    this.expose = opts.expose ?? this.statusCode < 500;
  }
}

export const BadRequest = (msg = "Bad request", details?: unknown) =>
  new AppError(msg, { statusCode: 400, code: "BAD_REQUEST", details });

export const Unauthorized = (msg = "Authentication required") =>
  new AppError(msg, { statusCode: 401, code: "UNAUTHORIZED" });

export const Forbidden = (msg = "You do not have access to this resource") =>
  new AppError(msg, { statusCode: 403, code: "FORBIDDEN" });

export const NotFound = (msg = "Resource not found") =>
  new AppError(msg, { statusCode: 404, code: "NOT_FOUND" });

export const Conflict = (msg = "Resource already exists") =>
  new AppError(msg, { statusCode: 409, code: "CONFLICT" });

export const ValidationError = (details: unknown, msg = "Validation failed") =>
  new AppError(msg, { statusCode: 422, code: "VALIDATION_ERROR", details });

export const RateLimited = (msg = "Too many requests") =>
  new AppError(msg, { statusCode: 429, code: "RATE_LIMITED" });

export const PaymentError = (msg = "Payment processing error", details?: unknown) =>
  new AppError(msg, { statusCode: 402, code: "PAYMENT_ERROR", details });
