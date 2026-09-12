/**
 * Dedicated Playwright brand-capture worker (required for browser-quality imports).
 *
 * Local + Cloudflare quick tunnel (no card / laptop must stay on):
 *   npm run dev
 *   (Astro + Convex + worker + trycloudflare.com URL, wires Convex DEV)
 *   Or standalone: npm run brand-capture:tunnel
 *
 * Local only (Convex cloud cannot reach 127.0.0.1):
 *   BRAND_CAPTURE_WORKER_SECRET=dev npm run brand-capture-worker
 *
 * Production (Fly.io) — needs a Fly account with billing verified:
 *   npm run brand-capture:deploy
 *   Then set Convex prod + dev:
 *     BRAND_CAPTURE_WORKER_URL=https://declineguard-brand-capture.fly.dev
 *     BRAND_CAPTURE_WORKER_SECRET=<same as Fly secret>
 *
 * Without a worker URL, Convex falls back to CSS scrape (still builds emails).
 */

import { createServer } from "node:http";
import { validateDomainInput } from "../convex/lib/brandImport/domain";
import { captureBrandViaPlaywright } from "./lib/playwrightBrandCapture";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST?.trim() || "0.0.0.0";
const SECRET = process.env.BRAND_CAPTURE_WORKER_SECRET?.trim();
const REQUIRE_SECRET =
  process.env.REQUIRE_SECRET === "1" ||
  process.env.NODE_ENV === "production";

if (REQUIRE_SECRET && !SECRET) {
  console.error(
    "BRAND_CAPTURE_WORKER_SECRET is required when NODE_ENV=production or REQUIRE_SECRET=1",
  );
  process.exit(1);
}

const server = createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method !== "POST" || !req.url?.startsWith("/capture")) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (SECRET) {
    const auth = req.headers.authorization ?? "";
    if (auth !== `Bearer ${SECRET}`) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  let body: { domain?: string };
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      domain?: string;
    };
  } catch {
    res.writeHead(400);
    res.end("Invalid JSON");
    return;
  }

  try {
    const { domain } = validateDomainInput(body.domain ?? "");
    const kit = await captureBrandViaPlaywright(domain);
    if (!kit) {
      res.writeHead(504, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "capture_timeout" }));
      return;
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(kit));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "capture_failed",
      }),
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Brand capture worker on http://${HOST}:${PORT}`);
  console.log(
    "Set Convex env: BRAND_CAPTURE_WORKER_URL + BRAND_CAPTURE_WORKER_SECRET",
  );
});
