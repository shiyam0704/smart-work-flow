import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache, mutateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import { readActiveCompanyId } from "@/lib/active-company";
import { isCompletedStateName } from "@/lib/task-status";

async function syncProjectStatus(projectId: string | null | undefined) {
  if (!projectId || projectId === "__none__" || (typeof projectId === "string" && projectId.trim() === "")) return;
  const [projRes, taskRes, stateRes] = await Promise.all([
    supabase.from("projects" as any).select("status").eq("id", projectId).maybeSingle(),
    supabase.from("tasks").select("status_id").eq("project_id", projectId),
    (supabase.from("workflow_states" as any) as any).select("id, name, is_completed"),
  ]);
  const proj = projRes.data as { status: string } | null;
  const projTasks = (taskRes.data ?? []) as { status_id: string | null }[];
  const states = (stateRes.data ?? []) as { id: string; name: string; is_completed?: boolean }[];
  if (!proj) return;
  // Bug #22: Preserve manual statuses like on_hold or cancelled
  if (["on_hold", "cancelled", "archived"].includes(proj.status)) return;

  const completedIds = new Set(states.filter((s) => s.is_completed || isCompletedStateName(s.name)).map((s) => s.id));
  const allDone = projTasks.length > 0 && projTasks.every((t) => t.status_id && completedIds.has(t.status_id));
  let next: string | null = null;
  if (allDone && proj.status !== "completed") next = "completed";
  else if (!allDone && proj.status === "completed") next = "active";
  if (next) {
    await supabase.from("projects" as any).update({ status: next }).eq("id", projectId);
    window.dispatchEvent(new Event("projects:changed"));
  }
}

