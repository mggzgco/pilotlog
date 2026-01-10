import type { AdsbProvider } from "@/app/lib/adsb/provider";
import { MockAdsbProvider, mockProviderName } from "@/app/lib/adsb/mockProvider";
import { OpenSkyAdsbProvider, openSkyProviderName } from "@/app/lib/adsb/openSkyProvider";

function resolveProviderName() {
  const name = process.env.ADSB_PROVIDER?.toLowerCase().trim();
  if (!name) {
    return openSkyProviderName;
  }

  if (name === mockProviderName || name === openSkyProviderName) {
    return name;
  }

  return openSkyProviderName;
}

export const defaultProviderName = resolveProviderName();

export function getAdsbProvider(): AdsbProvider {
  switch (defaultProviderName) {
    case mockProviderName:
      return new MockAdsbProvider();
    case openSkyProviderName:
    default:
      return new OpenSkyAdsbProvider();
  }
}
