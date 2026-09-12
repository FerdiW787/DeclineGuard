import "@clerk/types";

declare module "@clerk/types" {
  /** Roles must live in private metadata (Backend/Dashboard only). */
  interface UserPrivateMetadata {
    role?: "user" | "staff" | "admin" | "standard";
  }
}
