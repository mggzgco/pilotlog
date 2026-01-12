"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { FormSubmitButton } from "@/app/components/ui/form-submit-button";
import { formatDateTime24 } from "@/app/lib/utils";

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
type ChecklistDecision = "ACCEPTED" | "REJECTED";
type ChecklistItemKind = "SECTION" | "STEP";

type SaveStatus = "saved" | "saving" | "offline";

type ChecklistItemState = {
  valueText: string;
  valueNumber: string;
  valueYesNo: boolean | null;
  notes: string;
  completed: boolean;
};

type ChecklistSavePayload = {
  itemId: string;
  notes?: string;
  valueText?: string;
  valueNumber?: string;
  valueYesNo?: string;
  valueCheck?: string;
  complete?: string;
  clientUpdatedAt?: string;
};

export type ChecklistItemView = {
  id: string;
  order: number;
  kind: ChecklistItemKind;
  parentId: string | null;
  officialOrder: number;
  personalOrder: number;
  title: string;
  itemLabel?: string | null;
  acceptanceCriteria?: string | null;
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
  decision: ChecklistDecision | null;
  decisionNote: string | null;
  startedAt: string | null;
  signedAt: string | null;
  signatureName: string | null;
  items: ChecklistItemView[];
};

type ChecklistSectionProps = {
  flightId: string;
  flightStatus: string;
  aircraftId: string | null;
  defaultSignatureName: string;
  defaultTab?: "PREFLIGHT" | "POSTFLIGHT";
  preflightRun: ChecklistRunView | null;
  postflightRun: ChecklistRunView | null;
};

const createInitialState = (items: ChecklistItemView[]) =>
  items.reduce<Record<string, ChecklistItemState>>((acc, item) => {
    if (item.kind === "SECTION") {
      return acc;
    }
    acc[item.id] = {
      valueText: item.valueText ?? "",
      valueNumber:
        item.valueNumber === null || item.valueNumber === undefined
          ? ""
          : String(item.valueNumber),
      valueYesNo: item.valueYesNo ?? null,
      notes: item.notes ?? "",
      completed: item.completed
    };
    return acc;
  }, {});

const buildFormData = (payload: ChecklistSavePayload) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      formData.append(key, value);
    }
  });
  return formData;
};

