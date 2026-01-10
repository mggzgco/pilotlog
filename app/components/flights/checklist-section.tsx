"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
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
  preflightRun,
  postflightRun
}: ChecklistSectionProps) {
  const [activeTab, setActiveTab] = useState<"PREFLIGHT" | "POSTFLIGHT">(
    "PREFLIGHT"
  );
  const [orderMode, setOrderMode] = useState<"personal" | "official">("personal");
  const [signingPhase, setSigningPhase] = useState<
    "PREFLIGHT" | "POSTFLIGHT" | null
  >(null);
  const [rejectingPhase, setRejectingPhase] = useState<
    "PREFLIGHT" | "POSTFLIGHT" | null
  >(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isOnline, setIsOnline] = useState(true);
  const [itemState, setItemState] = useState<Record<string, ChecklistItemState>>({});

  const focusOverrideRef = useRef(false);
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
    setActiveItemId(activeRun.items.find((item) => item.kind !== "SECTION")?.id ?? null);
  }, [activeRun?.id, flightId]);

  useEffect(() => {
    if (activeRun?.status === ChecklistRunStatus.IN_PROGRESS && !focusOverrideRef.current) {
      setIsFocusMode(true);
    }
  }, [activeRun?.status]);

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
    if (typeof window === "undefined") {
      return;
    }

    if (isFocusMode) {
      document.body.classList.add("checklist-focus");
    } else {
      document.body.classList.remove("checklist-focus");
    }

    return () => {
      document.body.classList.remove("checklist-focus");
    };
  }, [isFocusMode]);

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
    complete = false
  ): ChecklistSavePayload => {
    const payload: ChecklistSavePayload = {
      itemId: item.id,
      notes: state.notes,
      clientUpdatedAt: new Date().toISOString()
    };

    if (item.inputType === ChecklistInputType.CHECK) {
      payload.valueCheck = state.valueYesNo ? "on" : "";
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

    if (complete) {
      payload.complete = "true";
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
          { valueYesNo: false, completed: false },
          { immediate: true }
        );
      }
    }

    if (item.inputType === ChecklistInputType.YES_NO) {
      updateItemState(
        item.id,
        { valueYesNo: deltaX > 0, completed: true },
        { complete: true, immediate: true }
      );
    }
  };

  const renderInput = (item: ChecklistItemView, disabled: boolean) => {
    const state = itemState[item.id];

    if (item.inputType === ChecklistInputType.CHECK) {
      return (
        <label className="flex min-h-12 items-center gap-4 text-base font-medium text-slate-100">
          <input
            type="checkbox"
            name="valueCheck"
            className="h-7 w-7 rounded border-slate-600"
            checked={state?.valueYesNo ?? false}
            disabled={disabled}
            onChange={(event) => {
              updateItemState(
                item.id,
                { valueYesNo: event.target.checked },
                { immediate: true }
              );
            }}
          />
          Checked
        </label>
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

    return (
      <Input
        name={`valueText-${item.id}`}
        type="text"
        className="h-12 text-base"
        value={state?.valueText ?? ""}
        disabled={disabled}
        onChange={(event) => updateItemState(item.id, { valueText: event.target.value })}
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

    if (
      phase === "PREFLIGHT" &&
      run.status === ChecklistRunStatus.IN_PROGRESS &&
      !run.startedAt
    ) {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-slate-800 p-4 text-sm text-slate-400">
            Pre-flight checklist is ready to start.
          </div>
          <form
            action={`/api/flights/${flightId}/checklists/start-preflight`}
            method="post"
          >
            <FormSubmitButton type="submit" pendingText="Starting checklist...">
              Start Pre-Flight Checklist
            </FormSubmitButton>
          </form>
        </div>
      );
    }

    const getSortKey = (item: ChecklistItemView) =>
      orderMode === "official"
        ? item.officialOrder ?? item.order
        : item.personalOrder ?? item.order;

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

    const displayRows: Array<{ item: ChecklistItemView; depth: 0 | 1; prefix?: string }> = [];
    let topIndex = 0;
    for (const item of topLevelItems) {
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
    const requiredRemaining = run.items
      .filter((item) => item.kind !== "SECTION")
      .filter((item) => {
      const state = itemState[item.id];
      const completed = state?.completed ?? item.completed;
      return item.required && !completed;
    }).length;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-slate-400">
          <div>
            {run.status === ChecklistRunStatus.SIGNED
              ? `${run.decision === "REJECTED" ? "Rejected" : run.decision === "ACCEPTED" ? "Accepted" : "Signed"}${
                  run.signedAt ? ` on ${new Date(run.signedAt).toLocaleString()}` : ""
                }`
              : run.startedAt
                ? `Started ${new Date(run.startedAt).toLocaleString()}`
                : "Not started"}
          </div>
          {run.signatureName ? <div>Signed by {run.signatureName}</div> : null}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Order
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={orderMode === "personal" ? "default" : "outline"}
              onClick={() => setOrderMode("personal")}
            >
              Personal
            </Button>
            <Button
              type="button"
              size="sm"
              variant={orderMode === "official" ? "default" : "outline"}
              onClick={() => setOrderMode("official")}
            >
              Official
            </Button>
          </div>
        </div>

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
          <div className="space-y-4">
            {displayRows.map((row) => {
              const item = row.item;
              if (item.kind === "SECTION") {
                return (
                  <div
                    key={item.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/30 px-4 py-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      {row.prefix ? `${row.prefix}. ${item.title}` : item.title}
                    </p>
                    {item.details ? (
                      <p className="mt-1 text-xs text-slate-400">{item.details}</p>
                    ) : null}
                  </div>
                );
              }

              const state = itemState[item.id];
              const completed = state?.completed ?? item.completed;
              const isActive = activeItemId === item.id;
              const isDisabled = isLocked;

              return (
                <div
                  key={item.id}
                  onClick={() => setActiveItemId(item.id)}
                  onTouchStart={(event) => handleSwipeStart(item.id, event)}
                  onTouchEnd={(event) => handleSwipeEnd(item, isDisabled, event)}
                  className={`touch-pan-y rounded-lg border border-slate-800 p-4 transition ${
                    isActive && isFocusMode ? "border-brand-500/70 bg-slate-900/70" : ""
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold text-slate-100">
                          {row.prefix ? `${row.prefix} ` : ""}{item.itemLabel?.trim() || item.title}
                        </p>
                        {item.acceptanceCriteria ? (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-200">
                            {item.acceptanceCriteria}
                          </span>
                        ) : null}
                        {item.required ? (
                          <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
                            Required
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-400">
                            Optional
                          </span>
                        )}
                        {completed ? (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-200">
                            Complete
                          </span>
                        ) : null}
                      </div>
                      {item.details ? (
                        <p className="text-sm text-slate-400">{item.details}</p>
                      ) : null}
                      {item.completedAt ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Completed {new Date(item.completedAt).toLocaleString()}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-start gap-4 lg:items-end">
                      <div className="w-full lg:w-72">{renderInput(item, isDisabled)}</div>
                      <div className="w-full">
                        <label className="mb-1 block text-xs uppercase text-slate-400">
                          Notes
                        </label>
                        <textarea
                          name={`notes-${item.id}`}
                          className="min-h-[120px] w-full rounded-md border border-slate-800 bg-transparent px-3 py-2 text-base text-slate-100"
                          value={state?.notes ?? ""}
                          disabled={isDisabled}
                          onChange={(event) =>
                            updateItemState(item.id, { notes: event.target.value })
                          }
                        />
                      </div>
                      {!isLocked && !isFocusMode ? (
                        <Button
                          type="button"
                          size="lg"
                          onClick={() =>
                            updateItemState(
                              item.id,
                              { completed: true },
                              { complete: true, immediate: true }
                            )
                          }
                        >
                          {completed ? "Update item" : "Complete item"}
                        </Button>
                      ) : null}
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
              {requiredRemaining > 0
                ? `${requiredRemaining} required item${
                    requiredRemaining === 1 ? "" : "s"
                  } remaining before sign-off.`
                : "All required items are complete. You can sign when ready."}
            </p>
          </div>
        )}

      </div>
    );
  };

  const signingLabel = signingPhase === "PREFLIGHT" ? "Pre-Flight" : "Post-Flight";

  const totalItems = activeRun?.items.length ?? 0;
  const completedItems =
    activeRun?.items.filter((item) => itemState[item.id]?.completed ?? item.completed)
      .length ?? 0;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const requiredRemaining =
    activeRun?.items.filter((item) => {
      const state = itemState[item.id];
      const completed = state?.completed ?? item.completed;
      return item.required && !completed;
    }).length ?? 0;

  const isChecklistLocked = activeRun?.status === ChecklistRunStatus.SIGNED;
  const canDecide =
    activeRun?.status === ChecklistRunStatus.IN_PROGRESS && !isChecklistLocked;
  const canAccept = Boolean(canDecide && requiredRemaining === 0);
  const showDecisionFooter =
    Boolean(activeRun) && activeRun?.status !== ChecklistRunStatus.NOT_AVAILABLE;

  const handleFocusToggle = () => {
    focusOverrideRef.current = true;
    setIsFocusMode((prev) => !prev);
  };

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
        <Button
          type="button"
          size="lg"
          variant={isFocusMode ? "default" : "outline"}
          onClick={handleFocusToggle}
        >
          {isFocusMode ? "Exit Focus Mode" : "Checklist Focus Mode"}
        </Button>
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

      {isFocusMode && activeRun ? (
        <div className="sticky top-0 z-30 rounded-lg border border-slate-800 bg-slate-950/95 p-4 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">Checklist Progress</p>
              <p className="text-xs text-slate-400">
                {completedItems}/{totalItems} items complete
              </p>
            </div>
            <div className="text-xs uppercase text-slate-500">{activeRun.phase}</div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-brand-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {renderChecklist(activeRun, activeTab)}

      {showDecisionFooter && activeRun ? (
        <div className="sticky bottom-0 z-30 rounded-t-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
              <div>
                <p className="font-semibold text-slate-100">Checklist progress</p>
                <p className="text-xs text-slate-400">
                  {completedItems}/{totalItems} complete ·{" "}
                  {requiredRemaining === 0
                    ? "All required items done"
                    : `${requiredRemaining} required remaining`}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
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
            <div className="h-2 w-full rounded-full bg-slate-800">
              <div
                className="h-2 rounded-full bg-brand-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {isChecklistLocked ? (
              <p className="text-xs text-slate-400">
                Checklist is locked and read-only.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  type="button"
                  size="lg"
                  disabled={!canAccept}
                  onClick={() => setSigningPhase(activeRun.phase)}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={!canDecide}
                  onClick={() => {
                    setRejectionNote("");
                    setRejectingPhase(activeRun.phase);
                  }}
                >
                  Reject
                </Button>
              </div>
            )}
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
    </div>
  );
}
