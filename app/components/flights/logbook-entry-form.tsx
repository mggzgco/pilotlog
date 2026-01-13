import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { TimeOfDayInput } from "@/app/components/forms/time-of-day-input";

type LogbookEntryFormProps = {
  flightId: string;
  participantId: string | null;
  defaultStatus: "OPEN" | "CLOSED";
  defaultDate: string;
  defaultTotalTime: string;
  defaultPicTime: string;
  defaultSicTime: string;
  defaultDualReceivedTime: string;
  defaultSoloTime: string;
  defaultNightTime: string;
  defaultXcTime: string;
  defaultSimulatedInstrumentTime: string;
  defaultInstrumentTime: string;
  defaultSimulatorTime: string;
  defaultGroundTime: string;
  defaultTimeOut: string;
  defaultTimeIn: string;
  defaultHobbsOut: string;
  defaultHobbsIn: string;
  defaultDayTakeoffs: string;
  defaultDayLandings: string;
  defaultNightTakeoffs: string;
  defaultNightLandings: string;
  defaultRemarks: string;
  hasLogbookEntry: boolean;
};

export function LogbookEntryForm({
  flightId,
  participantId,
  defaultStatus,
  defaultDate,
  defaultTotalTime,
  defaultPicTime,
  defaultSicTime,
  defaultDualReceivedTime,
  defaultSoloTime,
  defaultNightTime,
  defaultXcTime,
  defaultSimulatedInstrumentTime,
  defaultInstrumentTime,
  defaultSimulatorTime,
  defaultGroundTime,
  defaultTimeOut,
  defaultTimeIn,
  defaultHobbsOut,
  defaultHobbsIn,
  defaultDayTakeoffs,
  defaultDayLandings,
  defaultNightTakeoffs,
  defaultNightLandings,
  defaultRemarks,
  hasLogbookEntry
}: LogbookEntryFormProps) {
  return (
    <form
      action={`/api/flights/${flightId}/update-logbook`}
      method="post"
      className="grid gap-3 lg:grid-cols-3"
    >
      <input type="hidden" name="participantId" value={participantId ?? ""} />
      <select
        name="status"
        defaultValue={defaultStatus}
        className="h-11 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950 lg:col-span-3"
      >
        <option value="OPEN">Open</option>
        <option value="CLOSED">Closed</option>
      </select>
      <Input name="date" type="date" required defaultValue={defaultDate} />
      <TimeOfDayInput
        name="timeOut"
        placeholder="Time out (HHMM or HH:MM)"
        defaultValue={defaultTimeOut}
      />
      <TimeOfDayInput
        name="timeIn"
        placeholder="Time in (HHMM or HH:MM)"
        defaultValue={defaultTimeIn}
      />
      <Input name="hobbsOut" type="number" step="0.1" placeholder="Hobbs out" defaultValue={defaultHobbsOut} />
      <Input name="hobbsIn" type="number" step="0.1" placeholder="Hobbs in" defaultValue={defaultHobbsIn} />
      <Input
        name="totalTime"
        type="number"
        step="0.1"
        placeholder="Total time"
        defaultValue={defaultTotalTime}
      />
      <div className="lg:col-span-3">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Logbook fields are saved exactly as entered (no auto-calculations).
        </p>
      </div>
      <Input
        name="picTime"
        type="number"
        step="0.1"
        placeholder="PIC time"
        defaultValue={defaultPicTime}
      />
      <Input
        name="dualReceivedTime"
        type="number"
        step="0.1"
        placeholder="Dual received"
        defaultValue={defaultDualReceivedTime}
      />
      <Input
        name="sicTime"
        type="number"
        step="0.1"
        placeholder="SIC time"
        defaultValue={defaultSicTime}
      />
      <Input
        name="soloTime"
        type="number"
        step="0.1"
        placeholder="Solo"
        defaultValue={defaultSoloTime}
      />
      <Input
        name="nightTime"
        type="number"
        step="0.1"
        placeholder="Night time"
        defaultValue={defaultNightTime}
      />
      <Input
        name="xcTime"
        type="number"
        step="0.1"
        placeholder="XC"
        defaultValue={defaultXcTime}
      />
      <Input
        name="simulatedInstrumentTime"
        type="number"
        step="0.1"
        placeholder="Sim inst"
        defaultValue={defaultSimulatedInstrumentTime}
      />
      <Input
        name="instrumentTime"
        type="number"
        step="0.1"
        placeholder="Actual inst"
        defaultValue={defaultInstrumentTime}
      />
      <Input
        name="simulatorTime"
        type="number"
        step="0.1"
        placeholder="Simulator"
        defaultValue={defaultSimulatorTime}
      />
      <Input
        name="groundTime"
        type="number"
        step="0.1"
        placeholder="Ground"
        defaultValue={defaultGroundTime}
      />
      <Input name="dayTakeoffs" type="number" step="1" placeholder="Day T/O" defaultValue={defaultDayTakeoffs} />
      <Input name="dayLandings" type="number" step="1" placeholder="Day LDG" defaultValue={defaultDayLandings} />
      <Input name="nightTakeoffs" type="number" step="1" placeholder="Night T/O" defaultValue={defaultNightTakeoffs} />
      <Input name="nightLandings" type="number" step="1" placeholder="Night LDG" defaultValue={defaultNightLandings} />
      <div className="lg:col-span-3">
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
          Remarks
        </label>
        <textarea
          name="remarks"
          className="min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus-visible:ring-offset-slate-950"
          placeholder="Logbook notes, tags, endorsements"
          defaultValue={defaultRemarks}
        />
      </div>
      <div className="lg:col-span-3">
        <FormSubmitButton
          type="submit"
          pendingText={hasLogbookEntry ? "Saving logbook..." : "Creating logbook..."}
        >
          {hasLogbookEntry ? "Save logbook" : "Create logbook entry"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