function computeNextDueDate(currentDueDate: string | null, rule: RepeatRule): string {
  const base = currentDueDate ? new Date(currentDueDate) : new Date();
  const next = new Date(base);
  if (rule === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (rule === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (rule === "monthly") {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().slice(0, 10);
}


export type RepeatRule = "none" | "daily" | "weekly" | "monthly";

export interface TaskRow {
  id: string;
  company_id: string | null;
  title: string;
  description: string;
  client_id: string | null;
  department_id: string | null;
  project_id: string | null;
  status_id: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
  created_by: string | null;
  repeat_rule: RepeatRule;
  parent_task_id: string | null;
  assignee_ids: string[];
}

export interface TaskInput {
  title: string;
  description: string;
  client_id: string | null;
  department_id: string | null;
  project_id: string | null;
  status_id: string | null;
  priority: TaskRow["priority"];
  due_date: string | null;
  repeat_rule?: RepeatRule;
  assignee_ids: string[];
}

export type TaskUpdateInput = Partial<
  Pick<
    TaskRow,
    | "title"
    | "description"
    | "client_id"
    | "department_id"
    | "project_id"
    | "status_id"
    | "priority"
    | "due_date"
    | "repeat_rule"
  >
> & {
  assignee_ids?: string[];
};

const CACHE_KEY = "tasks";

async function fetchTasks(): Promise<TaskRow[]> {
  const activeCompanyId = readActiveCompanyId();
  let taskQuery = supabase.from("tasks").select("*").order("created_at", { ascending: false });
  let assigneeQuery = supabase.from("task_assignees").select("*");

  if (activeCompanyId) {
    taskQuery = taskQuery.eq("company_id", activeCompanyId);
    assigneeQuery = assigneeQuery.eq("company_id", activeCompanyId);
  }

  const [{ data: t, error: e1 }, { data: a, error: e2 }] = await Promise.all([
    taskQuery,
    assigneeQuery,
  ]);
  if (e1) toast.error(`Failed to load tasks: ${e1.message}`);
  if (e2) toast.error(`Failed to load assignees: ${e2.message}`);
  const links = a ?? [];
  return ((t ?? []) as any[]).map((row) => ({
    ...row,
    project_id: row.project_id ?? null,
    assignee_ids: links.filter((l: any) => l.task_id === row.id).map((l: any) => l.employee_id),
  })) as TaskRow[];
}

export function useTasks() {
  const { data, loading, reload } = useSharedResource<TaskRow[]>(
    CACHE_KEY,
    fetchTasks,
    { eventName: "tasks:changed" },
  );
  const tasks = data ?? [];

  useEffect(() => {
    return subscribeTables("tasks", ["tasks", "task_assignees"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const addTask = async (input: TaskInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const activeCompanyId = readActiveCompanyId();

    const sanitizedProjectId =
      input.project_id &&
      typeof input.project_id === "string" &&
      input.project_id !== "__none__" &&
      input.project_id.trim() !== ""
        ? input.project_id.trim()
        : null;

    let finalStatusId = input.status_id;
    if (!finalStatusId) {
      let stateQuery = (supabase.from("workflow_states" as any) as any)
        .select("id, name, is_completed")
        .eq("is_completed", false);
      if (activeCompanyId) {
        stateQuery = stateQuery.eq("company_id", activeCompanyId);
      }
      const { data: defaultState } = await stateQuery
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      finalStatusId = defaultState?.id ?? null;
    }

    const payload: any = {
      title: input.title,
      description: input.description,
      client_id: input.client_id ?? null,
      department_id: input.department_id ?? null,
      project_id: sanitizedProjectId,
      status_id: finalStatusId,
      priority: input.priority,
      due_date: input.due_date,
      repeat_rule: input.repeat_rule ?? "none",
      created_by: userData.user?.id ?? null,
      company_id: activeCompanyId ?? null,
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select().single();
    if (error) { toast.error(error.message); return null; }
    if (input.assignee_ids.length) {
      const { error: aErr } = await supabase.from("task_assignees").insert(
        input.assignee_ids.map((eid) => ({
          task_id: data.id,
          employee_id: eid,
          company_id: activeCompanyId ?? null,
        }))
      );
      if (aErr) toast.error(`Saved task but couldn't assign: ${aErr.message}`);
    }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event("tasks:changed"));
    await syncProjectStatus(sanitizedProjectId);
    toast.success("Task created");
    return data.id as string;
  };

  const updateTask = async (id: string, patch: TaskUpdateInput) => {
    const { assignee_ids, ...rawFields } = patch;
    const affected = tasks.find((t) => t.id === id);

    const fields: Record<string, any> = { ...rawFields };
    if ("project_id" in fields) {
      fields.project_id =
        fields.project_id &&
        typeof fields.project_id === "string" &&
        fields.project_id !== "__none__" &&
        fields.project_id.trim() !== ""
          ? fields.project_id.trim()
          : null;
    }

    if (Object.keys(fields).length) {
      const { error } = await supabase.from("tasks").update(fields as any).eq("id", id);
      if (error) { toast.error(error.message); return false; }

      // Bug #21: If task status changed to a completed state, generate next recurring task
      if (patch.status_id && affected && affected.status_id !== patch.status_id && affected.repeat_rule && affected.repeat_rule !== "none") {
        const { data: stateData } = await (supabase.from("workflow_states" as any) as any)
          .select("id, name, is_completed")
          .eq("id", patch.status_id)
          .maybeSingle();
        const isCompleted = stateData?.is_completed || (stateData?.name && isCompletedStateName(stateData.name));
        if (isCompleted) {
          const nextDue = computeNextDueDate(affected.due_date, affected.repeat_rule);
          const { data: firstState } = await (supabase.from("workflow_states" as any) as any)
            .select("id")
            .eq("is_completed", false)
            .order("sort_order", { ascending: true })
            .limit(1)
            .maybeSingle();
          const initialStatusId = firstState?.id ?? null;
          const { data: userData } = await supabase.auth.getUser();

          const { data: nextTask, error: nErr } = await supabase.from("tasks").insert({
            title: fields.title ?? affected.title,
            description: fields.description ?? affected.description,
            client_id: fields.client_id !== undefined ? fields.client_id : affected.client_id,
            department_id: fields.department_id !== undefined ? fields.department_id : affected.department_id,
            project_id: fields.project_id !== undefined ? fields.project_id : affected.project_id,
            status_id: initialStatusId,
            priority: fields.priority ?? affected.priority,
            due_date: nextDue,
            repeat_rule: fields.repeat_rule ?? affected.repeat_rule,
            parent_task_id: affected.id,
            created_by: userData.user?.id ?? null,
          } as any).select().single();

          if (!nErr && nextTask) {
            const assigneesToCopy = assignee_ids ?? affected.assignee_ids;
            if (assigneesToCopy.length) {
              await supabase.from("task_assignees").insert(
                assigneesToCopy.map((eid) => ({
                  task_id: nextTask.id,
                  employee_id: eid,
                  company_id: affected.company_id ?? null,
                }))
              );
            }
          }
        }
      }
    }
    const activeCompanyId = readActiveCompanyId();
    if (assignee_ids !== undefined) {
      const { error: dErr } = await supabase.from("task_assignees").delete().eq("task_id", id);
      if (dErr) { toast.error(dErr.message); return false; }
      if (assignee_ids.length) {
        const { error: iErr } = await supabase.from("task_assignees").insert(
          assignee_ids.map((eid) => ({
            task_id: id,
            employee_id: eid,
            company_id: activeCompanyId ?? affected?.company_id ?? null,
          }))
        );
        if (iErr) { toast.error(iErr.message); return false; }
      }
    }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event("tasks:changed"));

    const oldProj = affected?.project_id;
    const newProj = fields.project_id !== undefined ? fields.project_id : oldProj;
    if (oldProj && oldProj !== newProj) {
      await syncProjectStatus(oldProj);
    }
    if (newProj) {
      await syncProjectStatus(newProj);
    }

    toast.success("Task updated");
    return true;
  };

  const deleteTask = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    await supabase.from("task_assignees").delete().eq("task_id", id);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    invalidateCache(CACHE_KEY);
    mutateCache<TaskRow[]>(CACHE_KEY, (list) => list.filter((t) => t.id !== id));
    window.dispatchEvent(new Event("tasks:changed"));
    await syncProjectStatus(target?.project_id ?? null);
    toast.success("Task deleted");
    return true;
  };

  const duplicateTask = async (id: string) => {
    const src = tasks.find((t) => t.id === id);
    if (!src) { toast.error("Task not found"); return null; }
    const { data: userData } = await supabase.auth.getUser();
    const activeCompanyId = readActiveCompanyId();
    const { data: yetState } = await (supabase.from("workflow_states" as any) as any)
      .select("id")
      .eq("is_completed", false)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    const activeStatusId = (yetState as any)?.id ?? null;
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: `${src.title} (Copy)`,
        description: "",
        client_id: src.client_id,
        department_id: src.department_id,
        project_id: src.project_id ?? null,
        status_id: activeStatusId,
        priority: src.priority,
        due_date: src.due_date,
        created_by: userData.user?.id ?? null,
        company_id: activeCompanyId ?? src.company_id ?? null,
      })
      .select()
      .single();
    if (error) { toast.error(error.message); return null; }
    if (src.assignee_ids.length) {
      const { error: aErr } = await supabase.from("task_assignees").insert(
        src.assignee_ids.map((eid) => ({
          task_id: data.id,
          employee_id: eid,
          company_id: activeCompanyId ?? src.company_id ?? null,
        }))
      );
      if (aErr) toast.error(`Duplicated task but couldn't copy assignees: ${aErr.message}`);
    }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event("tasks:changed"));
    await syncProjectStatus(src.project_id ?? null);
    toast.success("Task duplicated");
    return data.id as string;
  };

  return { tasks, loading, addTask, updateTask, deleteTask, duplicateTask, reload, refresh: reload };
}

