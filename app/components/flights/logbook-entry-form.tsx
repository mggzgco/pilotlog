import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";

type LogbookEntryFormProps = {
  flightId: string;
  participantId: string | null;
  defaultDate: string;
  defaultTotalTime: string;
  defaultPicTime: string;
  defaultSicTime: string;
  defaultNightTime: string;
  defaultInstrumentTime: string;
  defaultRemarks: string;
  hasLogbookEntry: boolean;
};

export function LogbookEntryForm({
  flightId,
  participantId,
  defaultDate,
  defaultTotalTime,
  defaultPicTime,
  defaultSicTime,
  defaultNightTime,
  defaultInstrumentTime,
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
      <Input name="date" type="date" required defaultValue={defaultDate} />
      <Input
        name="totalTime"
        type="number"
        step="0.1"
        placeholder="Total time"
        defaultValue={defaultTotalTime}
      />
      <Input
        name="picTime"
        type="number"
        step="0.1"
        placeholder="PIC time"
        defaultValue={defaultPicTime}
      />
      <Input
        name="sicTime"
        type="number"
        step="0.1"
        placeholder="SIC time"
        defaultValue={defaultSicTime}
      />
      <Input
        name="nightTime"
        type="number"
        step="0.1"
        placeholder="Night time"
        defaultValue={defaultNightTime}
      />
      <Input
        name="instrumentTime"
        type="number"
        step="0.1"
        placeholder="Instrument time"
        defaultValue={defaultInstrumentTime}
      />
      <div className="lg:col-span-3">
        <label className="mb-2 block text-xs font-semibold uppercase text-slate-400">
          Remarks
        </label>
        <textarea
          name="remarks"
          className="min-h-[120px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
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
