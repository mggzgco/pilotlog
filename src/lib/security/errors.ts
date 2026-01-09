import { NextResponse } from "next/server";

export const DEFAULT_PUBLIC_ERROR = "Something went wrong. Please try again.";

export function logServerError(error: unknown, context: string) {
  console.error(`[${context}]`, error);
}

export function handleActionError(
  error: unknown,
  context: string,
  fallbackMessage: string = DEFAULT_PUBLIC_ERROR
) {
  logServerError(error, context);
  return { error: fallbackMessage };
}

export function handleApiError(
  error: unknown,
  context: string,
  fallbackMessage: string = DEFAULT_PUBLIC_ERROR
) {
  logServerError(error, context);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
