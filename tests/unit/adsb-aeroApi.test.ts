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
    delete process.env.AEROAPI_API_KEY;
    delete process.env.FLIGHTAWARE_API_KEY;
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
    expect(firstUrl.pathname).toContain("/flights/N246FB");
    expect(firstUrl.searchParams.get("start")).toBe("1000");
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

    const fetchMock = vi.fn().mockResolvedValueOnce(
      buildResponse({
        flights: []
      })
    );
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

  it("uses the AeroAPI API key alias when present", async () => {
    delete process.env.AEROAPI_KEY;
    process.env.AEROAPI_API_KEY = "alias-key";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      buildResponse({
        flights: []
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { AeroApiAdsbProvider } = await import("@/app/lib/adsb/aeroApiProvider");
    const provider = new AeroApiAdsbProvider();
    await provider.searchFlights("N246FB", baseDate, new Date(2000 * 1000));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-apikey": "alias-key"
        })
      })
    );
  });
});
