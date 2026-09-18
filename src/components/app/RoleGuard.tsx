import { CNavigate as Navigate } from "@/lib/nav";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { useRolePermissions } from "@/hooks/use-permissions";

export function RoleGuard({
  allow,
  permission,
  children,
}: {
  allow?: AppRole[];
  /** A single key, or several keys where any one grants access. */
  permission?: string | string[];
  children: React.ReactNode;
}) {
  const { loading: authLoading, roles, isAdmin } = useAuth();
  const { loading: permLoading, isAllowed } = useRolePermissions();
  if (authLoading || permLoading) return null;
  if (isAdmin) return <>{children}</>;
  const keys = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  const okByRole = allow ? roles.some((r) => allow.includes(r)) : false;
  const okByPerm = keys.length > 0 ? keys.some((k) => roles.some((r) => isAllowed(r, k))) : false;
  const ok = okByRole || okByPerm;
  if (!ok) return <Navigate to="/c/$slug/dashboard" replace />;
  return <>{children}</>;
}
