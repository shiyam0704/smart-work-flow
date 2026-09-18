import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { defaultAllowed, manageKeyForMenu } from "@/lib/permissions";

export interface RolePermissionRow {
  id?: string;
  role: AppRole;
  permission_key: string;
  allowed: boolean;
}

const CACHE_KEY = "role_permissions";
const EVENT = "role-permissions:changed";

async function fetchRolePermissions(): Promise<RolePermissionRow[]> {
  const { data, error } = await supabase.from("role_permissions" as any).select("*");
  if (error) {
    toast.error(`Failed to load permissions: ${error.message}`);
    return [];
  }
  return (data ?? []) as unknown as RolePermissionRow[];
}

export function useRolePermissions() {
  const { data, loading, reload } = useSharedResource<RolePermissionRow[]>(
    CACHE_KEY,
    fetchRolePermissions,
    { eventName: EVENT },
  );
  const rows = data ?? [];

  const isAllowed = useCallback(
    (role: AppRole, key: string): boolean => {
      if (role === "admin") return true;
      const row = rows.find((r) => r.role === role && r.permission_key === key);
      return row ? row.allowed : defaultAllowed(role, key);
    },
    [rows],
  );

  const setAllowed = useCallback(async (role: AppRole, key: string, allowed: boolean) => {
    if (role === "admin") return; // admin always allowed
    const { error } = await supabase
      .from("role_permissions" as any)
      .upsert(
        { role, permission_key: key, allowed },
        { onConflict: "company_id,role,permission_key" },
      );
    if (error) { toast.error(error.message); return; }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  }, [reload]);

  return { rows, loading, isAllowed, setAllowed, reload };
}

/** Returns true if the current signed-in user has permission for `key`. */
export function useHasPermission(key: string): boolean {
  const { isAdmin, roles } = useAuth();
  const { isAllowed } = useRolePermissions();
  if (isAdmin) return true;
  return roles.some((r) => isAllowed(r, key));
}

/** True if the user has ANY of the given permission keys. */
export function useHasAnyPermission(keys: string[]): boolean {
  const { isAdmin, roles } = useAuth();
  const { isAllowed } = useRolePermissions();
  if (isAdmin) return true;
  return keys.some((k) => roles.some((r) => isAllowed(r, k)));
}

/**
 * Returns true if the current user may add/edit/delete inside a menu
 * (e.g. useCanManage("stock")). Menus without a manage permission fall back
 * to true so existing behaviour is unchanged.
 */
export function useCanManage(menuKey: string): boolean {
  const key = manageKeyForMenu(menuKey);
  const allowed = useHasPermission(key ?? "__none__");
  return key ? allowed : true;
}
