import { beforeEach, describe, expect, it, vi } from "vitest";
import { AeroApiAdsbProvider } from "@/app/lib/adsb/aeroApiProvider";

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
    process.env.AEROAPI_KEY = "test-key";
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
    const provider = new AeroApiAdsbProvider();

    await expect(
      provider.searchFlights("N246FB", baseDate, new Date(2000 * 1000))
    ).rejects.toThrow("AeroAPI key is missing");
  });
});
