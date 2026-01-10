import type { AdsbProvider } from "@/app/lib/adsb/provider";
import { MockAdsbProvider, mockProviderName } from "@/app/lib/adsb/mockProvider";
import { AeroApiAdsbProvider, aeroApiProviderName } from "@/app/lib/adsb/aeroApiProvider";

function resolveProviderName() {
  const name = process.env.ADSB_PROVIDER?.toLowerCase().trim();
  if (!name) {
    return aeroApiProviderName;
  }

  if (name === mockProviderName || name === aeroApiProviderName) {
    return name;
  }

  return aeroApiProviderName;
}

export const defaultProviderName = resolveProviderName();

export function getAdsbProvider(): AdsbProvider {
  switch (defaultProviderName) {
    case mockProviderName:
      return new MockAdsbProvider();
    case aeroApiProviderName:
    default:
      return new AeroApiAdsbProvider();
  }
}
