"use client";

import { useMemo, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";

const ChecklistInputType = {
  CHECK: "CHECK",
  YES_NO: "YES_NO",
  NUMBER: "NUMBER",
  TEXT: "TEXT"
} as const;

const ChecklistRunStatus = {
  NOT_AVAILABLE: "NOT_AVAILABLE",
  IN_PROGRESS: "IN_PROGRESS",
  SIGNED: "SIGNED"
} as const;

type ChecklistInputType = (typeof ChecklistInputType)[keyof typeof ChecklistInputType];
type ChecklistRunStatus = (typeof ChecklistRunStatus)[keyof typeof ChecklistRunStatus];

export type ChecklistItemView = {
  id: string;
  order: number;
  title: string;
  details: string | null;
  required: boolean;
  inputType: ChecklistInputType;
  completed: boolean;
  valueText: string | null;
  valueNumber: number | null;
  valueYesNo: boolean | null;
  notes: string | null;
  completedAt: string | null;
};

export type ChecklistRunView = {
  id: string;
  phase: "PREFLIGHT" | "POSTFLIGHT";
  status: ChecklistRunStatus;
  startedAt: string | null;
  signedAt: string | null;
  signatureName: string | null;
  items: ChecklistItemView[];
};

type ChecklistSectionProps = {
  flightId: string;
  flightStatus: string;
  defaultSignatureName: string;
  preflightRun: ChecklistRunView | null;
  postflightRun: ChecklistRunView | null;
};

export function ChecklistSection({
  flightId,
  flightStatus,
  defaultSignatureName,
  preflightRun,
  postflightRun
}: ChecklistSectionProps) {
  const [activeTab, setActiveTab] = useState<"PREFLIGHT" | "POSTFLIGHT">(
    "PREFLIGHT"
  );
  const [signingPhase, setSigningPhase] = useState<
    "PREFLIGHT" | "POSTFLIGHT" | null
  >(null);

  const runs = useMemo(
    () => ({
      PREFLIGHT: preflightRun,
      POSTFLIGHT: postflightRun
    }),
    [preflightRun, postflightRun]
  );

  const activeRun = runs[activeTab];
  const preflightSigned = preflightRun?.status === ChecklistRunStatus.SIGNED;
  const postflightAvailable =
    postflightRun?.status !== ChecklistRunStatus.NOT_AVAILABLE ||
    flightStatus === "COMPLETED";
  const canStartPostflight = preflightSigned || flightStatus === "COMPLETED";

  const renderInput = (item: ChecklistItemView, disabled: boolean) => {
    if (item.inputType === ChecklistInputType.CHECK) {
      return (
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            name="valueCheck"
            defaultChecked={item.valueYesNo ?? false}
            disabled={disabled}
          />
          Marked
        </label>
      );
    }

    if (item.inputType === ChecklistInputType.YES_NO) {
      return (
        <div className="flex gap-4 text-sm text-slate-200">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="valueYesNo"
              value="yes"
              defaultChecked={item.valueYesNo === true}
              disabled={disabled}
            />
            Yes
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="valueYesNo"
              value="no"
              defaultChecked={item.valueYesNo === false}
              disabled={disabled}
            />
            No
          </label>
        </div>
      );
    }

    if (item.inputType === ChecklistInputType.NUMBER) {
      return (
        <Input
          name="valueNumber"
          type="number"
          step="0.1"
          defaultValue={item.valueNumber ?? ""}
          disabled={disabled}
        />
      );
    }

    return (
      <Input
        name="valueText"
        type="text"
        defaultValue={item.valueText ?? ""}
        disabled={disabled}
      />
    );
  };

  const renderChecklist = (
    run: ChecklistRunView | null,
    phase: "PREFLIGHT" | "POSTFLIGHT"
  ) => {
    if (!run) {
      return (
        <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
          No checklist template available yet.
        </div>
      );
    }

    if (phase === "POSTFLIGHT" && run.status === ChecklistRunStatus.NOT_AVAILABLE) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
            Post-flight checklist will be available after you start it.
          </div>
          {canStartPostflight && (
            <form
              action={`/api/flights/${flightId}/checklists/start-postflight`}
              method="post"
            >
              <FormSubmitButton type="submit" pendingText="Starting checklist...">
                Start Post-Flight Checklist
              </FormSubmitButton>
            </form>
          )}
        </div>
      );
    }

    const isLocked = run.status === ChecklistRunStatus.SIGNED;
    const requiredRemaining = run.items.filter(
      (item) => item.required && !item.completed
    ).length;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-400">
          <div>
            {run.status === ChecklistRunStatus.SIGNED
              ? `Signed${run.signedAt ? ` on ${new Date(run.signedAt).toLocaleString()}` : ""}`
              : run.startedAt
                ? `Started ${new Date(run.startedAt).toLocaleString()}`
                : "Not started"}
          </div>
          {run.signatureName ? (
            <div>Signed by {run.signatureName}</div>
          ) : null}
        </div>

        {run.items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
            No checklist items available.
          </div>
        ) : (
          <div className="space-y-4">
            {run.items.map((item) => (
              <form
                key={item.id}
                action={`/api/flights/${flightId}/checklists/update-item`}
                method="post"
                className="rounded-lg border border-slate-800 p-4"
              >
                <input type="hidden" name="itemId" value={item.id} />
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        {item.order}. {item.title}
                      </p>
                      {item.required ? (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
                          Required
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                          Optional
                        </span>
                      )}
                      {item.completed ? (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                          Complete
                        </span>
                      ) : null}
                    </div>
                    {item.details ? (
                      <p className="mt-1 text-xs text-slate-400">{item.details}</p>
                    ) : null}
                    {item.completedAt ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Completed {new Date(item.completedAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-start gap-3 md:items-end">
                    <div className="w-full md:w-64">{renderInput(item, isLocked)}</div>
                    <div className="w-full">
                      <label className="mb-1 block text-xs uppercase text-slate-400">
                        Notes
                      </label>
                      <textarea
                        name="notes"
                        className="min-h-[80px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-sm text-slate-100"
                        defaultValue={item.notes ?? ""}
                        disabled={isLocked}
                      />
                    </div>
                    {!isLocked ? (
                      <FormSubmitButton
                        type="submit"
                        size="sm"
                        pendingText="Saving item..."
                      >
                        {item.completed ? "Update item" : "Complete item"}
                      </FormSubmitButton>
                    ) : null}
                  </div>
                </div>
                <input type="hidden" name="complete" value="true" />
              </form>
            ))}
          </div>
        )}

        {isLocked ? null : (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
            <p>
              {requiredRemaining > 0
                ? `${requiredRemaining} required item${
                    requiredRemaining === 1 ? "" : "s"
                  } remaining before sign-off.`
                : "All required items are complete. You can sign when ready."}
            </p>
          </div>
        )}

        {!isLocked && (
          <Button
            type="button"
            onClick={() => setSigningPhase(phase)}
            variant="default"
          >
            {phase === "PREFLIGHT" ? "Sign Pre-Flight" : "Sign Post-Flight"}
          </Button>
        )}
      </div>
    );
  };

  const signingLabel = signingPhase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={activeTab === "PREFLIGHT" ? "default" : "outline"}
          onClick={() => setActiveTab("PREFLIGHT")}
        >
          Pre-Flight
        </Button>
        <Button
          type="button"
          variant={activeTab === "POSTFLIGHT" ? "default" : "outline"}
          onClick={() => setActiveTab("POSTFLIGHT")}
        >
          Post-Flight
        </Button>
        {activeTab === "POSTFLIGHT" && !postflightAvailable ? (
          <span className="self-center text-xs uppercase text-slate-500">
            Not available
          </span>
        ) : null}
      </div>

      {renderChecklist(activeRun, activeTab)}

      {signingPhase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-6">
            <h3 className="text-lg font-semibold text-slate-100">
              Sign {signingLabel}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Confirm your signature to lock the {signingLabel.toLowerCase()} checklist.
            </p>
            <form
              action={`/api/flights/${flightId}/checklists/${
                signingPhase === "PREFLIGHT" ? "sign-preflight" : "sign-postflight"
              }`}
              method="post"
              className="mt-4 grid gap-3"
            >
              <div>
                <label className="mb-1 block text-xs uppercase text-slate-400">
                  Signature name
                </label>
                <Input
                  name="signatureName"
                  defaultValue={defaultSignatureName}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-slate-400">
                  Password confirmation
                </label>
                <Input name="password" type="password" required />
              </div>
              <div className="flex flex-wrap gap-3">
                <FormSubmitButton type="submit" pendingText="Signing...">
                  Sign checklist
                </FormSubmitButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSigningPhase(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
