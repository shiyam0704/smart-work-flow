import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/departments")({
  component: () => (
      <RoleGuard allow={["manager", "executive", "officer"]} permission="nav.departments">
      <Outlet />
    </RoleGuard>
  ),
});
