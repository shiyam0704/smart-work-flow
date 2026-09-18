import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { DEADLINE_PRESETS, type DeadlinePreset } from "@/lib/task-status";

export interface TaskFiltersValue {
  status: string; // workflow state id or "all"
  deadline: DeadlinePreset;
}

export const DEFAULT_TASK_FILTERS: TaskFiltersValue = { status: "all", deadline: "all" };

export function TaskFilters({
  value,
  onChange,
}: {
  value: TaskFiltersValue;
  onChange: (v: TaskFiltersValue) => void;
}) {
  const { states } = useWorkflowStates();
  const dirty = value.status !== "all" || value.deadline !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v })}>
        <SelectTrigger className="h-9 w-[180px] bg-input border-border">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {states.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.deadline}
        onValueChange={(v) => onChange({ ...value, deadline: v as DeadlinePreset })}
      >
        <SelectTrigger className="h-9 w-[180px] bg-input border-border">
          <SelectValue placeholder="Deadline" />
        </SelectTrigger>
        <SelectContent>
          {DEADLINE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dirty && (
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_TASK_FILTERS)}>
          <X className="w-3.5 h-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
