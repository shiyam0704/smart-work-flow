import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useActiveCompanyId } from "@/hooks/use-company";
import type { DateRange } from "@/lib/date-presets";

export const PAGE_SIZE = 50;

export interface AuditRow {
  id: string;
  company_id: string | null;
  actor_id: string | null;
  actor_email: string | null;
  table_name: string;
  record_id: string | null;
  record_label: string;
  action: string;
  changed_fields: string[];
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}

export const AUDIT_ENTITIES: { key: string; label: string }[] = [
  { key: "leads", label: "Leads" },
  { key: "clients", label: "Clients" },
  { key: "projects", label: "Projects" },
  { key: "tasks", label: "Tasks" },
  { key: "employees", label: "Employees" },
  { key: "expenses", label: "Expenses" },
  { key: "project_payments", label: "Project Payments" },
  { key: "departments", label: "Departments" },
  { key: "role_permissions", label: "Roles & Permissions" },
  { key: "user_roles", label: "User Roles" },
  { key: "companies", label: "Company Settings" },
];

export function entityLabel(table: string): string {
  return AUDIT_ENTITIES.find((e) => e.key === table)?.label ?? table;
}

export const AUDIT_ACTIONS = ["created", "updated", "deleted"] as const;

export interface AuditFilters {
  range: DateRange;
  actorId: string;
  table: string;
  action: string;
  search: string;
}

/** Hidden from the before/after diff — noisy or sensitive. */
const HIDDEN_FIELDS = new Set([
  "id",
  "company_id",
  "created_at",
  "updated_at",
  "custom_fields",
  "password",
  "password_hash",
]);

export function visibleDiff(row: AuditRow): { field: string; before: any; after: any }[] {
  const keys =
    row.action === "updated"
      ? row.changed_fields ?? []
      : Object.keys((row.action === "deleted" ? row.old_values : row.new_values) ?? {});
  return keys
    .filter((k) => !HIDDEN_FIELDS.has(k))
    .map((k) => ({
      field: k,
      before: row.old_values ? row.old_values[k] : undefined,
      after: row.new_values ? row.new_values[k] : undefined,
    }));
}

export function useAuditLog(filters: AuditFilters) {
  const companyId = useActiveCompanyId();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(0);

  const key = JSON.stringify({ companyId, ...filters });

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      setLoading(true);
      let q = supabase
        .from("audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (companyId) q = q.eq("company_id", companyId);
      if (filters.range.from) q = q.gte("created_at", `${filters.range.from}T00:00:00`);
      if (filters.range.to) q = q.lte("created_at", `${filters.range.to}T23:59:59.999`);
      if (filters.actorId) q = q.eq("actor_id", filters.actorId);
      if (filters.table) q = q.eq("table_name", filters.table);
      if (filters.action) q = q.eq("action", filters.action);
      const s = filters.search.trim();
      if (s) q = q.or(`record_label.ilike.%${s}%,actor_email.ilike.%${s}%`);

      const { data, error } = await q;
      if (error) {
        toast.error(`Failed to load audit trail: ${error.message}`);
        setLoading(false);
        return;
      }
      const list = ((data ?? []) as unknown as AuditRow[]).map((r) => ({
        ...r,
        changed_fields: Array.isArray(r.changed_fields) ? r.changed_fields : [],
      }));
      setHasMore(list.length === PAGE_SIZE);
      setRows((prev) => (append ? [...prev, ...list] : list));
      setLoading(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    pageRef.current = 0;
    void fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    pageRef.current += 1;
    void fetchPage(pageRef.current, true);
  }, [fetchPage]);

  const actors = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.actor_id) m.set(r.actor_id, r.actor_email ?? r.actor_id);
    return Array.from(m, ([id, email]) => ({ id, email }));
  }, [rows]);

  return { rows, loading, hasMore, loadMore, actors, reload: () => fetchPage(0, false) };
}