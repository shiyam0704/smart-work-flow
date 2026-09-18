import { createFileRoute } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { useCNavigate as useNavigate } from "@/lib/nav";
import { useState, useMemo, useEffect } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { Topbar } from "@/components/app/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, X, RotateCcw, Download } from "lucide-react";
import { NewLeadModal } from "@/components/app/NewLeadModal";
import { AdvanceStageModal } from "@/components/app/AdvanceStageModal";
import { useLeads, type LeadStage } from "@/hooks/use-leads";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/hooks/use-employees";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { useLeadStageMeta } from "@/hooks/use-lead-stage-meta";
import { useLeadPresets, type LeadPresetConfig } from "@/hooks/use-lead-presets";
import { LeadsKanbanView } from "@/components/app/LeadsKanbanView";
import { LeadsListView } from "@/components/app/LeadsListView";
import { LeadsCalendarView, type CalMode } from "@/components/app/LeadsCalendarView";
import { LeadsPresetBar } from "@/components/app/LeadsPresetBar";
import { rangeFromPreset, inRange, type DateRange } from "@/lib/date-presets";
import { exportLeadsCsv } from "@/lib/leads-csv";
import { toast } from "sonner";

const searchSchema = z.object({
  view: fallback(z.string(), "kanban").default("kanban"),
  mode: fallback(z.string(), "month").default("month"),
});

export const Route = createFileRoute("/c/$slug/_app/leads/")({
  component: LeadsPage,
  validateSearch: zodValidator(searchSchema),
  head: () => ({ meta: [{ title: "Leads — Smart Work Flow" }] }),
});

type ViewKey = "kanban" | "list" | "calendar";
const VIEW_KEYS: ViewKey[] = ["kanban", "list", "calendar"];
const CAL_MODES: CalMode[] = ["month", "week", "agenda"];

type AgeKey = "all" | "today" | "this_week" | "month" | "custom";
const AGE_OPTS: { value: AgeKey; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom" },
];

