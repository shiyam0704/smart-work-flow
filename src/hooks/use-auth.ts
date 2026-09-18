import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  readActiveCompanyId,
  type LocalSession,
  type LocalUser,
} from "@/lib/active-company";
import { useSharedResource } from "@/lib/shared-cache";
import { defaultAllowed } from "@/lib/permissions";

type User = LocalUser;
type Session = LocalSession;

export type AppRole = "super_admin" | "admin" | "manager" | "executive" | "officer" | "staff";

export interface DeptScope {
  role: AppRole;
  department_id: string;
}

export interface EmpFlags {
  isInactive: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  deptScopes: DeptScope[];
  empFlags: EmpFlags;
  loading: boolean;
}

export interface AuthHelpers {
  isSuperAdmin: boolean;
  companyId: string | null;
  isAdmin: boolean;
  isManager: boolean;
  isExecutive: boolean;
  isOfficer: boolean;
  isStaff: boolean;
  executiveDeptIds: string[];
  officerDeptIds: string[];
  allManagedDeptIds: string[];
  canManageDept: (deptId: string | null | undefined) => boolean;
  canViewDept: (deptId: string | null | undefined) => boolean;
  canAccessLeads: boolean;
  canViewFinancials: boolean;
  canAccessEmployees: boolean;
  isInactive: boolean;
}

const ROLES_CACHE_KEY = "sm-auth-roles-v2";

const EMPTY_FLAGS: EmpFlags = {
  isInactive: false,
};

interface CachedRoles {
  userId: string;
  roles: AppRole[];
  deptScopes: DeptScope[];
  empFlags?: EmpFlags;
}

function readRolesCache(userId: string): CachedRoles | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ROLES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRoles;
    return parsed.userId === userId ? parsed : null;
  } catch {
    return null;
  }
}

function writeRolesCache(c: CachedRoles) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ROLES_CACHE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function useAuth(): AuthState & AuthHelpers {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    roles: [],
    deptScopes: [],
    empFlags: EMPTY_FLAGS,
    loading: true,
  });

  // Role-based permissions matrix (managed at Settings → Roles & Permissions).
  const { data: permRows } = useSharedResource<
    { role: AppRole; permission_key: string; allowed: boolean }[]
  >(
    "role_permissions",
    async () => {
      const { data, error } = await supabase.from("role_permissions" as any).select("*");
      if (error) return [];
      return (data ?? []) as any;
    },
    { eventName: "role-permissions:changed" },
  );

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (!user) {
        if (typeof window !== "undefined") sessionStorage.removeItem(ROLES_CACHE_KEY);
        if (active) {
          setState({
            user: null,
            session: null,
            roles: [],
            deptScopes: [],
            empFlags: EMPTY_FLAGS,
            loading: false,
          });
        }
        return;
      }
      const cached = readRolesCache(user.id);
      if (active) {
        setState({
          user,
          session,
          roles: cached?.roles ?? [],
          deptScopes: cached?.deptScopes ?? [],
          empFlags: cached?.empFlags ?? EMPTY_FLAGS,
          loading: !cached,
        });
      }
      setTimeout(() => {
        if (active) loadRoles(user.id, () => active);
      }, 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadRoles(userId: string, isMounted?: () => boolean) {
    const activeCompanyId = readActiveCompanyId();
    let empQuery = supabase.from("employees").select("status").eq("user_id", userId);
    if (activeCompanyId) {
      empQuery = (empQuery as any).eq("company_id", activeCompanyId);
    }
    const [{ data: roleRows }, { data: deptRows }, { data: empRow }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_role_departments")
        .select("role, department_id")
        .eq("user_id", userId),
      empQuery.maybeSingle(),
    ]);
    if (isMounted && !isMounted()) return;
    const roles = (roleRows ?? []).map((r: any) => r.role as AppRole);
    const deptScopes = (deptRows ?? []).map((r: any) => ({
      role: r.role as AppRole,
      department_id: r.department_id as string,
    }));
    const isInactive = !!(empRow as any) && (empRow as any).status === "inactive";
    const empFlags: EmpFlags = { isInactive };
    if (isInactive) {
      if (typeof window !== "undefined") sessionStorage.removeItem(ROLES_CACHE_KEY);
      if (!isMounted || isMounted()) {
        setState((s) => ({
          ...s,
          roles: [],
          deptScopes: [],
          empFlags: { ...EMPTY_FLAGS, isInactive: true },
          loading: false,
        }));
      }
      await supabase.auth.signOut();
      return;
    }
    writeRolesCache({ userId, roles, deptScopes, empFlags });
    if (!isMounted || isMounted()) {
      setState((s) => ({ ...s, roles, deptScopes, empFlags, loading: false }));
    }
  }


  const isSuperAdmin = state.roles.includes("super_admin");
  const isAdmin = isSuperAdmin || state.roles.includes("admin");
  const companyId = isSuperAdmin ? null : readActiveCompanyId();
  const isManager = isAdmin || state.roles.includes("manager");
  const isExecutive = state.roles.includes("executive");
  const isOfficer = state.roles.includes("officer");
  const isStaff = state.roles.includes("staff");

  const executiveDeptIds = state.deptScopes
    .filter((s) => s.role === "executive")
    .map((s) => s.department_id);
  const officerDeptIds = state.deptScopes
    .filter((s) => s.role === "officer")
    .map((s) => s.department_id);
  const allManagedDeptIds = Array.from(
    new Set([...executiveDeptIds, ...officerDeptIds]),
  );

  const canManageDept = (deptId: string | null | undefined) => {
    if (!deptId) return isManager;
    if (isManager) return true;
    return allManagedDeptIds.includes(deptId);
  };
  const canViewDept = canManageDept;

  const rows = permRows ?? [];
  const roleHas = (role: AppRole, key: string): boolean => {
    if (role === "admin") return true;
    const row = rows.find((r) => r.role === role && r.permission_key === key);
    return row ? row.allowed : defaultAllowed(role, key);
  };
  const anyRoleHas = (key: string) =>
    isAdmin || state.roles.some((r) => roleHas(r, key));
  const canAccessLeads = anyRoleHas("nav.leads");
  const canViewFinancials = anyRoleHas("data.financials");
  const canAccessEmployees = anyRoleHas("nav.employees");
  const isInactive = state.empFlags.isInactive;

  return {
    ...state,
    isSuperAdmin,
    companyId,
    isAdmin,
    isManager,
    isExecutive,
    isOfficer,
    isStaff,
    executiveDeptIds,
    officerDeptIds,
    allManagedDeptIds,
    canManageDept,
    canViewDept,
    canAccessLeads,
    canViewFinancials,
    canAccessEmployees,
    isInactive,
  };
}
