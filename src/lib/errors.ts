import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function jsonErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
      .join("; ");
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message } },
      { status: 422 }
    );
  }
  // Never leak stack traces, SQL details, or secrets to clients
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Request could not be completed." } },
    { status: 500 }
  );
}
