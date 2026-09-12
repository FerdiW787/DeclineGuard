import type { Id } from "../../convex/_generated/dataModel";

export const EMAIL_IMAGE_MAX_BYTES = 2_500_000;
export const EMAIL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function assertEmailImageFile(file: File): void {
  const type = file.type || guessImageType(file.name);
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error("Use a JPG, PNG, WebP, or GIF image");
  }
  if (file.size > EMAIL_IMAGE_MAX_BYTES) {
    throw new Error("Image must be under 2.5 MB");
  }
}

export function guessImageType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "";
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadEmailHeaderImage(
  file: File,
  generateUploadUrl: () => Promise<string>,
  finalize: (storageId: Id<"_storage">) => Promise<string>,
): Promise<string> {
  assertEmailImageFile(file);
  const contentType = file.type || guessImageType(file.name) || "image/jpeg";
  const postUrl = await generateUploadUrl();
  const result = await fetch(postUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!result.ok) {
    throw new Error("Upload failed. Try again.");
  }
  const json = (await result.json()) as { storageId?: string };
  if (!json.storageId) {
    throw new Error("Upload failed. Try again.");
  }
  return await finalize(json.storageId as Id<"_storage">);
}
