import { createFileRoute } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { PriorityBadge } from "@/components/app/StatusBadge";
import {
  Clock,
  Sparkles,
  ArrowUpRight,
  CalendarClock,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  Activity,
  IndianRupee,
  Wallet,
  AlertCircle,
  CheckCircle2,
  Layers,
  Receipt,
  Calendar as CalendarIcon,
  ShoppingCart,
  ClipboardCheck,
  Boxes,
} from "lucide-react";
import { useTasks } from "@/hooks/use-tasks";
import { isCompletedStateName } from "@/lib/task-status";
import { useClientsData } from "@/hooks/use-clients-data";
import { useDepartments } from "@/hooks/use-departments";
import { useWorkflowStates } from "@/hooks/use-workflow-states";
import { todayLocalDate } from "@/lib/format";
import { useProjects } from "@/hooks/use-projects";
import { useLeads, STAGES, type LeadStage } from "@/hooks/use-leads";
import { useProjectPayments } from "@/hooks/use-project-payments";
import { useExpenses } from "@/hooks/use-expenses";
import { useAuth } from "@/hooks/use-auth";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";
import { useSupplierBalances } from "@/hooks/use-supplier-payments";
import { useStockMovements } from "@/hooks/use-stock-movements";
import { useEmployees } from "@/hooks/use-employees";
import { useHasPermission } from "@/hooks/use-permissions";
import { Users, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  PRESETS,
  rangeFromPreset,
  inRange,
  type DateRange,
  type PresetKey,
} from "@/lib/date-presets";
import { Input } from "@/components/ui/input";

// ───────────────────── helpers ─────────────────────

