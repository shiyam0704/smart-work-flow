import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Pencil, Check, Trash2, ChevronsUpDown, Copy, Paperclip } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTasks, type TaskRow } from "@/hooks/use-tasks";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { useEmployees } from "@/hooks/use-employees";
import { useConfirm } from "@/components/app/confirm-dialog";
import { TaskDetailDialog } from "@/components/app/TaskDetailDialog";
import { useTaskModal } from "@/components/app/NewTaskModal";

const PRIORITIES: TaskRow["priority"][] = ["low", "medium", "high", "urgent"];

export function InlineTaskEditor({ task }: { task: TaskRow }) {
  const { updateTask, deleteTask, duplicateTask } = useTasks();
  const { openEdit } = useTaskModal();
  const { states } = useWorkflowStates();
  const { employees } = useEmployees();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [statusId, setStatusId] = useState(task.status_id);
  const [priority, setPriority] = useState<TaskRow["priority"]>(task.priority);
  const [dueDate, setDueDate] = useState<Date | undefined>(task.due_date ? new Date(task.due_date) : undefined);
  const [assignees, setAssignees] = useState<string[]>(task.assignee_ids);
  const [saving, setSaving] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const toggleAssignee = (id: string) =>
    setAssignees((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const filteredEmployees = useMemo(() => {
    const q = assigneeSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => e.name.toLowerCase().includes(q));
  }, [employees, assigneeSearch]);

  const save = async () => {
    setSaving(true);
    const ok = await updateTask(task.id, {
      status_id: statusId,
      priority,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      assignee_ids: assignees,
    });
    setSaving(false);
    if (ok) setOpen(false);
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete "${task.title}"?`,
      description: "This will permanently remove the task and its assignments.",
      requireType: "DELETE",
      destructive: true,
    });
    if (!ok) return;
    const done = await deleteTask(task.id);
    if (done) setOpen(false);
  };

  return (
    <>
    {detailOpen && <TaskDetailDialog task={task} open={detailOpen} onOpenChange={setDetailOpen} />}
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 hover:opacity-100" aria-label="Edit task">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 space-y-3" align="end">
        <div className="text-xs font-semibold text-muted-foreground">Edit task</div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={statusId ?? ""} onValueChange={(v) => setStatusId(v || null)}>
            <SelectTrigger className="h-8"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
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
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Priority</label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskRow["priority"])}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Due date</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full h-8 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                {dueDate && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); setDueDate(undefined); }}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                  >
                    clear
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Assignees</label>
          <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-8 justify-between font-normal">
                <span className="truncate">
                  {assignees.length === 0
                    ? "Select assignees"
                    : `${assignees.length} selected`}
                </span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 space-y-2" align="start">
              <Input
                placeholder="Search employee…"
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                className="h-8"
              />
              <div className="max-h-48 overflow-auto space-y-1">
                {filteredEmployees.length === 0 && (
                  <div className="text-xs text-muted-foreground p-2">No employees found.</div>
                )}
                {filteredEmployees.map((e) => {
                  const active = assignees.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleAssignee(e.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left",
                        active && "bg-accent"
                      )}
                    >
                      <span className="w-5 h-5 rounded-full bg-muted text-[10px] flex items-center justify-center font-bold">
                        {e.avatar || e.name.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="flex-1 truncate">{e.name}</span>
                      {active && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 justify-start font-normal gap-1.5 text-xs truncate"
            onClick={() => { setOpen(false); openEdit(task); }}
          >
            <Pencil className="w-3.5 h-3.5 shrink-0" /> Edit details
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 justify-start font-normal gap-1.5 text-xs truncate"
            onClick={() => { setOpen(false); setDetailOpen(true); }}
          >
            <Paperclip className="w-3.5 h-3.5 shrink-0" /> Attachments
          </Button>
        </div>

        <div className="flex items-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={saving}
            aria-label="Delete"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              const id = await duplicateTask(task.id);
              if (id) setOpen(false);
            }}
            disabled={saving}
            aria-label="Duplicate"
            className="h-8 w-8"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving} className="px-2">Cancel</Button>
            <Button size="sm" onClick={save} disabled={saving} className="px-3">{saving ? "Saving…" : "Save"}</Button>
          </div>
        </div>

      </PopoverContent>
    </Popover>
    </>
  );
}
