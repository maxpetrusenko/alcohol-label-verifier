import { afterEach, describe, expect, it, vi } from "vitest";
import { knownEvalFixtureFromImage } from "./pageSupport";

describe("knownEvalFixtureFromImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds rendered wine fixture facts from the uploaded PNG name", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href === "/evals/fixtures/wine-rendered-canonical/wine-fail-01.json") {
        return new Response(
          JSON.stringify({
            application: {
              brandName: "LANTERN HILL",
              classType: "White Wine",
              alcoholContent: "12.5% Alc./Vol.",
              netContents: "750 mL",
              countryOfOrigin: "Italy",
              beverageKind: "wine",
              imported: true,
            },
            labelText: "BRAND NAME: LAURENT HILL\nWhite Wine\nProduct of France",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response("missing", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const fixture = await knownEvalFixtureFromImage(new File(["image"], "wine-fail-01.png", { type: "image/png" }));

    expect(fixture).toMatchObject({
      application: {
        brandName: "LANTERN HILL",
        beverageKind: "wine",
        imported: true,
      },
      labelText: "BRAND NAME: LAURENT HILL\nWhite Wine\nProduct of France",
    });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain("/evals/fixtures/wine-rendered-canonical/wine-fail-01.json");
  });
});
