import { useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees, type EmployeeRow } from "@/hooks/use-employees";

export function useCurrentEmployee(): EmployeeRow | null {
  const { user } = useAuth();
  const { employees } = useEmployees();
  return useMemo(() => {
    if (!user) return null;
    return employees.find((e) => e.user_id === user.id) ?? null;
  }, [user, employees]);
}
