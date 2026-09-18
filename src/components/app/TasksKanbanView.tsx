import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { PriorityDot } from "@/components/app/StatusBadge";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { useDepartments } from "@/hooks/use-departments";
import { useClientsData } from "@/hooks/use-clients-data";
import { isCompletedStateName } from "@/lib/task-status";
import type { TaskRow } from "@/hooks/use-tasks";

interface Props {
  tasks: TaskRow[];
  canDrag: boolean;
  onOpen: (t: TaskRow) => void;
  onStatusChange: (id: string, statusId: string) => void;
}

export function TasksKanbanView({ tasks, canDrag, onOpen, onStatusChange }: Props) {
  const { states } = useWorkflowStates();
  const { departments } = useDepartments();
  const { clients } = useClientsData();

  const activeStates = states
    .filter((s) => !isCompletedStateName(s.name))
    .sort((a, b) => a.sort_order - b.sort_order);

  const byState: Record<string, TaskRow[]> = {};
  for (const s of activeStates) byState[s.id] = [];
  const unassigned: TaskRow[] = [];
  for (const t of tasks) {
    if (t.status_id && byState[t.status_id]) byState[t.status_id].push(t);
    else if (!t.status_id) unassigned.push(t);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status_id === overId) return;
    onStatusChange(id, overId);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {activeStates.map((s) => {
          const list = byState[s.id] ?? [];
          return (
            <Column key={s.id} id={s.id} color={s.color} name={s.name} count={list.length}>
              {list.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-8">No tasks</div>
              )}
              {list.map((t) => {
                const d = departments.find((x) => x.id === t.department_id);
                const c = clients.find((x) => x.id === t.client_id);
                return (
                  <DraggableCard key={t.id} id={t.id} enabled={canDrag}>
                    <button
                      type="button"
                      onClick={() => onOpen(t)}
                      className="w-full text-left glass rounded-lg p-3 hover:bg-white/5 transition border border-glass-border"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-1 self-stretch rounded-full" style={{ background: d?.color ?? "var(--muted)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{t.title}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {c?.name ?? "Personal"} · {d?.name ?? "—"}
                          </div>
                          <div className="flex items-center gap-2 pt-1.5">
                            <PriorityDot priority={t.priority} />
                            <span className="text-[11px] text-muted-foreground">{t.due_date ?? "—"}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </DraggableCard>
                );
              })}
            </Column>
          );
        })}
        {unassigned.length > 0 && (
          <Column id="__none__" color="var(--muted)" name="No status" count={unassigned.length} droppable={false}>
            {unassigned.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpen(t)}
                className="w-full text-left glass rounded-lg p-3 hover:bg-white/5 transition border border-glass-border"
              >
                <div className="font-medium text-sm truncate">{t.title}</div>
              </button>
            ))}
          </Column>
        )}
      </div>
    </DndContext>
  );
}

function Column({
  id,
  color,
  name,
  count,
  children,
  droppable = true,
}: {
  id: string;
  color: string;
  name: string;
  count: number;
  children: React.ReactNode;
  droppable?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !droppable });
  return (
    <div
      ref={setNodeRef}
      className={`glass rounded-xl border flex flex-col min-h-[300px] transition ${
        isOver ? "border-primary/60 bg-primary/5" : "border-glass-border"
      }`}
    >
      <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-sm">{name}</span>
        </div>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="p-3 space-y-2 flex-1">{children}</div>
    </div>
  );
}

function DraggableCard({ id, enabled, children }: { id: string; enabled: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, disabled: !enabled });
  return (
    <div
      ref={setNodeRef}
      {...(enabled ? attributes : {})}
      {...(enabled ? listeners : {})}
      className={`${enabled ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-40" : ""}`}
    >
      {children}
    </div>
  );
}