/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_CONVEX_URL: string;
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly PUBLIC_APP_URL?: string;
  readonly PUBLIC_APP_URLS?: string;
}
