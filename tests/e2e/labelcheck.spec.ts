import { expect, test } from "@playwright/test";

const requirementRef = {
  id: "ttb-brand-name",
  label: "Alcohol beverage brand name",
  source: "TTB beverage alcohol labeling guidance",
  url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-name",
};

test("reviewer can load the app and run the demo verification flow", async ({ page }) => {
  await page.route("**/api/verify", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        results: [
          {
            labelId: "demo-label",
            fileName: "01-pass-01.png",
            decision: "approved",
            score: 100,
            elapsedMs: 42,
            extraction: {
              labelText: "OLD TOM DISTILLERY\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL",
              brandName: "OLD TOM DISTILLERY",
              classType: "Kentucky Straight Bourbon Whiskey",
              alcoholContent: "45% Alc./Vol. (90 Proof)",
              netContents: "750 mL",
              confidence: 0.97,
              notes: [],
            },
            checks: [
              {
                id: "brand-name",
                label: "Brand name",
                status: "pass",
                severity: "blocking",
                requirementRef,
                expected: "OLD TOM DISTILLERY",
                observed: "OLD TOM DISTILLERY",
                rationale: "Brand name matches the application record.",
              },
            ],
            summary: "All focused distilled-spirits label fields matched the application.",
            missingApplicationFacts: [],
            nextSteps: ["Ready to save."],
            workflow: {
              comparisonSummary: "All focused distilled-spirits label fields matched the application.",
              missingApplicationFacts: [],
              nextSteps: ["Ready to save."],
            },
          },
        ],
        meta: {
          requestId: "req_e2e",
          count: 1,
          elapsedMs: 42,
          mode: "e2e",
        },
      }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LabelCheck" })).toBeVisible();

  await page.getByRole("button", { name: "Demo pass" }).click();

  await expect(page.getByRole("heading", { name: "Field comparison" })).toBeVisible();
  await expect(page.getByText("approved")).toBeVisible();
  await expect(page.getByText("Brand name")).toBeVisible();
  await expect(page.getByText("OLD TOM DISTILLERY").first()).toBeVisible();

  await expect(page.getByText("No issues", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Reject label/ }).click();
  await expect(page.getByText("Needs reason and note")).toBeVisible();
  await expect(page.getByLabel("Reviewer outcome")).toHaveValue("rejected");
  await page.getByLabel("Reason code").selectOption("label_correction");
  await page.getByLabel("Reviewer note").fill("Correct the brand presentation before approval.");
  await expect(page.getByText("Draft ready")).toBeVisible();

  const storageKeys = await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith("labelcheck:reviewer-disposition:v1:")));
  expect(storageKeys).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Demo pass" }).click();
  await expect(page.getByRole("button", { name: /Reject \/ override/ })).toHaveClass(/selected/);
  await expect(page.getByLabel("Reviewer note")).toHaveValue("Correct the brand presentation before approval.");
});
