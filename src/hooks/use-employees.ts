import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, mutateCache, setCache } from "@/lib/shared-cache";
import { revokeEmployeeSession } from "@/lib/employee-auth.functions";

export interface EmployeeRow {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  avatar: string;
  status: "active" | "inactive";
  photo_url: string;
  contact_number: string;
  employee_code: string;
  custom_fields: Record<string, unknown>;
}

export type EmployeeInput = Omit<EmployeeRow, "id" | "user_id" | "avatar"> & {
  id?: string;
  avatar?: string;
};

function makeAvatar(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function friendlyError(message: string) {
  if (message.includes("employees_company_email_unique")) {
    return "An employee with this email already exists in this company.";
  }
  return message;
}

const CACHE_KEY = "employees";

async function fetchEmployees(): Promise<EmployeeRow[]> {
  const { data, error } = await supabase.from("employees").select("*").order("name");
  if (error) {
    toast.error(`Failed to load employees: ${error.message}`);
    return [];
  }
  return (data ?? []) as unknown as EmployeeRow[];
}

export function useEmployees() {
  const { data, loading, reload } = useSharedResource<EmployeeRow[]>(
    CACHE_KEY,
    fetchEmployees,
  );
  const employees = data ?? [];

  const buildPayload = (input: EmployeeInput) => ({
    name: input.name,
    email: input.email,
    role: input.role,
    department_id: input.department_id,
    status: input.status,
    avatar: input.avatar || makeAvatar(input.name),
    photo_url: input.photo_url ?? "",
    contact_number: input.contact_number ?? "",
    employee_code: input.employee_code ?? "",
    custom_fields: input.custom_fields ?? {},
  });

  const addEmployee = async (input: EmployeeInput) => {
    const { data, error } = await supabase
      .from("employees")
      .insert(buildPayload(input) as any)
      .select()
      .single();
    if (error) {
      toast.error(friendlyError(error.message));
      return null;
    }
    mutateCache<EmployeeRow[]>(CACHE_KEY, (list) =>
      [...list, data as unknown as EmployeeRow].sort((a, b) => a.name.localeCompare(b.name)),
    );
    toast.success("Employee added");
    return data as unknown as EmployeeRow;
  };

  const updateEmployee = async (id: string, input: EmployeeInput) => {
    const prev = employees.find((e) => e.id === id);
    const { data, error } = await supabase
      .from("employees")
      .update(buildPayload(input) as any)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      toast.error(friendlyError(error.message));
      return null;
    }
    const updated = data as unknown as EmployeeRow;
    mutateCache<EmployeeRow[]>(CACHE_KEY, (list) =>
      list.map((e) => (e.id === id ? updated : e)),
    );
    // If admin just deactivated an employee linked to an auth user, revoke all their sessions.
    if (
      prev &&
      prev.status !== "inactive" &&
      updated.status === "inactive" &&
      updated.user_id
    ) {
      revokeEmployeeSession({ data: { userId: updated.user_id } }).catch((err) => {
        console.error("Failed to revoke sessions for inactive employee:", err);
      });
    }
    toast.success("Employee updated");
    return updated;
  };

  const deleteEmployee = async (id: string) => {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    mutateCache<EmployeeRow[]>(CACHE_KEY, (list) => list.filter((e) => e.id !== id));
    toast.success("Employee deleted");
    return true;
  };

  return { employees, loading, addEmployee, updateEmployee, deleteEmployee, reload };
}

export { setCache as _setEmployeesCache };
