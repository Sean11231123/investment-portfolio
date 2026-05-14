import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAssetUniverse, parseUniverseFile } from "./universeService";

function response(ok: boolean, data: unknown, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("universe service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses a valid universe file", () => {
    const parsed = parseUniverseFile({
      version: 1,
      market: "US",
      source: "test",
      generatedAt: "2026-05-14T00:00:00.000Z",
      assets: [
        {
          symbol: "amd",
          name: "Advanced Micro Devices, Inc.",
          type: "us_stock",
          market: "US",
          currency: "USD",
          unitLabel: "股",
          priceSource: "us_static",
        },
      ],
      errors: [],
    });

    expect(parsed.assets[0].symbol).toBe("AMD");
    expect(parsed.assets[0].priceSource).toBe("us_static");
  });

  it("loads universe datasets and reports partial failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("index.json")) {
          return response(true, {
            version: 1,
            datasets: ["us-assets.json", "tw-assets.json"],
          });
        }

        if (url.endsWith("us-assets.json")) {
          return response(true, {
            version: 1,
            market: "US",
            source: "test",
            generatedAt: "2026-05-14T00:00:00.000Z",
            assets: [
              {
                symbol: "AMD",
                name: "Advanced Micro Devices, Inc.",
                type: "us_stock",
                market: "US",
                currency: "USD",
                unitLabel: "股",
                priceSource: "us_static",
              },
            ],
          });
        }

        return response(false, {}, 404);
      }),
    );

    const result = await loadAssetUniverse();

    expect(result.status).toBe("partial");
    expect(result.assets.map((asset) => asset.symbol)).toEqual(["AMD"]);
    expect(result.errors[0]).toContain("tw-assets.json");
  });

  it("falls back without throwing when index and datasets are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(false, {}, 404)));

    const result = await loadAssetUniverse();

    expect(result.status).toBe("unavailable");
    expect(result.assets).toEqual([]);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
