import { withConvexClerkProvider } from "@/lib/withConvexClerkProvider";
import LsSetupFlow from "./LsSetupFlow";

function OnboardingPreviewPage() {
  return (
    <LsSetupFlow
      open
      preview
      onReveal={() => undefined}
      onComplete={() => undefined}
    />
  );
}

export default withConvexClerkProvider(OnboardingPreviewPage);