function LeadsPage() {
  const { view: viewRaw, mode: modeRaw } = Route.useSearch();
  const view: ViewKey = (VIEW_KEYS as string[]).includes(viewRaw) ? (viewRaw as ViewKey) : "kanban";
  const calMode: CalMode = (CAL_MODES as string[]).includes(modeRaw) ? (modeRaw as CalMode) : "month";
  const navigate = useNavigate({ from: "/c/$slug/leads" });

  const { leads, loading, createLead, advanceStage, updateLead, deleteLead } = useLeads();
  const { isAdmin } = useAuth();
  const canManageLeads = useCanManage("leads");
  const { employees } = useEmployees();
  const me = useCurrentEmployee();
  const canCreate = canManageLeads;
  const canManage = canManageLeads;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [age, setAge] = useState<AgeKey>("all");
  const [range, setRange] = useState<DateRange>({ from: null, to: null });
  const stageMeta = useLeadStageMeta(leads);
  const presets = useLeadPresets();

  // Drag-and-drop → open advance modal
  const [dndAdvanceOpen, setDndAdvanceOpen] = useState(false);
  const [dndLeadId, setDndLeadId] = useState<string | null>(null);
  const [dndStage, setDndStage] = useState<LeadStage>("follow_up");

  // Apply default preset once on first load if no explicit search params
  const [defaultApplied, setDefaultApplied] = useState(false);
  useEffect(() => {
    if (defaultApplied) return;
    const def = presets.presets.find((p) => p.is_default);
    if (def) applyPreset(def.config);
    setDefaultApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets.presets, defaultApplied]);

  const leadEmployees = useMemo(
    () =>
      employees
        .filter((e) => e.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const activeRange: DateRange = useMemo(() => {
    if (age === "all") return { from: null, to: null };
    if (age === "custom") return range;
    return rangeFromPreset(age);
  }, [age, range]);

  const resolvedEmployeeId =
    employeeFilter === "all" ? null : employeeFilter === "__me__" ? me?.id ?? null : employeeFilter;

  const filteredLeads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (q) {
        const hit = [l.company_name, l.contact_person, l.contact_number, l.city, l.address, l.lead_source, l.note]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (resolvedEmployeeId) {
        if (l.captured_by_employee_id !== resolvedEmployeeId && l.followed_by_employee_id !== resolvedEmployeeId) {
          return false;
        }
      }
      if (view !== "calendar" && !inRange(l.lead_date || l.created_at, activeRange)) return false;
      return true;
    });
  }, [leads, query, resolvedEmployeeId, activeRange, view]);

  const hasQuery = query.trim().length > 0;
  const filtersActive = employeeFilter !== "all" || age !== "all" || hasQuery;

  function resetFilters() {
    setQuery("");
    setEmployeeFilter("all");
    setAge("all");
    setRange({ from: null, to: null });
  }

  function setView(v: ViewKey) {
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, view: v }) });
  }
  function setCalMode(m: CalMode) {
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, mode: m }) });
  }

  const currentConfig: LeadPresetConfig = {
    query, employeeFilter, age,
    rangeFrom: range.from, rangeTo: range.to,
    view, calendarMode: calMode,
  };
  function applyPreset(cfg: LeadPresetConfig) {
    if (cfg.query !== undefined) setQuery(cfg.query);
    if (cfg.employeeFilter !== undefined) setEmployeeFilter(cfg.employeeFilter);
    if (cfg.age !== undefined) setAge(cfg.age as AgeKey);
    if (cfg.rangeFrom !== undefined || cfg.rangeTo !== undefined) {
      setRange({ from: cfg.rangeFrom ?? null, to: cfg.rangeTo ?? null });
    }
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        view: cfg.view ?? (prev.view as string | undefined),
        mode: cfg.calendarMode ?? (prev.mode as string | undefined),
      }),
    });
  }

  function handleDropToStage(leadId: string, stage: LeadStage) {
    setDndLeadId(leadId);
    setDndStage(stage);
    setDndAdvanceOpen(true);
  }

  async function handleBulkReassign(ids: string[], employeeId: string | null) {
    for (const id of ids) {
      await updateLead(id, { followed_by_employee_id: employeeId });
    }
  }
  async function handleBulkDelete(ids: string[]) {
    let ok = 0;
    for (const id of ids) {
      const r = await deleteLead(id);
      if (r) ok++;
    }
    toast.success(`Deleted ${ok} of ${ids.length}`);
  }

  const empNameLookup = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.name);
    return (id: string | null) => (id ? m.get(id) ?? "" : "");
  }, [employees]);

  function doExport(ids?: string[]) {
    const rows = ids && ids.length
      ? leads.filter((l) => ids.includes(l.id))
      : filteredLeads;
    if (!rows.length) { toast.error("Nothing to export"); return; }
    exportLeadsCsv(rows, { employeeName: empNameLookup, stageMeta });
  }

  return (
    <>
      <Topbar title="Leads" subtitle="Pipeline of prospective clients" />
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <LeadsPresetBar
            presets={presets.presets}
            currentConfig={currentConfig}
            onApply={applyPreset}
            onSave={presets.save}
            onRename={presets.rename}
            onDelete={presets.remove}
            onSetDefault={presets.setDefault}
          />
        </div>

        <div className="text-sm text-muted-foreground">
          {loading
            ? "Loading…"
            : filtersActive
              ? `${filteredLeads.length}/${leads.length} leads`
              : `${leads.length} total leads`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem] sm:flex-none sm:w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company, contact, city, phone…"
              className="pl-8 pr-8"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => doExport()}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          {canCreate && (
            <Button onClick={() => setOpen(true)} className="shrink-0 bg-gradient-primary text-white shadow-glow">
              <Plus className="w-4 h-4" /> New Lead
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Employee</label>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {me && me.status === "active" && (
                  <SelectItem value="__me__">Me ({me.name.split(" ")[0]})</SelectItem>
                )}
                {leadEmployees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {view !== "calendar" && <div className="flex flex-col gap-1.5">
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Age</label>
            <Select value={age} onValueChange={(v) => setAge(v as AgeKey)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AGE_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>}
          {view !== "calendar" && age === "custom" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={range.from ?? ""}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value || null }))}
                  className="w-40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase tracking-wide text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={range.to ?? ""}
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value || null }))}
                  className="w-40"
                />
              </div>
            </>
          )}
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="w-4 h-4" /> Reset
            </Button>
          )}
        </div>

        {view === "kanban" && (
          <LeadsKanbanView
            leads={filteredLeads}
            stageMeta={stageMeta}
            filtersActive={filtersActive}
            canDrag={canManage}
            onDropToStage={handleDropToStage}
          />
        )}
        {view === "list" && (
          <LeadsListView
            leads={filteredLeads}
            stageMeta={stageMeta}
            employees={employees}
            canManage={canManage}
            onExportSelected={(ids) => doExport(ids)}
            onBulkReassign={handleBulkReassign}
            onBulkDelete={handleBulkDelete}
            onOpenAdvance={handleDropToStage}
          />
        )}
        {view === "calendar" && (
          <LeadsCalendarView
            leads={filteredLeads}
            stageMeta={stageMeta}
            mode={calMode}
            onModeChange={setCalMode}
          />
        )}
      </div>

      <NewLeadModal open={open} onOpenChange={setOpen} onCreate={createLead} />
      <AdvanceStageModal
        open={dndAdvanceOpen}
        stage={dndStage}
        onOpenChange={setDndAdvanceOpen}
        latestFollowUp={null}
        onAdvance={async (stage, data, note, files, extra, employeeId) => {
          if (!dndLeadId) return false;
          return advanceStage(dndLeadId, stage, data, note, files, extra, employeeId);
        }}
      />
    </>
  );
}
