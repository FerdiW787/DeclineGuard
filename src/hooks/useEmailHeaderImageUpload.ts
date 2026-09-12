import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { uploadEmailHeaderImage } from "@/lib/uploadEmailHeaderImage";

export function useEmailHeaderImageUpload() {
  const generateUploadUrl = useMutation(
    api.functions.recoverySettings.generateEmailImageUploadUrl,
  );
  const finalizeUpload = useMutation(
    api.functions.recoverySettings.finalizeEmailImageUpload,
  );

  return useCallback(
    (file: File) =>
      uploadEmailHeaderImage(
        file,
        () => generateUploadUrl(),
        (storageId) => finalizeUpload({ storageId }),
      ),
    [finalizeUpload, generateUploadUrl],
  );
}
