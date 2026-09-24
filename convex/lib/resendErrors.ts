/**
 * Parse Resend error response body to extract structured error info.
 * Resend errors typically look like: { "statusCode": 429, "message": "...", "name": "rate_limit_exceeded" }
 */
export function parseResendError(body: string): {
  code: string | undefined;
  message: string | undefined;
} {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const code =
      typeof parsed.name === "string"
        ? parsed.name
        : typeof parsed.code === "string"
          ? parsed.code
          : typeof parsed.error === "string"
            ? parsed.error
            : undefined;
    const message =
      typeof parsed.message === "string" ? parsed.message : undefined;
    return { code, message };
  } catch {
    return { code: undefined, message: body.slice(0, 200) };
  }
}

export function isResendQuotaError(
  status: number,
  parsed: { code: string | undefined; message: string | undefined },
): boolean {
  return (
    status === 429 ||
    parsed.code === "daily_quota_exceeded" ||
    parsed.code === "rate_limit_exceeded" ||
    /quota|rate.?limit/i.test(parsed.message ?? "") ||
    /quota|rate.?limit/i.test(parsed.code ?? "")
  );
}