function useCountUp(value: number, duration = 700) {
  const [n, setN] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    fromRef.current = n;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(fromRef.current + (value - fromRef.current) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return n;
}

// ───────────────────── date range pills ─────────────────────

type PillKey = "today" | "yesterday" | "this_week" | "month" | "custom";
const PILLS: { key: PillKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Date range" },
];

function fmtDay(iso?: string | null) {
  if (!iso) return "…";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function DateRangePills({
  active,
  range,
  onActive,
  onRange,
}: {
  active: PillKey;
  range: DateRange;
  onActive: (k: PillKey) => void;
  onRange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="max-w-full overflow-x-auto no-scrollbar">
        <div className="glass rounded-full p-1 flex w-max items-center gap-1">
        {PILLS.map((p) => {
          const isActive = active === p.key;
          if (p.key === "custom") {
            return (
              <Popover key={p.key} open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <button
                    onClick={() => onActive("custom")}
                    className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-4 h-9 rounded-full text-xs font-semibold transition ${
                      isActive ? "bg-gradient-primary text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    {p.label}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  collisionPadding={12}
                  className="w-[min(20rem,calc(100vw-1.5rem))] p-3 space-y-3"
                >
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Custom range</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <label className="text-[11px] text-muted-foreground">From</label>
                      <Input
                        type="date"
                        value={range.from ?? ""}
                        max={range.to ?? undefined}
                        onChange={(e) => onRange({ ...range, from: e.target.value || null })}
                        className="h-9 w-full"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <label className="text-[11px] text-muted-foreground">To</label>
                      <Input
                        type="date"
                        value={range.to ?? ""}
                        min={range.from ?? undefined}
                        onChange={(e) => onRange({ ...range, to: e.target.value || null })}
                        className="h-9 w-full"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onRange({ from: null, to: null });
                        onActive("month");
                        setOpen(false);
                      }}
                    >
                      Clear
                    </Button>
                    <Button size="sm" onClick={() => setOpen(false)}>
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }
          return (
            <button
              key={p.key}
              onClick={() => onActive(p.key)}
              className={`shrink-0 whitespace-nowrap px-4 h-9 rounded-full text-xs font-semibold transition ${
                isActive ? "bg-gradient-primary text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          );
        })}
        </div>
      </div>
      {active === "custom" && (range.from || range.to) && (
        <div className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-glass-border px-3 py-1 text-[11px] text-muted-foreground">
          <CalendarIcon className="w-3 h-3 shrink-0" />
          <span className="truncate">{fmtDay(range.from)} – {fmtDay(range.to)}</span>
        </div>
      )}
    </div>
  );
}

// ───────────────────── section header ─────────────────────

function SectionHeader({ title, to }: { title: string; to?: string }) {
  return (
    <div className="col-span-2 lg:col-span-6 flex items-center justify-between mt-2 first:mt-0">
      <div className="flex items-center gap-2">
        <span className="h-px w-6 bg-glass-border" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h2>
      </div>
      {to && (
        <Link to={to} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
          Open <ArrowUpRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

// ───────────────────── page ─────────────────────

function Dashboard() {
  const { tasks, loading: tLoading } = useTasks();
  const { clients, loading: cLoading } = useClientsData();
  const { departments } = useDepartments();
  const { states } = useWorkflowStates();
  const { projects } = useProjects();
  const { leads } = useLeads();
  const { payments } = useProjectPayments();
  const { all: allExpenses } = useExpenses();
  const { employees } = useEmployees();
  const { orders } = usePurchaseOrders();
  const { totalOutstanding: supplierOutstanding } = useSupplierBalances();
  const { stockValue, lowStockCount, movements, totalsByItem } = useStockMovements();

  const canLeads       = useHasPermission("nav.leads");
  const canClients     = useHasPermission("nav.clients");
  const canProjects    = useHasPermission("nav.projects");
  const canDepartments = useHasPermission("nav.departments");
  const canAccounts    = useHasPermission("nav.accounts");
  const canFinancials  = useHasPermission("data.financials");
  const canEmployees   = useHasPermission("nav.employees");
  const canPurchase    = useHasPermission("nav.purchase");
  const canStock       = useHasPermission("nav.stock");

  // Date range
  const [active, setActive] = useState<PillKey>("month");
  const [range, setRange] = useState<DateRange>(rangeFromPreset("month"));

  const handleActive = (k: PillKey) => {
    setActive(k);
    if (k !== "custom") setRange(rangeFromPreset(k as PresetKey));
  };

  const completedIds = useMemo(
    () => new Set(states.filter((s) => isCompletedStateName(s.name)).map((s) => s.id)),
    [states],
  );
  const isCompleted = (sid: string | null | undefined) => !!sid && completedIds.has(sid);
  const openTasks = tasks.filter((t) => !isCompleted(t.status_id)).length;

  const ordersInRange = useMemo(
    () => orders.filter((o) => o.status !== "cancelled" && inRange(o.po_date, range)),
    [orders, range],
  );
  const purchaseValue = useMemo(
    () => ordersInRange.reduce((sum, o) => sum + (Number(o.grand_total) || 0), 0),
    [ordersInRange],
  );
  const pendingApprovalCount = useMemo(
    () => orders.filter((o) => o.status === "pending_approval").length,
    [orders],
  );

  const movementsInRange = useMemo(
    () => movements.filter((m) => inRange(m.moved_on, range)),
    [movements, range],
  );
  const stockFlow = useMemo(() => {
    let inValue = 0;
    let outValue = 0;
    for (const m of movementsInRange) {
      const value = (m.quantity || 0) * (m.rate || 0);
      if (m.movement_type === "in") inValue += value;
      else if (m.movement_type === "out") outValue += value;
      else if (m.movement_type === "adjust") {
        if ((m.quantity || 0) >= 0) inValue += value;
        else outValue += Math.abs(value);
      }
    }
    const avgHeld = Math.max(stockValue, 1);
    return {
      inValue,
      outValue,
      net: inValue - outValue,
      turnover: outValue / avgHeld,
    };
  }, [movementsInRange, stockValue]);

  const topMoving = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movementsInRange) {
      if (m.movement_type === "transfer") continue;
      map.set(m.item_id, (map.get(m.item_id) ?? 0) + Math.abs(m.quantity || 0));
    }
    return Array.from(map.entries())
      .map(([itemId, qty]) => ({
        name: totalsByItem.find((t) => t.item.id === itemId)?.item.name ?? "Item",
        unit: totalsByItem.find((t) => t.item.id === itemId)?.item.unit ?? "",
        qty,
      }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [movementsInRange, totalsByItem]);

  const lowStockRows = useMemo(
    () =>
      totalsByItem
        .filter((r) => r.low)
        .map((r) => ({
          id: r.item.id,
          name: r.item.name,
          unit: r.item.unit,
          quantity: r.quantity,
          min: r.item.min_stock,
          short: Math.max(0, r.item.min_stock - r.quantity),
        }))
        .sort((a, b) => b.short - a.short)
        .slice(0, 8),
    [totalsByItem],
  );

  const pipelineValue = useMemo(
    () =>
      leads
        .filter((l) => l.current_stage === "quoted" && inRange(l.updated_at, range))
        .reduce((sum, l) => sum + (Number(l.final_price) || 0), 0),
    [leads, range],
  );

  const successValue = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.current_stage === "closed" &&
            l.outcome === "success" &&
            inRange(l.updated_at, range),
        )
        .reduce((sum, l) => sum + (Number(l.final_price) || 0), 0),
    [leads, range],
  );

  const projectsInRange = useMemo(
    () => projects.filter((p) => inRange(p.created_at, range)),
    [projects, range],
  );
  const totalProjectValue = useMemo(
    () => projectsInRange.reduce((s, p) => s + (Number(p.final_price) || 0), 0),
    [projectsInRange],
  );
  const amountCollected = useMemo(
    () => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [payments],
  );
  const outstandingDue = useMemo(() => {
    const totalValue = projects.reduce((s, p) => s + (Number(p.final_price) || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return Math.max(0, totalValue - totalPaid);
  }, [projects, payments]);

  const expensesInRange = useMemo(
    () => allExpenses.filter((e) => inRange(e.spent_on, range)),
    [allExpenses, range],
  );
  const totalExpenses = useMemo(
    () => expensesInRange.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expensesInRange],
  );

  const closedTasksInRange = useMemo(
    () =>
      tasks.filter((t) => {
        if (!isCompleted(t.status_id)) return false;
        const ts =
          (t as unknown as { completed_at?: string }).completed_at ??
          (t as unknown as { updated_at?: string }).updated_at ??
          null;
        return inRange(ts, range);
      }).length,
    [tasks, completedIds, range],
  );

  const activeClientsCount = useMemo(
    () => clients.filter((c) => c.status === "active").length,
    [clients],
  );
  const totalProjectsCount = projects.length;
  const openProjectsCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects],
  );
  const activeEmployeesCount = useMemo(
    () => employees.filter((e) => e.status === "active").length,
    [employees],
  );

  if (tLoading || cLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
        <Sparkles className="w-5 h-5 animate-pulse mr-2" /> Loading dashboard…
      </div>
    );
  }

  const rangeLabel = PILLS.find((p) => p.key === active)?.label ?? "";

  return (
    <>
      <Topbar title="Dashboard" subtitle="Command center · live overview" />
      <div className="p-4 sm:p-6">
        <DateRangePills active={active} range={range} onActive={handleActive} onRange={setRange} />

        <div className="grid grid-cols-2 lg:grid-cols-6 auto-rows-min gap-3 sm:gap-4">
          {/* A. Leads */}
          {canLeads && (
            <>
              <SectionHeader title="Leads" to="/c/$slug/leads" />
              <div className="col-span-2 lg:col-span-3 lg:row-span-2">
                <LeadsPipelineTile leads={leads} range={range} />
              </div>
              {canFinancials && (
                <>
                  <div className="col-span-1 lg:col-span-3">
                    <KpiSmall
                      label={`Pipeline Value (Quoted · ${rangeLabel})`}
                      value={pipelineValue}
                      icon={IndianRupee}
                      color="var(--neon-purple)"
                      formatter={inr}
                      to="/c/$slug/leads"
                    />
                  </div>
                  <div className="col-span-1 lg:col-span-3">
                    <KpiSmall
                      label={`Success — New Projects (${rangeLabel})`}
                      value={successValue}
                      icon={CheckCircle2}
                      color="var(--neon-green)"
                      formatter={inr}
                      to="/c/$slug/leads"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* B. Tasks */}
          <SectionHeader title="Tasks" to="/c/$slug/tasks" />
          <div className="col-span-1 lg:col-span-3">
            <KpiSmall
              label="Total Open Tasks"
              value={openTasks}
              icon={Clock}
              color="var(--neon-amber)"
              meta="All-time"
              to="/c/$slug/tasks"
            />
          </div>
          <div className="col-span-1 lg:col-span-3">
            <KpiSmall
              label={`Closed Tasks (${rangeLabel})`}
              value={closedTasksInRange}
              icon={CheckCircle2}
              color="var(--neon-green)"
              to="/c/$slug/tasks"
            />
          </div>
          <div className="col-span-2 lg:col-span-4">
            <TasksStatusTile tasks={tasks} states={states} />
          </div>
          <div className="col-span-2 lg:col-span-2">
            <UpcomingDeadlinesTile tasks={tasks} clients={clients} completedIds={completedIds} />
          </div>

          {/* C. Clients */}
          {canClients && (
            <>
              <SectionHeader title="Clients" to="/c/$slug/clients" />
              <div className="col-span-2 lg:col-span-6">
                <KpiSmall
                  label="Total Active Clients"
                  value={activeClientsCount}
                  icon={Users}
                  color="var(--neon-cyan)"
                  meta="Active status · no date range"
                  to="/c/$slug/clients"
                />
              </div>
            </>
          )}

          {/* D. Projects */}
          {canProjects && (
            <>
              <SectionHeader title="Projects" to="/c/$slug/projects" />
              <div className="col-span-2 lg:col-span-4 lg:row-span-2">
                <ActiveProjectsTile
                  projects={projects}
                  clients={clients}
                  departments={departments}
                  tasks={tasks}
                  completedIds={completedIds}
                />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <KpiSmall
                  label="Total Projects"
                  value={totalProjectsCount}
                  icon={FolderKanban}
                  color="var(--neon-purple)"
                  meta="All-time"
                  to="/c/$slug/projects"
                />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <KpiSmall
                  label="Total Open Projects"
                  value={openProjectsCount}
                  icon={Briefcase}
                  color="var(--neon-blue)"
                  meta="Status: active"
                  to="/c/$slug/projects"
                />
              </div>
            </>
          )}

          {/* E. Departments */}
          {canDepartments && (
            <>
              <SectionHeader title="Departments" to="/c/$slug/departments" />
              <div className="col-span-2 lg:col-span-6">
                <DepartmentLoadTile
                  departments={departments}
                  tasks={tasks}
                  completedIds={completedIds}
                  range={range}
                />
              </div>
            </>
          )}

          {/* F. Accounts */}
          {canAccounts && canFinancials && (
            <>
              <SectionHeader title="Accounts" to="/c/$slug/accounts" />
              <div className="col-span-2 lg:col-span-2">
                <KpiSmall
                  label={`Total Project Value (${rangeLabel})`}
                  value={totalProjectValue}
                  icon={Layers}
                  color="var(--neon-blue)"
                  formatter={inr}
                  meta={`${projectsInRange.length} project${projectsInRange.length === 1 ? "" : "s"}`}
                  to="/c/$slug/projects"
                />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <KpiSmall
                  label="Amount Collected"
                  value={amountCollected}
                  icon={Wallet}
                  color="var(--neon-green)"
                  formatter={inr}
                  meta="All-time"
                  to="/c/$slug/accounts"
                />
              </div>
              <div className="col-span-1 lg:col-span-2">
                <KpiSmall
                  label="Outstanding Due"
                  value={outstandingDue}
                  icon={AlertCircle}
                  color="var(--neon-pink)"
                  formatter={inr}
                  meta="All-time"
                  to="/c/$slug/invoicing/pending"
                />
              </div>
              <div className="col-span-1 lg:col-span-3">
                <KpiSmall
                  label={`Total Expenses (${rangeLabel})`}
                  value={totalExpenses}
                  icon={Receipt}
                  color="var(--neon-purple)"
                  formatter={inr}
                  meta={`${expensesInRange.length} entr${expensesInRange.length === 1 ? "y" : "ies"}`}
                  to="/c/$slug/accounts/expenses"
                />
              </div>
              <div className="col-span-1 lg:col-span-3">
                <KpiSmall
                  label={`Net (Collected − Expenses)`}
                  value={amountCollected - totalExpenses}
                  icon={TrendingUp}
                  color="var(--neon-green)"
                  formatter={inr}
                  meta="Collected all-time vs expenses in range"
                  to="/c/$slug/accounts/expenses"
                />
              </div>
            </>
          )}

          {/* F2. Purchase & Stock */}
          {(canPurchase || canStock) && (
            <>
              <SectionHeader title="Purchase & Stock" to={canPurchase ? "/c/$slug/purchase/orders" : "/c/$slug/stock/balance"} />
              {canPurchase && canFinancials && (
                <div className="col-span-2 lg:col-span-2">
                  <KpiSmall
                    label={`Purchase Value (${rangeLabel})`}
                    value={purchaseValue}
                    icon={ShoppingCart}
                    color="var(--neon-blue)"
                    formatter={inr}
                    meta={`${ordersInRange.length} order${ordersInRange.length === 1 ? "" : "s"}`}
                    to="/c/$slug/purchase/orders"
                  />
                </div>
              )}
              {canPurchase && canFinancials && (
                <div className="col-span-1 lg:col-span-2">
                  <KpiSmall
                    label="Supplier Outstanding"
                    value={supplierOutstanding}
                    icon={AlertCircle}
                    color="var(--neon-pink)"
                    formatter={inr}
                    meta="All-time"
                    to="/c/$slug/purchase/payments"
                  />
                </div>
              )}
              {canPurchase && (
                <div className="col-span-1 lg:col-span-2">
                  <KpiSmall
                    label="POs Awaiting Approval"
                    value={pendingApprovalCount}
                    icon={ClipboardCheck}
                    color="var(--neon-amber)"
                    meta="No date range"
                    to="/c/$slug/purchase/orders"
                  />
                </div>
              )}
              {canStock && (
                <div className="col-span-1 lg:col-span-3">
                  <KpiSmall
                    label="Stock Value"
                    value={stockValue}
                    icon={Boxes}
                    color="var(--neon-purple)"
                    formatter={inr}
                    meta="Current balance"
                    to="/c/$slug/stock/balance"
                  />
                </div>
              )}
              {canStock && (
                <div className="col-span-1 lg:col-span-3">
                  <KpiSmall
                    label="Items Below Minimum"
                    value={lowStockCount}
                    icon={AlertCircle}
                    color="var(--neon-amber)"
                    meta="Reorder soon"
                    to="/c/$slug/stock/balance"
                  />
                </div>
              )}
              {canStock && (
                <div className="col-span-2 lg:col-span-3">
                  <StockFlowTile flow={stockFlow} topMoving={topMoving} rangeLabel={rangeLabel} />
                </div>
              )}
              {canStock && (
                <div className="col-span-2 lg:col-span-3">
                  <LowStockTile rows={lowStockRows} />
                </div>
              )}
            </>
          )}

          {/* G. Employees */}
          {canEmployees && (
            <>
              <SectionHeader title="Employees" to="/c/$slug/employees" />
              <div className="col-span-2 lg:col-span-6">
                <KpiSmall
                  label="Total Active Employees"
                  value={activeEmployeesCount}
                  icon={Users}
                  color="var(--neon-green)"
                  meta="Active status · no date range"
                  to="/c/$slug/employees"
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function daysFromNow(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const diff = (d.getTime() - Date.now()) / 86400000;
  return Math.ceil(diff);
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export const Route = createFileRoute("/c/$slug/_app/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Smart Work Flow" }] }),
});

// ───────────────────── tiles ─────────────────────

const Tile = ({
  children,
  className = "",
  to,
}: {
  children: React.ReactNode;
  className?: string;
  to?: string;
}) => {
  const cls = `glass rounded-2xl shadow-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-glow ${className}`;
  if (to) return <Link to={to} className={`block ${cls}`}>{children}</Link>;
  return <div className={cls}>{children}</div>;
};

const TileHead = ({
  title,
  icon: Icon,
  to,
  color,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  to?: string;
  color?: string;
}) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4" style={{ color: color ?? "var(--neon-cyan)" }} />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
    {to && (
      <Link to={to} className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
        Open <ArrowUpRight className="w-3 h-3" />
      </Link>
    )}
  </div>
);

function KpiSmall({
  label,
  value,
  icon: Icon,
  color,
  meta,
  to,
  prefix,
  formatter,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  meta?: React.ReactNode;
  to?: string;
  prefix?: string;
  formatter?: (n: number) => string;
}) {
  const n = useCountUp(value);
  const display = formatter ? formatter(n) : `${prefix ?? ""}${n.toLocaleString("en-IN")}`;
  return (
    <Tile to={to}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="font-display font-bold text-2xl mt-1.5 truncate">{display}</div>
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in oklch, ${color} 18%, transparent)` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      {meta && <div className="mt-2 text-[11px] text-muted-foreground">{meta}</div>}
    </Tile>
  );
}

function LeadsPipelineTile({
  leads,
  range,
}: {
  leads: ReturnType<typeof useLeads>["leads"];
  range: DateRange;
}) {
  const counts = useMemo(() => {
    const m: Record<LeadStage, number> = { new_lead: 0, follow_up: 0, quoted: 0, closed: 0 };
    for (const l of leads) {
      if (!inRange(l.created_at, range)) continue;
      m[l.current_stage] = (m[l.current_stage] ?? 0) + 1;
    }
    return m;
  }, [leads, range]);
  const max = Math.max(1, ...Object.values(counts));

  return (
    <Tile to="/c/$slug/leads" className="h-full">
      <TileHead title="Leads Pipeline" icon={Sparkles} color="var(--neon-pink)" />
      <div className="space-y-3">
        {STAGES.map((s) => {
          const c = counts[s.id];
          const pct = (c / max) * 100;
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-semibold" style={{ color: s.color }}>{c}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: s.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Tile>
  );
}

function ActiveProjectsTile({
  projects,
  clients,
  departments,
  tasks,
  completedIds,
}: {
  projects: ReturnType<typeof useProjects>["projects"];
  clients: ReturnType<typeof useClientsData>["clients"];
  departments: ReturnType<typeof useDepartments>["departments"];
  tasks: ReturnType<typeof useTasks>["tasks"];
  completedIds: Set<string>;
}) {
  const active = useMemo(() => {
    const scored = projects
      .filter((p) => p.status === "active")
      .map((p) => {
        const d = p.deadline_date ? new Date(p.deadline_date).getTime() : Infinity;
        return { p, d };
      });
    scored.sort((a, b) => a.d - b.d);
    return scored.slice(0, 10).map((x) => x.p);
  }, [projects, tasks, completedIds]);

  return (
    <Tile className="h-full">
      <TileHead title="Active Projects" icon={Briefcase} to="/c/$slug/projects" color="var(--neon-purple)" />
      {active.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No active projects.</div>
      ) : (
        <div className="space-y-3">
          {active.map((p) => {
            const c = clients.find((x) => x.id === p.client_id);
            const projTasks = tasks.filter((t) => Boolean(p.id) && Boolean(t.project_id) && t.project_id === p.id);
            const done = projTasks.filter((t) => t.status_id && completedIds.has(t.status_id)).length;
            const open = projTasks.length - done;
            const pct = projTasks.length ? (done / projTasks.length) * 100 : 0;
            const dleft = daysFromNow(p.deadline_date);
            const overdue = dleft !== null && dleft < 0;
            return (
              <Link
                key={p.id}
                to="/c/$slug/projects/$projectId"
                params={{ projectId: p.id }}
                className="block p-3 -mx-2 rounded-lg hover:bg-white/5 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c?.name ?? "—"}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {p.department_ids.slice(0, 3).map((id) => {
                      const d = departments.find((x) => x.id === id);
                      if (!d) return null;
                      return (
                        <span
                          key={id}
                          className="w-2 h-2 rounded-full"
                          style={{ background: d.color }}
                          title={d.name}
                        />
                      );
                    })}
                  </div>
                  <div
                    className={`text-[11px] shrink-0 w-20 text-right ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                  >
                    {dleft === null ? "no deadline" : overdue ? `${Math.abs(dleft)}d late` : `${dleft}d left`}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-primary transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span
                    className={`text-[11px] font-semibold shrink-0 text-right tabular-nums ${
                      projTasks.length === 0
                        ? "text-muted-foreground w-20"
                        : open === 0
                          ? "text-neon-green w-20"
                          : "text-muted-foreground w-24"
                    }`}
                  >
                    {projTasks.length === 0
                      ? "no tasks"
                      : open === 0
                        ? "Done · 100%"
                        : `${open} open · ${Math.round(pct)}%`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Tile>
  );
}

function DepartmentLoadTile({
  departments,
  tasks,
  completedIds,
  range,
}: {
  departments: ReturnType<typeof useDepartments>["departments"];
  tasks: ReturnType<typeof useTasks>["tasks"];
  completedIds: Set<string>;
  range: DateRange;
}) {
  const rows = useMemo(() => {
    return departments
      .map((d) => {
        const deptTasks = tasks.filter(
          (t) =>
            t.department_id === d.id &&
            inRange((t as unknown as { created_at?: string }).created_at ?? null, range),
        );
        const total = deptTasks.length;
        const done = deptTasks.filter((t) => t.status_id && completedIds.has(t.status_id)).length;
        const open = total - done;
        const pct = total ? (done / total) * 100 : 0;
        return { d, total, done, open, pct };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.open - a.open);
  }, [departments, tasks, completedIds, range]);

  return (
    <Tile className="h-full" to="/c/$slug/departments">
      <TileHead title="Department Workload" icon={TrendingUp} color="var(--neon-cyan)" />
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">No department activity in range.</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ d, total, done, open, pct }) => (
            <div key={d.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="truncate" style={{ color: d.color }}>{d.name}</span>
                <span className="font-semibold text-muted-foreground tabular-nums">
                  {done}/{total} · {Math.round(pct)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: d.color }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Tile>
  );
}

function TasksStatusTile({
  tasks,
  states,
}: {
  tasks: ReturnType<typeof useTasks>["tasks"];
  states: ReturnType<typeof useWorkflowStates>["states"];
}) {
  const total = tasks.length || 1;
  const segments = states.map((s) => {
    const c = tasks.filter((t) => t.status_id === s.id).length;
    return { ...s, count: c, pct: (c / total) * 100 };
  });
  const priorities = ["urgent", "high", "medium", "low"] as const;

  return (
    <Tile>
      <TileHead title="Tasks by Status" icon={Activity} to="/c/$slug/tasks" />
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5">
        {segments.map((s) => (
          <div
            key={s.id}
            className="h-full transition-all duration-700"
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.name}: ${s.count}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.name}</span>
            <span className="font-semibold">{s.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-glass-border flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority</span>
        <div className="flex gap-1.5 ml-auto">
          {priorities.map((p) => (
            <div key={p} className="flex items-center gap-1">
              <PriorityBadge priority={p} />
              <span className="text-[11px] text-muted-foreground">
                {tasks.filter((t) => t.priority === p).length}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Tile>
  );
}

function UpcomingDeadlinesTile({
  tasks,
  clients,
  completedIds,
}: {
  tasks: ReturnType<typeof useTasks>["tasks"];
  clients: ReturnType<typeof useClientsData>["clients"];
  completedIds: Set<string>;
}) {
  const upcoming = useMemo(() => {
    const today = todayLocalDate();
    return tasks
      .filter((t) => !!t.due_date && !(t.status_id && completedIds.has(t.status_id)))
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .filter((t) => t.due_date! >= today || daysFromNow(t.due_date)! >= -14)
      .slice(0, 8);
  }, [tasks, completedIds]);

  return (
    <Tile className="h-full">
      <TileHead title="Upcoming Deadlines" icon={CalendarClock} to="/c/$slug/tasks" color="var(--neon-amber)" />
      {upcoming.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">No deadlines.</div>
      ) : (
        <div className="space-y-2">
          {upcoming.map((t) => {
            const c = clients.find((x) => x.id === t.client_id);
            const left = daysFromNow(t.due_date);
            const overdue = left !== null && left < 0;
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                {overdue ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{c?.name ?? "—"}</div>
                </div>
                <div className={`shrink-0 ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                  {overdue ? `${Math.abs(left!)}d late` : `${left}d`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Tile>
  );
}



// ───────────────────── stock tiles ─────────────────────

function StockFlowTile({
  flow,
  topMoving,
  rangeLabel,
}: {
  flow: { inValue: number; outValue: number; net: number; turnover: number };
  topMoving: { name: string; unit: string; qty: number }[];
  rangeLabel: string;
}) {
  const max = Math.max(flow.inValue, flow.outValue, 1);
  return (
    <Tile className="h-full" to="/c/$slug/stock/movements">
      <TileHead title={`Stock Movement (${rangeLabel})`} icon={Boxes} color="var(--neon-purple)" />
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Stock in</span>
            <span className="font-semibold tabular-nums">{inr(flow.inValue)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all duration-700" style={{ width: `${(flow.inValue / max) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Stock out</span>
            <span className="font-semibold tabular-nums">{inr(flow.outValue)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-warning transition-all duration-700" style={{ width: `${(flow.outValue / max) * 100}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-xs pt-1 border-t border-glass-border">
          <span className="text-muted-foreground">Net change</span>
          <span className={`font-semibold tabular-nums ${flow.net >= 0 ? "text-success" : "text-destructive"}`}>
            {flow.net >= 0 ? "+" : "−"}{inr(Math.abs(flow.net))}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Turnover (consumed / stock held)</span>
          <span className="font-semibold tabular-nums">{flow.turnover.toFixed(2)}x</span>
        </div>
        {topMoving.length > 0 && (
          <div className="pt-1 space-y-1">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Top moving items</p>
            {topMoving.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-xs">
                <span className="truncate">{t.name}</span>
                <span className="tabular-nums text-muted-foreground">{t.qty} {t.unit}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Tile>
  );
}

function LowStockTile({
  rows,
}: {
  rows: { id: string; name: string; unit: string; quantity: number; min: number; short: number }[];
}) {
  return (
    <Tile className="h-full" to="/c/$slug/stock/balance">
      <TileHead title="Low Stock Alerts" icon={AlertCircle} color="var(--neon-amber)" />
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">All items are above their minimum level.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{r.name}</span>
              <span className="tabular-nums text-muted-foreground shrink-0">
                {r.quantity} / {r.min} {r.unit} · short {Math.round(r.short * 1000) / 1000}
              </span>
            </div>
          ))}
        </div>
      )}
    </Tile>
  );
}
