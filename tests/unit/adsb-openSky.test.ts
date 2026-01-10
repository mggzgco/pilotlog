import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenSkyAdsbProvider } from "@/app/lib/adsb/openSkyProvider";

const baseDate = new Date(1000 * 1000);

function buildResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload
  } satisfies Response;
}

describe("OpenSkyAdsbProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("queries aircraft by registration and builds flight candidates", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(
        buildResponse([
          {
            icao24: "abc123",
            registration: "N12345"
          }
        ])
      )
      .mockResolvedValueOnce(
        buildResponse([
          {
            firstSeen: 1000,
            lastSeen: 1600,
            estDepartureAirport: "KSEA",
            estArrivalAirport: "KPDX"
          }
        ])
      )
      .mockResolvedValueOnce(
        buildResponse({
          path: [
            [1000, 47.0, -122.0, 1000, 90, false],
            [1100, 47.1, -122.1, 1500, 91, false]
          ]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenSkyAdsbProvider();
    const flights = await provider.searchFlights("N12345", baseDate, new Date(2000 * 1000));

    expect(flights).toHaveLength(1);
    expect(flights[0]?.providerFlightId).toContain("opensky-abc123-1000");
    expect(flights[0]?.tailNumber).toBe("N12345");
    expect(flights[0]?.track).toHaveLength(2);
    expect(flights[0]?.stats?.maxAltitudeFeet).toBeGreaterThan(0);

    const firstUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(firstUrl.pathname).toContain("/metadata/aircraft/list");
    expect(firstUrl.searchParams.get("registration")).toBe("N12345");
  });

  it("falls back to the legacy reg parameter when registration yields no results", async () => {
    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce(buildResponse([]))
      .mockResolvedValueOnce(buildResponse([]))
      .mockResolvedValueOnce(
        buildResponse([
          {
            icao24: "def456",
            reg: "N54321"
          }
        ])
      )
      .mockResolvedValueOnce(
        buildResponse([
          {
            firstSeen: 2000,
            lastSeen: 2600,
            estDepartureAirport: "KSFO",
            estArrivalAirport: "KLAX"
          }
        ])
      )
      .mockResolvedValueOnce(
        buildResponse({
          path: [
            [2000, 37.6, -122.3, 2000, 80, false],
            [2100, 37.7, -122.4, 2300, 82, false]
          ]
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenSkyAdsbProvider();
    const flights = await provider.searchFlights("N54321", baseDate, new Date(3000 * 1000));

    expect(flights).toHaveLength(1);
    expect(flights[0]?.providerFlightId).toContain("opensky-def456-2000");

    const fallbackUrl = new URL(fetchMock.mock.calls[2]?.[0] as string);
    expect(fallbackUrl.searchParams.get("reg")).toBe("N54321");
  });
});
