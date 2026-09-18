import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";

export interface TemplateTaskRow {
  id: string;
  template_id: string;
  title: string;
  department_id: string | null;
  due_offset_days: number;
  sort_order: number;
  assignee_ids: string[];
}

export interface TemplateRow {
  id: string;
  name: string;
  description: string;
  department_ids: string[];
  created_at: string;
  tasks: TemplateTaskRow[];
}

export interface TemplateTaskInput {
  title: string;
  department_id: string | null;
  due_offset_days: number;
  assignee_ids: string[];
}

const CACHE_KEY = "project_templates";
const EVENT = "project-templates:changed";
const emit = () => window.dispatchEvent(new Event(EVENT));

async function fetchTemplates(): Promise<TemplateRow[]> {
  const [
    { data: tpls, error: e1 },
    { data: tasks, error: e2 },
    { data: assigns, error: e3 },
  ] = await Promise.all([
    supabase.from("project_templates" as any).select("*").order("created_at", { ascending: false }),
    supabase.from("project_template_tasks" as any).select("*").order("sort_order"),
    supabase.from("project_template_task_assignees" as any).select("*"),
  ]);
  if (e1) toast.error(`Failed to load templates: ${e1.message}`);
  if (e2) toast.error(`Failed to load template tasks: ${e2.message}`);
  if (e3) toast.error(`Failed to load template assignees: ${e3.message}`);
  const taskList = (tasks ?? []) as any[];
  const assignList = (assigns ?? []) as any[];
  return ((tpls ?? []) as any[]).map((t) => ({
    ...t,
    department_ids: t.department_ids ?? [],
    tasks: taskList
      .filter((x) => x.template_id === t.id)
      .map((x) => ({
        ...x,
        assignee_ids: assignList
          .filter((a) => a.template_task_id === x.id)
          .map((a) => a.employee_id as string),
      })) as TemplateTaskRow[],
  })) as TemplateRow[];
}

export function useProjectTemplates() {
  const { data, loading, reload } = useSharedResource<TemplateRow[]>(CACHE_KEY, fetchTemplates, {
    eventName: EVENT,
  });
  const templates = data ?? [];

  useEffect(() => {
    return subscribeTables(
      "project_templates",
      ["project_templates", "project_template_tasks", "project_template_task_assignees"],
      () => {
        invalidateCache(CACHE_KEY);
        reload();
      },
    );
  }, [reload]);

  const writeAssignees = async (templateTaskId: string, employeeIds: string[]) => {
    await supabase
      .from("project_template_task_assignees" as any)
      .delete()
      .eq("template_task_id", templateTaskId);
    if (employeeIds.length) {
      const { error } = await supabase
        .from("project_template_task_assignees" as any)
        .insert(employeeIds.map((eid) => ({ template_task_id: templateTaskId, employee_id: eid })));
      if (error) toast.error(error.message);
    }
  };

  const saveTemplate = async (
    input: { id?: string; name: string; description: string; department_ids: string[] },
    tasks: TemplateTaskInput[],
  ) => {
    let templateId = input.id;

    if (templateId) {
      const { error } = await supabase
        .from("project_templates" as any)
        .update({
          name: input.name,
          description: input.description,
          department_ids: input.department_ids,
        })
        .eq("id", templateId);
      if (error) {
        toast.error(error.message);
        return null;
      }
      // delete existing tasks & cascade assignees
      await supabase.from("project_template_tasks" as any).delete().eq("template_id", templateId);
    } else {
      const { data, error } = await supabase
        .from("project_templates" as any)
        .insert({
          name: input.name,
          description: input.description,
          department_ids: input.department_ids,
        })
        .select()
        .single();
      if (error || !data) {
        toast.error(error?.message ?? "Failed to create template");
        return null;
      }
      templateId = (data as any).id as string;
    }

    let failed = 0;
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const { data: tt, error: te } = await supabase
        .from("project_template_tasks" as any)
        .insert({
          template_id: templateId,
          title: t.title,
          department_id: t.department_id,
          due_offset_days: t.due_offset_days,
          sort_order: i,
        })
        .select()
        .single();
      if (te || !tt) {
        failed++;
        toast.error(`Couldn't save task "${t.title}": ${te?.message ?? ""}`);
        continue;
      }
      if (t.assignee_ids.length) {
        await writeAssignees((tt as any).id, t.assignee_ids);
      }
    }

    await reload();
    emit();
    if (failed > 0) {
      toast.error(`${failed} of ${tasks.length} template tasks couldn't be saved`);
      return null;
    }
    toast.success(
      `${input.id ? "Template updated" : "Template created"} · ${tasks.length} task${tasks.length === 1 ? "" : "s"}`,
    );
    return templateId;
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("project_templates" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    await reload();
    emit();
    toast.success("Template deleted");
  };

  return { templates, loading, reload, saveTemplate, deleteTemplate };
}

/**
 * Apply a template's tasks to an already-created project.
 * Reads the template directly from the DB so callers don't need to load it.
 */
export async function applyProjectTemplate(
  projectId: string,
  templateId: string,
  clientId: string,
  options?: { replaceExisting?: boolean },
) {
  const { data: userData } = await supabase.auth.getUser();
  const [{ data: tasks }, { data: assigns }, { data: yetState }, { data: projectRow }] = await Promise.all([
    supabase
      .from("project_template_tasks" as any)
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order"),
    supabase.from("project_template_task_assignees" as any).select("*"),
    supabase.from("workflow_states").select("id").ilike("name", "yet to do").maybeSingle(),
    supabase.from("projects" as any).select("deadline_date").eq("id", projectId).maybeSingle(),
  ]);
  const yetToDoId = (yetState as any)?.id ?? null;
  const assignList = (assigns ?? []) as any[];
  const deadline = (projectRow as any)?.deadline_date as string | null | undefined;
  const templateTasks = ((tasks ?? []) as any[]);

  if (templateTasks.length === 0) {
    toast.info("This template has no tasks, so nothing was changed.");
    return;
  }

  if (options?.replaceExisting) {
    const { error: delErr } = await supabase.from("tasks").delete().eq("project_id", projectId);
    if (delErr) {
      toast.error(`Couldn't remove existing tasks: ${delErr.message}`);
      return;
    }
  }

  const computeDue = (offset: number): string | null => {
    if (!deadline) return null;
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - (offset || 0));
    return d.toISOString().slice(0, 10);
  };

  let created = 0;
  for (const t of templateTasks) {
    const { data: newTask, error: ie } = await supabase
      .from("tasks")
      .insert({
        title: t.title,
        description: "",
        client_id: clientId,
        department_id: t.department_id ?? null,
        project_id: projectId,
        status_id: yetToDoId,
        priority: "medium",
        due_date: computeDue(t.due_offset_days ?? 0),
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single();
    if (ie || !newTask) {
      toast.error(`Couldn't create task "${t.title}": ${ie?.message ?? ""}`);
      continue;
    }
    created++;
    const links = assignList.filter((a) => a.template_task_id === t.id);
    if (links.length) {
      const { error: ae } = await supabase
        .from("task_assignees")
        .insert(links.map((l) => ({ task_id: (newTask as any).id, employee_id: l.employee_id })));
      if (ae) toast.error(`Assignees for "${t.title}": ${ae.message}`);
    }
  }
  window.dispatchEvent(new Event("tasks:changed"));
  if (created > 0) {
    toast.success(`${created} task${created === 1 ? "" : "s"} created from template`);
  }
}
