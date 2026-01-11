export type LogTenMapping = {
  date: string;
  tail: string;
  aircraftType?: string;
  origin: string;
  route?: string;
  destination: string;
  timeOut?: string;
  timeIn?: string;
  hobbsOut?: string;
  hobbsIn?: string;
  totalTime?: string;
  pic?: string;
  sic?: string;
  dualReceived?: string;
  solo?: string;
  night?: string;
  xc?: string;
  simInst?: string;
  actualInst?: string;
  simulator?: string;
  ground?: string;
  picCrew?: string;
  student?: string;
  instructor?: string;
  dayTo?: string;
  dayLdg?: string;
  nightTo?: string;
  nightLdg?: string;
  approach1?: string;
  approach2?: string;
  holds?: string;
  remarks?: string;
  flightReview?: string;
  externalId?: string;
  updatedAt?: string;
};

function findHeader(headers: string[], candidates: string[]): string | undefined {
  const lower = new Map(headers.map((h) => [h.toLowerCase().trim(), h] as const));
  for (const c of candidates) {
    const found = lower.get(c.toLowerCase());
    if (found) return found;
  }
  return undefined;
}

export function guessLogTenMapping(headers: string[]): LogTenMapping | null {
  // LogTen "Export Flights (Tab)" commonly uses tab-separated headers like:
  // Date, Aircraft ID, Aircraft Type, From, Route, To, Hobbs Out/In, Out/In, Total Time, ...
  const date = findHeader(headers, ["date"]);
  const tail = findHeader(headers, [
    "aircraft id",
    "aircraft",
    "tail",
    "tail number",
    "tailnumber",
    "registration"
  ]);
  const origin = findHeader(headers, ["from", "origin", "dep", "departure"]);
  const destination = findHeader(headers, ["to", "destination", "arr", "arrival"]);
  if (!date || !tail || !origin || !destination) {
    return null;
  }
  return {
    date,
    tail,
    origin,
    route: findHeader(headers, ["route"]),
    destination,
    aircraftType: findHeader(headers, ["aircraft type", "type"]),
    timeOut: findHeader(headers, ["out", "time out", "timeout"]),
    timeIn: findHeader(headers, ["in", "time in", "timein"]),
    hobbsOut: findHeader(headers, ["hobbs out", "hobbsout"]),
    hobbsIn: findHeader(headers, ["hobbs in", "hobbsin"]),
    totalTime: findHeader(headers, ["total time", "tt"]),
    pic: findHeader(headers, ["pic", "pic time"]),
    sic: findHeader(headers, ["sic", "sic time"]),
    dualReceived: findHeader(headers, ["dual", "dual received", "dual rcvd"]),
    solo: findHeader(headers, ["solo"]),
    night: findHeader(headers, ["night", "night time"]),
    xc: findHeader(headers, ["xc", "cross country", "cross-country"]),
    simInst: findHeader(headers, ["sim inst", "simulated instrument", "sim instrument"]),
    actualInst: findHeader(headers, ["actual inst", "instrument", "actual instrument", "inst"]),
    simulator: findHeader(headers, ["simulator", "sim", "simulator time"]),
    ground: findHeader(headers, ["ground", "ground time"]),
    picCrew: findHeader(headers, ["pic/p1 crew", "pic crew", "crew"]),
    student: findHeader(headers, ["student"]),
    instructor: findHeader(headers, ["instructor"]),
    dayTo: findHeader(headers, ["day t/o", "day to", "day takeoffs"]),
    dayLdg: findHeader(headers, ["day ldg", "day ldgs", "day landings"]),
    nightTo: findHeader(headers, ["night t/o", "night to", "night takeoffs"]),
    nightLdg: findHeader(headers, ["night ldg", "night ldgs", "night landings"]),
    approach1: findHeader(headers, ["approach 1"]),
    approach2: findHeader(headers, ["approach 2"]),
    holds: findHeader(headers, ["holds"]),
    remarks: findHeader(headers, ["remarks", "comments", "note", "notes"]),
    flightReview: findHeader(headers, ["flight review"]),
    externalId: findHeader(headers, ["id", "entry id", "flight id"]),
    updatedAt: findHeader(headers, ["updated", "last updated", "modified"])
  };
}

