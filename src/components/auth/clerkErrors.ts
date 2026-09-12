import { isClerkAPIResponseError } from "@clerk/clerk-react/errors";

function clerkErrorText(err: unknown): string {
  if (isClerkAPIResponseError(err)) {
    return err.errors
      .map((e) => `${e.code ?? ""} ${e.message ?? ""} ${e.longMessage ?? ""}`)
      .join(" ");
  }
  if (err instanceof Error) return err.message;
  return "";
}

export function clerkErrorMessage(err: unknown, fallback: string): string {
  if (isClerkAPIResponseError(err)) {
    return err.errors[0]?.longMessage ?? err.errors[0]?.message ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export function isAlreadyVerifiedError(err: unknown): boolean {
  const text = clerkErrorText(err);
  return (
    /\bverification_already_verified\b/i.test(text) ||
    /already been verified/i.test(text)
  );
}

export function isIdentifierExistsError(err: unknown): boolean {
  const text = clerkErrorText(err);
  return (
    /\bform_identifier_exists\b/i.test(text) ||
    /already exists|already associated|already taken/i.test(text)
  );
}
