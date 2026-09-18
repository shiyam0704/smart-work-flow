import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache, mutateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";

export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export interface ProjectRow {
  id: string;
  client_id: string;
  name: string;
  start_date: string | null;
  deadline_date: string | null;
  status: "not_started" | "active" | "on_hold" | "completed" | "archived";
  priority: ProjectPriority;
  custom_fields: Record<string, string | number | boolean>;
  quoted_price: number | null;
  final_price: number | null;
  work_details: string;
  location_address: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_place_id: string | null;
  location_url: string | null;
  created_by: string | null;
  created_at: string;
  department_ids: string[];
}

export interface ProjectInput {
  client_id: string;
  name: string;
  start_date: string | null;
  deadline_date: string | null;
  status: ProjectRow["status"];
  priority: ProjectPriority;
  custom_fields: Record<string, string | number | boolean>;
  quoted_price: number | null;
  final_price: number | null;
  work_details: string;
  department_ids: string[];
}



const EVENT = "projects:changed";
const emit = () => window.dispatchEvent(new Event(EVENT));
const CACHE_KEY = "projects";

async function fetchProjects(): Promise<ProjectRow[]> {
  const [{ data: p, error: e1 }, { data: pd, error: e2 }] = await Promise.all([
    supabase.from("projects" as any).select("*").order("created_at", { ascending: false }),
    supabase.from("project_departments" as any).select("*"),
  ]);
  if (e1) toast.error(`Failed to load projects: ${e1.message}`);
  if (e2) toast.error(`Failed to load project departments: ${e2.message}`);
  const links = (pd ?? []) as any[];
  return ((p ?? []) as any[]).map((row) => ({
    ...row,
    custom_fields: row.custom_fields ?? {},
    department_ids: links.filter((l) => l.project_id === row.id).map((l) => l.department_id),
  })) as ProjectRow[];
}

export function useProjects() {
  const { data, loading, reload } = useSharedResource<ProjectRow[]>(
    CACHE_KEY,
    fetchProjects,
    { eventName: EVENT },
  );
  const projects = data ?? [];

  useEffect(() => {
    return subscribeTables("projects", ["projects", "project_departments"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const getProject = (id: string) => projects.find((p) => p.id === id);

  const writeDepartments = async (projectId: string, deptIds: string[]) => {
    await supabase.from("project_departments" as any).delete().eq("project_id", projectId);
    if (deptIds.length) {
      const { error } = await supabase
        .from("project_departments" as any)
        .insert(deptIds.map((d) => ({ project_id: projectId, department_id: d })));
      if (error) toast.error(error.message);
    }
  };

  const addProject = async (input: ProjectInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("projects" as any)
      .insert({
        client_id: input.client_id,
        name: input.name,
        start_date: input.start_date,
        deadline_date: input.deadline_date,
        status: input.status,
        priority: input.priority,
        custom_fields: input.custom_fields,
        quoted_price: input.quoted_price,
        final_price: input.final_price,
        work_details: input.work_details,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    const created = data as any;
    await writeDepartments(created.id, input.department_ids);
    await reload();
    emit();
    toast.success("Project created");
    return created.id as string;
  };

  const updateProject = async (id: string, input: ProjectInput) => {
    const { error } = await supabase
      .from("projects" as any)
      .update({
        client_id: input.client_id,
        name: input.name,
        start_date: input.start_date,
        deadline_date: input.deadline_date,
        status: input.status,
        priority: input.priority,
        custom_fields: input.custom_fields,
        quoted_price: input.quoted_price,
        final_price: input.final_price,
        work_details: input.work_details,
      })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await writeDepartments(id, input.department_ids);
    await reload();
    emit();
    toast.success("Project updated");
    return true;
  };


  const deleteProject = async (id: string) => {
    const { error } = await supabase.from("projects" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    mutateCache<ProjectRow[]>(CACHE_KEY, (list) => list.filter((p) => p.id !== id));
    emit();
    toast.success("Project deleted");
  };

  return { projects, loading, getProject, addProject, updateProject, deleteProject, reload };
}

