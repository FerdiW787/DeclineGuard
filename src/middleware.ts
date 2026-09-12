import { clerkMiddleware, createRouteMatcher } from "@clerk/astro/server";

const isProtectedRoute = createRouteMatcher([
  "/a/dashboard(.*)",
  "/a/admin(.*)",
]);

function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  // Pragmatic CSP: blocks framing + unexpected bases; Clerk/Convex need broad script hosts.
  headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.clerk.accounts.dev https://clerk.com https://*.clerk.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.com https://*.clerk.com https://challenges.cloudflare.com",
      "connect-src 'self' blob: data: https: wss:",
      "worker-src 'self' blob:",
      "frame-src 'self' https://*.clerk.accounts.dev https://clerk.com https://*.clerk.com https://challenges.cloudflare.com",
    ].join("; "),
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = clerkMiddleware(async (auth, context, next) => {
  if (isProtectedRoute(context.request) && !auth().userId) {
    return auth().redirectToSignIn();
  }

  const response = await next();
  return applySecurityHeaders(response);
});
