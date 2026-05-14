import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { ApiErrorPayload } from "./apiSchemas";

type ApiErrorCode = "VALIDATION_ERROR" | "EXPORT_ERROR" | "INTERNAL_ERROR";

export function makeRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `req_${Date.now()}`;
}

export function apiError(error: unknown, fallbackMessage: string, code: ApiErrorCode = "INTERNAL_ERROR", status = 400) {
  const id = makeRequestId();

  if (error instanceof ZodError) {
    const payload: ApiErrorPayload = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload is invalid.",
        requestId: id,
        issues: error.issues.map((issue) => ({
          path: issue.path.map((part) => (typeof part === "symbol" ? String(part) : part)),
          message: issue.message,
        })),
      },
    };
    return NextResponse.json(payload, { status: 400 });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const payload: ApiErrorPayload = {
    error: {
      code,
      message,
      requestId: id,
    },
  };
  return NextResponse.json(payload, { status });
}
