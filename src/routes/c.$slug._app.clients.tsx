import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/clients")({
  component: () => (
      <RoleGuard allow={["manager", "executive"]} permission="nav.clients">
      <Outlet />
    </RoleGuard>
  ),
});
