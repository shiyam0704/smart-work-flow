import { endOfMonth, isAfter, isBefore, isToday, parseISO, startOfToday } from "date-fns";
import type { TaskRow } from "@/hooks/use-tasks";

export type DeadlinePreset = "all" | "overdue" | "today" | "week" | "month" | "none";

export const DEADLINE_PRESETS: { value: DeadlinePreset; label: string }[] = [
  { value: "all", label: "All deadlines" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "none", label: "No due date" },
];

export function matchesDeadline(dueDate: string | null, preset: DeadlinePreset): boolean {
  if (preset === "all") return true;
  if (preset === "none") return !dueDate;
  if (!dueDate) return false;
  const d = parseISO(dueDate);
  const today = startOfToday();
  if (preset === "overdue") return isBefore(d, today);
  if (preset === "today") return isToday(d);
  if (preset === "week") {
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    return !isBefore(d, today) && !isAfter(d, in7);
  }
  if (preset === "month") {
    return !isBefore(d, today) && !isAfter(d, endOfMonth(today));
  }
  return true;
}

export interface WorkflowStateLike {
  id: string;
  name: string;
  is_completed?: boolean;
}

const COMPLETED_NAMES = new Set(["done", "complete", "completed", "closed"]);

export function isCompletedState(state: WorkflowStateLike | null | undefined): boolean {
  if (!state) return false;
  if (typeof state.is_completed === "boolean") return state.is_completed;
  return isCompletedStateName(state.name);
}

export function isCompletedStateName(name: string | null | undefined): boolean {
  if (!name) return false;
  return COMPLETED_NAMES.has(name.trim().toLowerCase());
}

export function isCompletedStatusId(
  statusId: string | null | undefined,
  states: WorkflowStateLike[],
): boolean {
  if (!statusId) return false;
  const s = states.find((x) => x.id === statusId);
  return isCompletedState(s);
}

export function getDefaultActiveState<T extends WorkflowStateLike>(states: T[]): T | undefined {
  if (!states || states.length === 0) return undefined;
  return states.find((s) => !isCompletedState(s)) ?? states[0];
}

export function splitTasksByCompletion<T extends Pick<TaskRow, "status_id">>(
  tasks: T[],
  states: WorkflowStateLike[],
): { active: T[]; completed: T[] } {
  const completedIds = new Set(
    states.filter((s) => isCompletedState(s)).map((s) => s.id),
  );
  const active: T[] = [];
  const completed: T[] = [];
  for (const t of tasks) {
    if (t.status_id && completedIds.has(t.status_id)) completed.push(t);
    else active.push(t);
  }
  return { active, completed };
}
