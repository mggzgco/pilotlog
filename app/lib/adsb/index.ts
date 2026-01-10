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

function hasAeroApiKeyConfigured() {
  return Boolean(process.env.AEROAPI_KEY?.trim() || process.env.AEROAPI_KEY_FILE?.trim());
}

export function getAdsbProvider(): AdsbProvider {
  switch (defaultProviderName) {
    case mockProviderName:
      return new MockAdsbProvider();
    case aeroApiProviderName:
    default:
      // If AeroAPI is selected but no key is configured, fall back to the mock provider
      // so the app can still be used in development/demo scenarios.
      if (!hasAeroApiKeyConfigured()) {
        return new MockAdsbProvider();
      }
      return new AeroApiAdsbProvider();
  }
}
