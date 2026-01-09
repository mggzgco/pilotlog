import type { AdsbProvider } from "@/app/lib/adsb/provider";
import { MockAdsbProvider, mockProviderName } from "@/app/lib/adsb/mockProvider";

export const defaultProviderName = mockProviderName;

export function getAdsbProvider(): AdsbProvider {
  return new MockAdsbProvider();
}
