import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CNavigate as Navigate } from "@/lib/nav";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/c/$slug/_app/leads")({
  component: LeadsLayout,
});

function LeadsLayout() {
  const { loading, canAccessLeads } = useAuth();
  if (loading) return null;
  if (!canAccessLeads) return <Navigate to="/c/$slug/dashboard" replace />;
  return <Outlet />;
}