export function ChecklistSection({
  flightId,
  flightStatus,
  aircraftId,
  defaultSignatureName,
  defaultTab,
  preflightRun,
  postflightRun
}: ChecklistSectionProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"PREFLIGHT" | "POSTFLIGHT">(
    defaultTab ?? "PREFLIGHT"
  );
  const [signingPhase, setSigningPhase] = useState<
    "PREFLIGHT" | "POSTFLIGHT" | null
  >(null);
  const [rejectingPhase, setRejectingPhase] = useState<
    "PREFLIGHT" | "POSTFLIGHT" | null
  >(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [closingPhase, setClosingPhase] = useState<
    "PREFLIGHT" | "POSTFLIGHT" | null
  >(null);
  const [closingNote, setClosingNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isOnline, setIsOnline] = useState(true);
  const [itemState, setItemState] = useState<Record<string, ChecklistItemState>>({});

  const pendingCountRef = useRef(0);
  const saveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const itemStateRef = useRef(itemState);
  const swipeStartRef = useRef<{
    itemId: string;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    itemStateRef.current = itemState;
  }, [itemState]);

  const runs = useMemo(
    () => ({
      PREFLIGHT: preflightRun,
      POSTFLIGHT: postflightRun
    }),
    [preflightRun, postflightRun]
  );

  const activeRun = runs[activeTab];
  const preflightSigned =
    preflightRun?.status === ChecklistRunStatus.SIGNED &&
    preflightRun.decision !== "REJECTED";
  const postflightAvailable =
    postflightRun?.status !== ChecklistRunStatus.NOT_AVAILABLE ||
    flightStatus === "COMPLETED";
  const canStartPostflight = preflightSigned || flightStatus === "COMPLETED";

  useEffect(() => {
    if (!activeRun) {
      return;
    }

    const initialState = createInitialState(activeRun.items);
    let mergedState = initialState;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(
        `checklist-draft:${flightId}:${activeRun.id}`
      );
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Record<string, ChecklistItemState>;
          mergedState = { ...initialState, ...parsed };
        } catch {
          mergedState = initialState;
        }
      }
    }

    setItemState(mergedState);
  }, [activeRun?.id, flightId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    updateOnlineStatus();
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setSaveStatus("offline");
    }
  }, [isOnline]);

  const getPendingKey = (runId: string) => `checklist-pending:${flightId}:${runId}`;
  const getDraftKey = (runId: string) => `checklist-draft:${flightId}:${runId}`;

  const readPending = (runId: string) => {
    if (typeof window === "undefined") {
      return {} as Record<string, ChecklistSavePayload>;
    }
    const stored = window.localStorage.getItem(getPendingKey(runId));
    if (!stored) {
      return {} as Record<string, ChecklistSavePayload>;
    }
    try {
      return JSON.parse(stored) as Record<string, ChecklistSavePayload>;
    } catch {
      return {} as Record<string, ChecklistSavePayload>;
    }
  };

  const writePending = (runId: string, pending: Record<string, ChecklistSavePayload>) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(getPendingKey(runId), JSON.stringify(pending));
  };

  const persistDraft = (runId: string, draft: Record<string, ChecklistItemState>) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(getDraftKey(runId), JSON.stringify(draft));
  };

  const saveItem = async (payload: ChecklistSavePayload, runId: string) => {
    if (!isOnline) {
      const pending = readPending(runId);
      pending[payload.itemId] = payload;
      writePending(runId, pending);
      setSaveStatus("offline");
      return;
    }

    pendingCountRef.current += 1;
    setSaveStatus("saving");

    try {
      const response = await fetch(`/api/flights/${flightId}/checklists/update-item`, {
        method: "POST",
        body: buildFormData(payload),
        headers: {
          "x-checklist-autosave": "true",
          accept: "application/json"
        }
      });

      if (response.status === 409) {
        const data = await response.json().catch(() => null);
        if (data?.status === "stale") {
          const pending = readPending(runId);
          if (pending[payload.itemId]) {
            delete pending[payload.itemId];
            writePending(runId, pending);
          }
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Failed to save checklist item");
      }

      const pending = readPending(runId);
      if (pending[payload.itemId]) {
        delete pending[payload.itemId];
        writePending(runId, pending);
      }
    } catch {
      const pending = readPending(runId);
      pending[payload.itemId] = payload;
      writePending(runId, pending);
      setSaveStatus("offline");
    } finally {
      pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
      if (pendingCountRef.current === 0 && isOnline) {
        setSaveStatus("saved");
      }
    }
  };

  const flushPending = async (runId: string) => {
    if (!isOnline) {
      return;
    }

    const pending = readPending(runId);
    const entries = Object.values(pending);
    if (entries.length === 0) {
      return;
    }

    setSaveStatus("saving");
    for (const payload of entries) {
      await saveItem(payload, runId);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    if (!activeRun) {
      return;
    }
    void flushPending(activeRun.id);
  }, [activeRun?.id, isOnline]);

  const activeItemsById = useMemo(() => {
    if (!activeRun) {
      return new Map<string, ChecklistItemView>();
    }
    return new Map(activeRun.items.map((item) => [item.id, item]));
  }, [activeRun]);

  const buildPayload = (
    item: ChecklistItemView,
    state: ChecklistItemState,
    complete?: boolean
  ): ChecklistSavePayload => {
    const payload: ChecklistSavePayload = {
      itemId: item.id,
      notes: state.notes,
      clientUpdatedAt: new Date().toISOString()
    };

    if (item.inputType === ChecklistInputType.CHECK) {
      // Tri-state toggle for CHECK:
      // - valueYesNo=yes => accepted (green)
      // - valueYesNo=no => rejected (red)
      // - valueYesNo="" => neutral (not completed)
      if (state.valueYesNo === true) payload.valueYesNo = "yes";
      else if (state.valueYesNo === false) payload.valueYesNo = "no";
      else payload.valueYesNo = "";
    }

    if (item.inputType === ChecklistInputType.YES_NO) {
      if (state.valueYesNo === true) {
        payload.valueYesNo = "yes";
      } else if (state.valueYesNo === false) {
        payload.valueYesNo = "no";
      } else {
        payload.valueYesNo = "";
      }
    }

    if (item.inputType === ChecklistInputType.NUMBER) {
      payload.valueNumber = state.valueNumber;
    }

    if (item.inputType === ChecklistInputType.TEXT) {
      payload.valueText = state.valueText;
    }

    if (complete !== undefined) {
      payload.complete = complete ? "true" : "false";
    }

    return payload;
  };

  const updateItemState = (
    itemId: string,
    updates: Partial<ChecklistItemState>,
    options?: { complete?: boolean; immediate?: boolean }
  ) => {
    const currentState = itemStateRef.current[itemId];
    const nextState: ChecklistItemState = {
      valueText: currentState?.valueText ?? "",
      valueNumber: currentState?.valueNumber ?? "",
      valueYesNo: currentState?.valueYesNo ?? null,
      notes: currentState?.notes ?? "",
      completed: currentState?.completed ?? false,
      ...updates
    };

    setItemState((prev) => {
      const next = { ...prev, [itemId]: nextState };
      if (activeRun) {
        persistDraft(activeRun.id, next);
      }
      return next;
    });

    if (!activeRun) {
      return;
    }

    const item = activeItemsById.get(itemId);
    if (!item) {
      return;
    }

    const payload = buildPayload(item, nextState, options?.complete ?? false);
    // Only send explicit completion when caller asked for it.
    // (Otherwise, completion for CHECK is derived from valueCheck server-side.)
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    options?.complete === undefined && delete payload.complete;

    if (options?.immediate) {
      void saveItem(payload, activeRun.id);
      return;
    }

    if (saveTimersRef.current[itemId]) {
      clearTimeout(saveTimersRef.current[itemId]);
    }

    saveTimersRef.current[itemId] = setTimeout(() => {
      void saveItem(payload, activeRun.id);
    }, 400);
  };

  const handleSwipeStart = (itemId: string, event: TouchEvent) => {
    if (event.touches.length === 0) {
      return;
    }
    const touch = event.touches[0];
    swipeStartRef.current = {
      itemId,
      startX: touch.clientX,
      startY: touch.clientY
    };
  };

  const handleSwipeEnd = (
    item: ChecklistItemView,
    disabled: boolean,
    event: TouchEvent
  ) => {
    if (disabled) {
      swipeStartRef.current = null;
      return;
    }
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.itemId !== item.id || event.changedTouches.length === 0) {
      return;
    }
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.startX;
    const deltaY = touch.clientY - start.startY;
    if (Math.abs(deltaX) < 70 || Math.abs(deltaY) > 40) {
      return;
    }

    if (item.inputType === ChecklistInputType.CHECK) {
      if (deltaX > 0) {
        updateItemState(
          item.id,
          { valueYesNo: true, completed: true },
          { complete: true, immediate: true }
        );
      } else {
        updateItemState(
          item.id,
          { valueYesNo: false, completed: true },
          { complete: true, immediate: true }
        );
      }
    }

    if (item.inputType === ChecklistInputType.YES_NO) {
      if (deltaX > 0) {
        updateItemState(
          item.id,
          { valueYesNo: itemStateRef.current[item.id]?.valueYesNo ?? true, completed: true },
          { complete: true, immediate: true }
        );
      } else {
        updateItemState(
          item.id,
          { valueYesNo: null, completed: false },
          { complete: false, immediate: true }
        );
      }
    }

    if (item.inputType === ChecklistInputType.NUMBER || item.inputType === ChecklistInputType.TEXT) {
      if (deltaX > 0) {
        updateItemState(item.id, { completed: true }, { complete: true, immediate: true });
      } else {
        updateItemState(item.id, { completed: false }, { complete: false, immediate: true });
      }
    }
  };

  const renderInput = (item: ChecklistItemView, disabled: boolean) => {
    const state = itemState[item.id];

    if (item.inputType === ChecklistInputType.CHECK) {
      const value = state?.valueYesNo ?? null;
      return (
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Outcome
          </div>
          <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <button
              type="button"
              disabled={disabled}
              className={[
                "px-3 py-2 text-xs font-semibold transition",
                value === false
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-200"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900",
                disabled ? "opacity-60" : ""
              ].join(" ")}
              onClick={() =>
                updateItemState(item.id, { valueYesNo: false, completed: true }, { complete: true, immediate: true })
              }
              aria-label="Mark rejected"
              title="Reject"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={disabled}
              className={[
                "px-3 py-2 text-xs font-semibold transition",
                value === null
                  ? "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900",
                disabled ? "opacity-60" : ""
              ].join(" ")}
              onClick={() =>
                updateItemState(item.id, { valueYesNo: null, completed: false }, { complete: false, immediate: true })
              }
              aria-label="Clear selection"
              title="Neutral"
            >
              —
            </button>
            <button
              type="button"
              disabled={disabled}
              className={[
                "px-3 py-2 text-xs font-semibold transition",
                value === true
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900",
                disabled ? "opacity-60" : ""
              ].join(" ")}
              onClick={() =>
                updateItemState(item.id, { valueYesNo: true, completed: true }, { complete: true, immediate: true })
              }
              aria-label="Mark accepted"
              title="Accept"
            >
              Accept
            </button>
          </div>
        </div>
      );
    }

    if (item.inputType === ChecklistInputType.YES_NO) {
      return (
        <div className="flex flex-wrap gap-3 text-base text-slate-200">
          <Button
            type="button"
            size="lg"
            variant={state?.valueYesNo === true ? "default" : "outline"}
            disabled={disabled}
            onClick={() => {
              updateItemState(
                item.id,
                { valueYesNo: true, completed: true },
                { complete: true, immediate: true }
              );
            }}
          >
            Yes
          </Button>
          <Button
            type="button"
            size="lg"
            variant={state?.valueYesNo === false ? "default" : "outline"}
            disabled={disabled}
            onClick={() => {
              updateItemState(
                item.id,
                { valueYesNo: false, completed: true },
                { complete: true, immediate: true }
              );
            }}
          >
            No
          </Button>
          <Button
            type="button"
            size="lg"
            variant="ghost"
            disabled={disabled || !(state?.completed ?? false)}
            onClick={() => {
              updateItemState(
                item.id,
                { valueYesNo: null, completed: false },
                { complete: false, immediate: true }
              );
            }}
          >
            Undo
          </Button>
        </div>
      );
    }

    if (item.inputType === ChecklistInputType.NUMBER) {
      return (
        <Input
          name={`valueNumber-${item.id}`}
          type="number"
          step="0.1"
          inputMode="decimal"
          className="h-12 text-base"
          value={state?.valueNumber ?? ""}
          disabled={disabled}
          onChange={(event) =>
            updateItemState(item.id, { valueNumber: event.target.value })
          }
        />
      );
    }

    // TEXT: allow data entry *and* explicit completion.
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Input
          name={`valueText-${item.id}`}
          type="text"
          className="h-12 flex-1 text-base"
          value={state?.valueText ?? ""}
          disabled={disabled}
          onChange={(event) => updateItemState(item.id, { valueText: event.target.value })}
        />
        <Button
          type="button"
          size="lg"
          variant={(state?.completed ?? false) ? "default" : "outline"}
          disabled={disabled}
          onClick={() => {
            const next = !(state?.completed ?? false);
            updateItemState(item.id, { completed: next }, { complete: next, immediate: true });
          }}
        >
          {(state?.completed ?? false) ? "Completed" : "Mark complete"}
        </Button>
      </div>
    );
  };

  const renderChecklist = (
    run: ChecklistRunView | null,
    phase: "PREFLIGHT" | "POSTFLIGHT"
  ) => {
    if (!run) {
      return (
        <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
          <p>No checklist template available yet.</p>
          {aircraftId ? (
            <Link
              className="mt-2 inline-flex text-sm font-semibold text-brand-400"
              href={`/aircraft/${aircraftId}`}
            >
              Assign an aircraft checklist
            </Link>
          ) : null}
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

    const runStarted = Boolean(run.startedAt);

    // Single ordering: automatic numbering based on the current personal order (or legacy order).
    const getSortKey = (item: ChecklistItemView) => item.personalOrder ?? item.order;

    const topLevelItems = run.items
      .filter((item) => !item.parentId)
      .sort((a, b) => getSortKey(a) - getSortKey(b));
    const childrenByParent = run.items.reduce<Record<string, ChecklistItemView[]>>(
      (acc, item) => {
        if (item.parentId) {
          acc[item.parentId] ??= [];
          acc[item.parentId].push(item);
        }
        return acc;
      },
      {}
    );
    Object.values(childrenByParent).forEach((children) =>
      children.sort((a, b) => getSortKey(a) - getSortKey(b))
    );

    const informationalSections = topLevelItems.filter(
      (item) => item.kind === "SECTION" && (childrenByParent[item.id]?.length ?? 0) === 0
    );
    const numberedTopLevelItems = topLevelItems.filter(
      (item) => item.kind !== "SECTION" || (childrenByParent[item.id]?.length ?? 0) > 0
    );

    const displayRows: Array<{ item: ChecklistItemView; depth: 0 | 1; prefix?: string }> = [];
    let topIndex = 0;
    for (const item of numberedTopLevelItems) {
      topIndex += 1;
      if (item.kind === "SECTION") {
        displayRows.push({ item, depth: 0, prefix: `${topIndex}` });
        const children = childrenByParent[item.id] ?? [];
        children.forEach((child, index) => {
          displayRows.push({
            item: child,
            depth: 1,
            prefix: `${topIndex}.${index + 1}`
          });
        });
      } else {
        // Root step (no section)
        displayRows.push({ item, depth: 0, prefix: `${topIndex}` });
      }
    }

    const isLocked = run.status === ChecklistRunStatus.SIGNED;
    const remainingAll = run.items
      .filter((item) => item.kind !== "SECTION")
      .filter((item) => {
        const state = itemState[item.id];
        const completed = state?.completed ?? item.completed;
        const valueYesNo = state?.valueYesNo ?? item.valueYesNo;
        if (item.inputType === ChecklistInputType.CHECK || item.inputType === ChecklistInputType.YES_NO) {
          return valueYesNo === null;
        }
        return !completed;
      }).length;

    const remainingRequired = run.items
      .filter((item) => item.kind !== "SECTION" && item.required)
      .filter((item) => {
        const state = itemState[item.id];
        const completed = state?.completed ?? item.completed;
        const valueYesNo = state?.valueYesNo ?? item.valueYesNo;
        if (item.inputType === ChecklistInputType.CHECK || item.inputType === ChecklistInputType.YES_NO) {
          return valueYesNo === null;
        }
        return !completed;
      }).length;

    return (
      <div className="space-y-4">
        {!runStarted ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
              Checklist is ready to start. Items are read-only until you start it.
            </div>
            <form
              action={`/api/flights/${flightId}/checklists/${
                phase === "PREFLIGHT" ? "start-preflight" : "start-postflight"
              }`}
              method="post"
            >
              <FormSubmitButton type="submit" pendingText="Starting checklist...">
                Start {phase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight"} Checklist
              </FormSubmitButton>
            </form>
          </div>
        ) : null}

        {informationalSections.length > 0 ? (
          <div className="space-y-3">
            {informationalSections.map((section) => (
              <div
                key={section.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  {section.title}
                </p>
                {section.details ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {section.details}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {phase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight"} checklist
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {run.status === ChecklistRunStatus.SIGNED
                ? `${run.decision === "REJECTED" ? "Rejected" : run.decision === "ACCEPTED" ? "Accepted" : "Signed"}${
                    run.signedAt && isMounted
                      ? ` · ${formatDateTime24(new Date(run.signedAt))}`
                      : ""
                  }`
                : run.startedAt
                  ? isMounted
                    ? `Started · ${formatDateTime24(new Date(run.startedAt))}`
                    : "Started"
                  : "Not started"}
              {run.signatureName ? ` · Signed by ${run.signatureName}` : ""}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
              run.status === ChecklistRunStatus.SIGNED
                ? run.decision === "REJECTED"
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-200"
                  : run.decision === "ACCEPTED"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                : "bg-brand-500/15 text-brand-700 dark:text-brand-200"
            }`}
          >
            {run.status === ChecklistRunStatus.SIGNED
              ? run.decision === "REJECTED"
                ? "Rejected"
                : run.decision === "ACCEPTED"
                  ? "Accepted"
                  : "Signed"
              : "In progress"}
          </span>
        </div>

        {run.status === ChecklistRunStatus.SIGNED ? (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              run.decision === "REJECTED"
                ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
                : run.decision === "ACCEPTED"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                  : "border-slate-700 bg-slate-900/50 text-slate-200"
            }`}
          >
            <p className="font-semibold">
              {run.decision === "REJECTED"
                ? "Checklist rejected"
                : run.decision === "ACCEPTED"
                  ? "Checklist accepted"
                  : "Checklist signed"}
            </p>
            {run.decisionNote ? (
              <p className="mt-1 text-xs text-rose-100/80">{run.decisionNote}</p>
            ) : null}
          </div>
        ) : null}

        {displayRows.filter((row) => row.item.kind !== "SECTION").length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
            <p>No checklist items available.</p>
            {aircraftId ? (
              <Link
                className="mt-2 inline-flex text-sm font-semibold text-brand-400"
                href={`/aircraft/${aircraftId}`}
              >
                Assign an aircraft checklist
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {displayRows.map((row) => {
              const item = row.item;
              if (item.kind === "SECTION") {
                return (
                  <div
                    key={item.id}
                    className="sticky top-2 z-10 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/90"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      {row.prefix ? `${row.prefix}. ${item.title}` : item.title}
                    </p>
                    {item.details ? (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{item.details}</p>
                    ) : null}
                  </div>
                );
              }

              const state = itemState[item.id];
              const completed = state?.completed ?? item.completed;
              const valueYesNo = state?.valueYesNo ?? item.valueYesNo;
              const isDisabled = isLocked || !runStarted;

              return (
                <div
                  key={item.id}
                  onTouchStart={(event) => handleSwipeStart(item.id, event)}
                  onTouchEnd={(event) => handleSwipeEnd(item, isDisabled, event)}
                  className={`touch-pan-y rounded-xl border p-4 shadow-sm transition ${
                    valueYesNo === true
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                      : valueYesNo === false
                        ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
                  }`}
                >
                  <div className="grid gap-3 md:grid-cols-[1fr,280px] md:items-start">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {row.prefix}
                        </span>
                        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                          {item.itemLabel?.trim() || item.title}
                        </p>
                        {item.acceptanceCriteria ? (
                          <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-700 dark:text-brand-200">
                            {item.acceptanceCriteria}
                          </span>
                        ) : null}
                        {item.required ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Required
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                            Optional
                          </span>
                        )}
                        {valueYesNo === true ? (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-200">
                            Accepted
                          </span>
                        ) : valueYesNo === false ? (
                          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-700 dark:text-rose-200">
                            Rejected
                          </span>
                        ) : completed ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Done
                          </span>
                        ) : null}
                      </div>
                      {item.details ? (
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.details}</p>
                      ) : null}
                      {item.completedAt ? (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                          Completed {formatDateTime24(new Date(item.completedAt))}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                        {renderInput(item, isDisabled)}
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Tip: swipe right to accept · swipe left to reject
                        </p>
                      </div>
                      <details className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase text-slate-600 dark:text-slate-300">
                            Notes
                          </summary>
                          <div className="p-3">
                            <textarea
                              name={`notes-${item.id}`}
                              className="min-h-[96px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-base text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                              value={state?.notes ?? ""}
                              disabled={isDisabled}
                              onChange={(event) =>
                                updateItemState(item.id, { notes: event.target.value })
                              }
                            />
                          </div>
                        </details>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isLocked ? null : (
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
            <p>
              {remainingAll > 0
                ? `${remainingAll} item${remainingAll === 1 ? "" : "s"} remaining before sign-off.`
                : "All items have an outcome. You can sign when ready."}
            </p>
          </div>
        )}

      </div>
    );
  };

  const signingLabel = signingPhase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight";
  const closingLabel = closingPhase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight";

  const totalItems =
    activeRun?.items.filter((item) => item.kind !== "SECTION").length ?? 0;
  const completedItems =
    activeRun?.items
      .filter((item) => item.kind !== "SECTION")
      .filter((item) => {
        const state = itemState[item.id];
        const completed = state?.completed ?? item.completed;
        const valueYesNo = state?.valueYesNo ?? item.valueYesNo;
        if (item.inputType === ChecklistInputType.CHECK || item.inputType === ChecklistInputType.YES_NO) {
          return valueYesNo !== null;
        }
        return completed;
      }).length ?? 0;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const remainingAll =
    activeRun?.items
      .filter((item) => item.kind !== "SECTION")
      .filter((item) => {
        const state = itemState[item.id];
        const completed = state?.completed ?? item.completed;
        const valueYesNo = state?.valueYesNo ?? item.valueYesNo;
        if (item.inputType === ChecklistInputType.CHECK || item.inputType === ChecklistInputType.YES_NO) {
          return valueYesNo === null;
        }
        return !completed;
      }).length ?? 0;

  const hasRejectedItems =
    activeRun?.items
      .filter((item) => item.kind !== "SECTION")
      .some((item) => (itemState[item.id]?.valueYesNo ?? item.valueYesNo) === false) ?? false;

  const isChecklistLocked = activeRun?.status === ChecklistRunStatus.SIGNED;
  const isChecklistStarted = Boolean(activeRun?.startedAt);
  const canDecide =
    activeRun?.status === ChecklistRunStatus.IN_PROGRESS && !isChecklistLocked && isChecklistStarted;
  const canShowSignoff = Boolean(canDecide && remainingAll === 0);
  const canAccept = Boolean(canShowSignoff && !hasRejectedItems);
  const showDecisionFooter =
    Boolean(activeRun) && activeRun?.status !== ChecklistRunStatus.NOT_AVAILABLE;

  const statusLabel =
    saveStatus === "offline"
      ? "Offline — will sync"
      : saveStatus === "saving"
        ? "Saving..."
        : "Saved";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          variant={activeTab === "PREFLIGHT" ? "default" : "outline"}
          onClick={() => setActiveTab("PREFLIGHT")}
        >
          Pre-Flight
        </Button>
        <Button
          type="button"
          size="lg"
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
        <span
          className={`self-center rounded-full px-3 py-1 text-xs font-semibold uppercase ${
            saveStatus === "offline"
              ? "bg-amber-500/20 text-amber-200"
              : saveStatus === "saving"
                ? "bg-sky-500/20 text-sky-200"
                : "bg-emerald-500/20 text-emerald-200"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {renderChecklist(activeRun, activeTab)}

      {showDecisionFooter && activeRun && isChecklistStarted ? (
        <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="h-1 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-1 rounded-full bg-brand-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {completedItems}/{totalItems} decided · {statusLabel}
              </p>
            </div>
            {!isChecklistLocked && canShowSignoff ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!canAccept}
                  onClick={() => setSigningPhase(activeRun.phase)}
                >
                  Accept & Sign
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRejectionNote("");
                    setRejectingPhase(activeRun.phase);
                  }}
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {rejectingPhase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-6">
            <h3 className="text-lg font-semibold text-slate-100">
              Reject {rejectingPhase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight"}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              Add a rejection note and confirm your signature to lock the checklist.
            </p>
            <form
              action={`/api/flights/${flightId}/checklists/${
                rejectingPhase === "PREFLIGHT" ? "reject-preflight" : "reject-postflight"
              }`}
              method="post"
              className="mt-4 grid gap-3"
            >
              <div>
                <label className="mb-1 block text-xs uppercase text-slate-400">
                  Rejection note
                </label>
                <textarea
                  name="rejectionNote"
                  className="min-h-[140px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-base text-slate-100"
                  value={rejectionNote}
                  onChange={(event) => setRejectionNote(event.target.value)}
                  required
                />
              </div>
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
                <FormSubmitButton type="submit" pendingText="Rejecting...">
                  Reject checklist
                </FormSubmitButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRejectingPhase(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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

      {closingPhase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-950 p-6">
            <h3 className="text-lg font-semibold text-slate-100">
              Close {closingLabel} checklist
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              This closes the checklist without completing all items. You can still continue the flight workflow.
            </p>
            <form
              action={`/api/flights/${flightId}/checklists/${
                closingPhase === "PREFLIGHT" ? "close-preflight" : "close-postflight"
              }`}
              method="post"
              className="mt-4 grid gap-3"
            >
              <div>
                <label className="mb-1 block text-xs uppercase text-slate-400">
                  Note (optional)
                </label>
                <textarea
                  name="note"
                  className="min-h-[120px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-base text-slate-100"
                  value={closingNote}
                  onChange={(event) => setClosingNote(event.target.value)}
                />
              </div>
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
              <div className="flex flex-wrap gap-3">
                <FormSubmitButton type="submit" pendingText="Closing...">
                  Close checklist
                </FormSubmitButton>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClosingPhase(null)}
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
