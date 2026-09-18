import { useMemo, useState } from "react";
import { CLink as Link } from "@/lib/nav";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STAGES, type LeadRow } from "@/hooks/use-leads";
import type { StageMeta } from "@/components/app/LeadCard";

export type CalMode = "month" | "week" | "agenda";

interface Props {
  leads: LeadRow[];
  stageMeta: Record<string, StageMeta>;
  mode: CalMode;
  onModeChange: (m: CalMode) => void;
}

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function stageColor(id: string) {
  return STAGES.find((s) => s.id === id)?.color ?? "var(--muted)";
}

export function LeadsCalendarView({ leads, stageMeta, mode, onModeChange }: Props) {
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  // Group leads by day (excluding closed)
  const byDay = useMemo(() => {
    const map = new Map<string, LeadRow[]>();
    for (const l of leads) {
      if (l.current_stage === "closed") continue;
      const raw = stageMeta[l.id]?.follow_up_date ?? l.updated_at;
      if (!raw) continue;
      const key = String(raw).slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(l);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.current_stage.localeCompare(b.current_stage) || a.company_name.localeCompare(b.company_name));
    }
    return map;
  }, [leads, stageMeta]);

  const rangeLabel = useMemo(() => {
    if (mode === "month") return anchor.toLocaleString(undefined, { month: "long", year: "numeric" });
    if (mode === "week") {
      const s = startOfWeek(anchor);
      const e = new Date(s); e.setDate(e.getDate() + 6);
      return `${s.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return "Next 30 days";
  }, [anchor, mode]);

  function shift(dir: -1 | 1) {
    const d = new Date(anchor);
    if (mode === "month") d.setMonth(d.getMonth() + dir);
    else if (mode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir * 30);
    setAnchor(d);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Previous"><ChevronLeft className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Next"><ChevronRight className="w-4 h-4" /></Button>
          <div className="text-sm font-semibold ml-2">{rangeLabel}</div>
        </div>
        <div className="inline-flex glass rounded-md border border-glass-border p-0.5">
          {(["month", "week", "agenda"] as CalMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`px-3 py-1 text-xs rounded ${mode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {mode === "month" && <MonthGrid anchor={anchor} byDay={byDay} />}
      {mode === "week" && <WeekGrid anchor={anchor} byDay={byDay} />}
      {mode === "agenda" && <AgendaList anchor={anchor} byDay={byDay} />}
    </div>
  );
}

function LeadChip({ lead }: { lead: LeadRow }) {
  return (
    <Link
      to="/c/$slug/leads/$leadId"
      params={{ leadId: lead.id }}
      className="flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded bg-white/5 hover:bg-primary/15 truncate"
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: stageColor(lead.current_stage) }} />
      <span className="truncate">{lead.company_name}</span>
    </Link>
  );
}

function MonthGrid({ anchor, byDay }: { anchor: Date; byDay: Map<string, LeadRow[]> }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    cells.push(d);
  }
  const todayKey = ymd(new Date());
  return (
    <div className="glass rounded-xl border border-glass-border overflow-hidden">
      <div className="grid grid-cols-7 text-[10px] uppercase text-muted-foreground border-b border-glass-border">
        {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
          <div key={d} className="p-2 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {cells.map((d, i) => {
          const k = ymd(d);
          const items = byDay.get(k) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = k === todayKey;
          return (
            <div key={i} className={`min-h-[100px] p-1.5 border-r border-b border-glass-border ${!inMonth ? "opacity-40" : ""}`}>
              <div className={`text-[11px] mb-1 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>{d.getDate()}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((l) => <LeadChip key={l.id} lead={l} />)}
                {items.length > 3 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-[10px] text-primary hover:underline">+{items.length - 3} more</button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2 space-y-1">
                      {items.map((l) => <LeadChip key={l.id} lead={l} />)}
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ anchor, byDay }: { anchor: Date; byDay: Map<string, LeadRow[]> }) {
  const start = startOfWeek(anchor);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push(d);
  }
  const todayKey = ymd(new Date());
  return (
    <div className="glass rounded-xl border border-glass-border overflow-hidden grid grid-cols-1 md:grid-cols-7">
      {days.map((d) => {
        const k = ymd(d);
        const items = byDay.get(k) ?? [];
        const isToday = k === todayKey;
        return (
          <div key={k} className="border-r border-b border-glass-border p-2 min-h-[220px]">
            <div className={`text-xs mb-2 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
              {d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" })}
            </div>
            <div className="space-y-1">
              {items.length === 0 && <div className="text-[10px] text-muted-foreground">—</div>}
              {items.map((l) => <LeadChip key={l.id} lead={l} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgendaList({ anchor, byDay }: { anchor: Date; byDay: Map<string, LeadRow[]> }) {
  const days: { d: Date; items: LeadRow[] }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(anchor); d.setDate(anchor.getDate() + i);
    const items = byDay.get(ymd(d)) ?? [];
    if (items.length) days.push({ d, items });
  }
  return (
    <div className="glass rounded-xl border border-glass-border divide-y divide-glass-border">
      {days.length === 0 && (
        <div className="p-8 text-center text-sm text-muted-foreground">No follow-ups scheduled in this window.</div>
      )}
      {days.map(({ d, items }) => (
        <div key={ymd(d)} className="p-3 flex gap-4">
          <div className="w-28 shrink-0 text-sm">
            <div className="font-semibold">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
            <div className="text-xs text-muted-foreground">{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          </div>
          <div className="flex-1 space-y-1">
            {items.map((l) => <LeadChip key={l.id} lead={l} />)}
          </div>
        </div>
      ))}
    </div>
  );
}