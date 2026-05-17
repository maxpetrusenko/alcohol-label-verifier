#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "docs", "assets");
const baseURL = process.env.SCREENSHOT_BASE_URL ?? "https://cola.maxpetrusenko.com";

async function main() {
  await mkdir(assetsDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "LabelCheck" }).waitFor();
  await page.screenshot({
    path: join(assetsDir, "reviewer-before-input.jpg"),
    type: "jpeg",
    quality: 88,
  });

  await page.getByRole("button", { name: "Demo pass" }).click();
  await page.getByRole("heading", { name: "Field comparison" }).waitFor({ timeout: 60_000 });
  await page.getByText("approved").first().waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: join(assetsDir, "reviewer-after-verification.jpg"),
    type: "jpeg",
    quality: 88,
  });

  await browser.close();
  console.log(`Wrote ${join(assetsDir, "reviewer-before-input.jpg")}`);
  console.log(`Wrote ${join(assetsDir, "reviewer-after-verification.jpg")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
