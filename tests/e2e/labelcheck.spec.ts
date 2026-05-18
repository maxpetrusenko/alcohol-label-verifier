import { expect, test } from "@playwright/test";

const requirementRef = {
  id: "ttb-brand-name",
  label: "Alcohol beverage brand name",
  source: "TTB beverage alcohol labeling guidance",
  url: "https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-name",
};

async function mockVerifyPass(page: import("@playwright/test").Page) {
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
}

test("reviewer can load the app and run the demo verification flow", async ({ page }) => {
  await mockVerifyPass(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "LabelCheck" })).toBeVisible();

  await page.getByRole("button", { name: "Demo pass" }).click();

  await expect(page.getByRole("heading", { name: "Field comparison" })).toBeVisible();
  await expect(page.getByText("approved")).toBeVisible();
  await expect(page.getByText("Brand name")).toBeVisible();
  await expect(page.getByText("OLD TOM DISTILLERY").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Needs reason and note")).toBeVisible();
  await expect(page.getByLabel("Reviewer outcome")).toHaveValue("rejected");
  await page.getByLabel("Reason code").selectOption("label_correction");
  await page.getByLabel("Reviewer note").fill("Correct the brand presentation before approval.");
  await expect(page.getByText("Decision saved")).toBeVisible();

  const storageKeys = await page.evaluate(() => Object.keys(window.localStorage).filter((key) => key.startsWith("labelcheck:reviewer-disposition:v1:")));
  expect(storageKeys).toHaveLength(1);

  await page.reload();
  await page.getByRole("button", { name: "Demo pass" }).click();
  await expect(page.getByRole("button", { name: "Reject" })).toHaveClass(/selected/);
  await expect(page.getByLabel("Reviewer note")).toHaveValue("Correct the brand presentation before approval.");
});

test("mobile viewport uses the single-column review layout", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "mobile-only regression guard");

  await mockVerifyPass(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Demo pass" }).click();
  await expect(page.getByRole("heading", { name: "Field comparison" })).toBeVisible();

  const layout = await page.evaluate(() => {
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const hero = document.querySelector(".hero-panel")?.getBoundingClientRect();
    const controls = document.querySelector(".control-panel")?.getBoundingClientRect();
    const screenColumns = window.getComputedStyle(document.querySelector(".verifier-screen")!).gridTemplateColumns;

    return {
      viewportWidth,
      screenColumns,
      heroRight: hero?.right ?? 0,
      controlsLeft: controls?.left ?? 0,
      controlsRight: controls?.right ?? 0,
      controlsTop: controls?.top ?? 0,
      heroBottom: hero?.bottom ?? 0,
    };
  });

  expect(layout.screenColumns.split(" ")).toHaveLength(1);
  expect(layout.heroRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.controlsLeft).toBeLessThanOrEqual(10);
  expect(layout.controlsRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
  expect(layout.controlsTop).toBeGreaterThanOrEqual(layout.heroBottom - 1);
});
