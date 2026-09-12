#!/usr/bin/env node
/**
 * Lemon Squeezy’s UI can’t simulate payment_failed / recovered.
 * This posts a signed test payload to your Convex webhook.
 *
 * Loads .env / .env.local automatically (Node does not do that by itself).
 *
 * Usage:
 *   node scripts/simulate-ls-payment-failed.mjs
 *
 * Or override:
 *   LEMONSQUEEZY_WEBHOOK_SECRET=… STORE_ID=433010 node scripts/simulate-ls-payment-failed.mjs
 *
 * Optional:
 *   CONVEX_SITE_URL=https://….convex.site
 *   EVENT=subscription_payment_recovered
 *   CUSTOMER_EMAIL=you@yourdomain.com
 *     (Resend test mode only delivers to your Resend account email until you verify a domain)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Don't override vars already set in the shell
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
// LS store ids are numeric; strip a leading "#" if someone copied "#433010"
const storeId = process.env.STORE_ID?.trim().replace(/^#/, "");
const site =
  process.env.CONVEX_SITE_URL?.trim() ||
  "https://savory-antelope-128.eu-west-1.convex.site";
const eventName = process.env.EVENT?.trim() || "subscription_payment_failed";
const customerEmail =
  process.env.CUSTOMER_EMAIL?.trim() || "maya@studio.io";

if (!secret) {
  console.error(
    "Missing LEMONSQUEEZY_WEBHOOK_SECRET.\n" +
      "Add it to .env (for this script only) or export it in the shell.\n" +
      "It must match the signing secret in Lemon Squeezy AND Convex:\n" +
      "  npx convex env set LEMONSQUEEZY_WEBHOOK_SECRET \"…\"",
  );
  process.exit(1);
}
if (!storeId) {
  console.error(
    "Missing STORE_ID.\n" +
      "Add STORE_ID=433010 to .env (no # — in .env, # starts a comment).\n" +
      "Find it in Convex → Data → lemonConnections → storeId.",
  );
  process.exit(1);
}

const invoiceId = String(Date.now());
const body = {
  meta: { event_name: eventName },
  data: {
    type: "subscription-invoices",
    id: invoiceId,
    attributes: {
      store_id: Number(storeId) || storeId,
      subscription_id: 9001,
      customer_id: 1,
      user_name: "Maya Studio",
      user_email: customerEmail,
      billing_reason: "renewal",
      currency: "EUR",
      status: eventName.includes("recovered") ? "paid" : "pending",
      total: 4900,
      test_mode: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      urls: {
        update_payment_method:
          "https://app.lemonsqueezy.com/my-orders/example/update-payment-method",
      },
    },
  },
};

const rawBody = JSON.stringify(body);
const signature = crypto
  .createHmac("sha256", secret)
  .update(rawBody)
  .digest("hex");

const url = `${site.replace(/\/$/, "")}/lemonsqueezy`;
console.log(`POST ${url}`);
console.log(`event=${eventName} store_id=${storeId} to=${customerEmail}`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Signature": signature,
    "X-Event-Name": eventName,
  },
  body: rawBody,
});

const text = await res.text();
console.log(res.status, text);
if (!res.ok) process.exit(1);
console.log(
  eventName === "subscription_payment_failed"
    ? "Check Convex Data → failedPayments + activityEvents (+ Resend if configured)"
    : "Check Convex Data → failedPayments (status recovered) + activityEvents",
);
