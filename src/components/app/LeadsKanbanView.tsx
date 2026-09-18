import { CLink as Link } from "@/lib/nav";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { STAGES, type LeadRow, type LeadStage } from "@/hooks/use-leads";
import { LeadCard, type StageMeta } from "@/components/app/LeadCard";

const PER_COLUMN = 10;

interface Props {
  leads: LeadRow[];
  stageMeta: Record<string, StageMeta>;
  filtersActive: boolean;
  canDrag: boolean;
  onDropToStage: (leadId: string, stage: LeadStage) => void;
}

export function LeadsKanbanView({ leads, stageMeta, filtersActive, canDrag, onDropToStage }: Props) {
  const byStage = useMemo(() => {
    const map: Record<LeadStage, LeadRow[]> = { new_lead: [], follow_up: [], quoted: [], closed: [] };
    for (const l of leads) map[l.current_stage].push(l);
    for (const k of Object.keys(map) as LeadStage[]) {
      map[k].sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at));
    }
    return map;
  }, [leads]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

  function handleStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleEnd(e: DragEndEvent) {
    setActiveId(null);
    const leadId = String(e.active.id);
    const overStage = e.over?.id ? String(e.over.id) : null;
    if (!overStage) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.current_stage === overStage) return;
    onDropToStage(leadId, overStage as LeadStage);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map((s) => {
          const all = byStage[s.id];
          const visible = s.id === "closed" ? all.filter((l) => !l.converted_client_id) : all;
          const shown = visible.slice(0, PER_COLUMN);
          return (
            <StageColumn key={s.id} stage={s.id} color={s.color} label={s.label} count={all.length}>
              {shown.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-8">
                  {filtersActive ? "No matches" : "No leads"}
                </div>
              )}
              {shown.map((lead) => (
                <DraggableCard key={lead.id} id={lead.id} enabled={canDrag}>
                  <LeadCard lead={lead} meta={stageMeta[lead.id]} />
                </DraggableCard>
              ))}
              {all.length > PER_COLUMN && (
                <Link
                  to="/c/$slug/leads/stage/$stage"
                  params={{ stage: s.id }}
                  className="block text-xs text-primary hover:underline text-center pt-2"
                >
                  View all {all.length} →
                </Link>
              )}
            </StageColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeLead ? (
          <div className="opacity-90 rotate-1 cursor-grabbing w-72">
            <LeadCard lead={activeLead} meta={stageMeta[activeLead.id]} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  color,
  label,
  count,
  children,
}: {
  stage: LeadStage;
  color: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={`glass rounded-xl border flex flex-col min-h-[300px] transition ${
        isOver ? "border-primary/60 bg-primary/5" : "border-glass-border"
      }`}
    >
      <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
        <Link
          to="/c/$slug/leads/stage/$stage"
          params={{ stage }}
          className="flex items-center gap-2 hover:text-primary transition"
        >
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-semibold text-sm underline-offset-4 hover:underline">{label}</span>
        </Link>
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