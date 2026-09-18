import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/projects")({
  component: () => (
      <RoleGuard allow={["manager", "executive"]} permission="nav.projects">
      <Outlet />
    </RoleGuard>
  ),
});
