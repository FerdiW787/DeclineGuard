import type { FunctionComponent, JSX } from "react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/astro/react";

const CONVEX_URL =
  import.meta.env.PUBLIC_CONVEX_URL || process.env.PUBLIC_CONVEX_URL || "";

const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

export function withConvexClerkProvider<Props>(
  Component: FunctionComponent<Props>,
  options?: {
    /** When Convex URL is missing, still render children (e.g. marketing demos). */
    allowMissingConvex?: boolean;
  },
) {
  function WithConvexClerkProvider(props: Props & JSX.IntrinsicAttributes) {
    if (!convex) {
      if (options?.allowMissingConvex) {
        return <Component {...props} />;
      }
      return (
        <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Missing <code className="mx-1">PUBLIC_CONVEX_URL</code>. Set it in
          `.env.local` and run <code className="mx-1">npx convex dev</code>.
        </div>
      );
    }

    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <Component {...props} />
      </ConvexProviderWithClerk>
    );
  }

  return WithConvexClerkProvider;
}
