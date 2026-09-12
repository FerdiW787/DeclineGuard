import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const out = path.resolve("public/marketing/dashboard-preview.png");
await mkdir(path.dirname(out), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.HOME +
    "/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 940 },
  deviceScaleFactor: 2,
});
await page.goto("http://localhost:4321/dashboard", {
  waitUntil: "networkidle",
});
await page.addStyleTag({
  content: "astro-dev-toolbar, #dev-toolbar-root { display: none !important; }",
});
await page.waitForTimeout(2800);
await page.screenshot({
  path: out,
  type: "png",
  animations: "disabled",
});
await browser.close();
console.log(`Wrote ${out}`);
