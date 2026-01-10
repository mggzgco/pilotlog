import { beforeEach, describe, expect, it, vi } from "vitest";
import { join } from "path";
import { tmpdir } from "os";
import { writeFile } from "fs/promises";
const baseDate = new Date(1000 * 1000);

function buildResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload
  } satisfies Response;
}

describe("AeroApiAdsbProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    process.env.AEROAPI_KEY = "test-key";
    delete process.env.AEROAPI_KEY_FILE;
  });

  it("queries flights and builds flight candidates with tracks", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        buildResponse({
          flights: [
            {
              fa_flight_id: "fa123",
              ident: "N246FB",
              origin: { code: "KSEA" },
              destination: { code: "KPDX" },
              departuretime: 1000,
              arrivaltime: 1600
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        buildResponse({
          positions: [
            {
              timestamp: 1000,
              latitude: 47.0,
              longitude: -122.0,
              altitude: 5000,
              ground_speed: 110,
              heading: 90
            }
          ]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { AeroApiAdsbProvider } = await import("@/app/lib/adsb/aeroApiProvider");
    const provider = new AeroApiAdsbProvider();
    const flights = await provider.searchFlights("N246FB", baseDate, new Date(2000 * 1000));

    expect(flights).toHaveLength(1);
    expect(flights[0]?.providerFlightId).toBe("aeroapi-fa123");
    expect(flights[0]?.tailNumber).toBe("N246FB");
    expect(flights[0]?.track).toHaveLength(1);
    expect(flights[0]?.stats?.maxAltitudeFeet).toBe(5000);

    const firstUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(firstUrl.pathname).toContain("/history/flights/N246FB");
    expect(firstUrl.searchParams.get("ident_type")).toBe("registration");
    expect(firstUrl.searchParams.get("start")).toBe(baseDate.toISOString());
  });

  it("supports AeroAPI history-style ISO timestamps (actual_off/actual_on)", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        buildResponse({
          flights: [
            {
              fa_flight_id: "fa_iso_1",
              ident: "N246FB",
              origin: { code: "KLOM" },
              destination: { code: "KLOM" },
              actual_off: "2026-01-08T12:05:00Z",
              actual_on: "2026-01-08T12:55:00Z"
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        buildResponse({
          positions: [
            {
              timestamp: "2026-01-08T12:10:00Z",
              latitude: 40.1,
              longitude: -75.1,
              altitude: 1000,
              ground_speed: 90,
              heading: 180
            },
            {
              timestamp: "2026-01-08T12:50:00Z",
              latitude: 40.2,
              longitude: -75.2,
              altitude: 2000,
              ground_speed: 100,
              heading: 190
            }
          ]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const { AeroApiAdsbProvider } = await import("@/app/lib/adsb/aeroApiProvider");
    const provider = new AeroApiAdsbProvider();
    const flights = await provider.searchFlights(
      "N246FB",
      new Date("2026-01-08T00:00:00Z"),
      new Date("2026-01-09T00:00:00Z")
    );

    expect(flights).toHaveLength(1);
    expect(flights[0]?.providerFlightId).toBe("aeroapi-fa_iso_1");
    expect(flights[0]?.startTime.toISOString()).toBe("2026-01-08T12:05:00.000Z");
    expect(flights[0]?.endTime.toISOString()).toBe("2026-01-08T12:55:00.000Z");
    expect(flights[0]?.track).toHaveLength(2);
  });

  it("throws when the API key is missing", async () => {
    delete process.env.AEROAPI_KEY;
    const { AeroApiAdsbProvider } = await import("@/app/lib/adsb/aeroApiProvider");
    const provider = new AeroApiAdsbProvider();

    await expect(
      provider.searchFlights("N246FB", baseDate, new Date(2000 * 1000))
    ).rejects.toThrow("AeroAPI key is missing");
  });

  it("reads the API key from a file when configured", async () => {
    delete process.env.AEROAPI_KEY;
    const keyPath = join(tmpdir(), `aeroapi-key-${Date.now()}.txt`);
    await writeFile(keyPath, "file-key");
    process.env.AEROAPI_KEY_FILE = keyPath;

    const fetchMock = vi
      .fn()
      // history flights
      .mockResolvedValueOnce(buildResponse({ flights: [] }))
      // live flights
      .mockResolvedValueOnce(buildResponse({ flights: [] }))
      // flights/search (4 query variants)
      .mockResolvedValueOnce(buildResponse({ flights: [] }))
      .mockResolvedValueOnce(buildResponse({ flights: [] }))
      .mockResolvedValueOnce(buildResponse({ flights: [] }))
      .mockResolvedValueOnce(buildResponse({ flights: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const { AeroApiAdsbProvider } = await import("@/app/lib/adsb/aeroApiProvider");
    const provider = new AeroApiAdsbProvider();
    await provider.searchFlights("N246FB", baseDate, new Date(2000 * 1000));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-apikey": "file-key"
        })
      })
    );
  });
});
