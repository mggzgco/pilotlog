import type { FlightCandidate } from "@/app/lib/adsb/types";

export interface AdsbProvider {
  searchFlights(tailNumber: string, start: Date, end: Date): Promise<FlightCandidate[]>;
}
