import axios from "axios";

import type { ApiFieldErrors } from "@/types";

/**
 * Turn a DRF error response into something worth showing a user.
 *
 * DRF answers a failed write with either per-field errors:
 *
 *     {"email": ["user with this email already exists."]}
 *
 * or a non-field message:
 *
 *     {"detail": "No active account found with the given credentials"}
 *
 * The forms here used to discard all of it and show one fixed string, so
 * "that email is already registered" and "the server is down" looked identical.
 *
 * Field names are prefixed only when there is more than one, which keeps the
 * common single-error case reading as a plain sentence.
 */
export function describeApiError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  if (!error.response) {
    // No response at all: DNS failure, offline, CORS rejection, timeout.
    return "Could not reach the server. Check your connection and try again.";
  }

  const data = error.response.data as ApiFieldErrors | string | undefined;

  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail.trim();
    }

    const entries = Object.entries(data).filter(([key]) => key !== "detail");
    const messages = entries.flatMap(([field, value]) => {
      const texts = Array.isArray(value) ? value : [value];
      return texts
        .filter((text): text is string => typeof text === "string" && Boolean(text.trim()))
        .map((text) =>
          entries.length > 1 ? `${humanizeField(field)}: ${text}` : text,
        );
    });

    if (messages.length) {
      return messages.join(" ");
    }
  }

  if (error.response.status >= 500) {
    return "The server ran into a problem. Please try again shortly.";
  }

  return fallback;
}

function humanizeField(field: string): string {
  const label = field.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
