import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/components/app/RoleGuard";

export const Route = createFileRoute("/c/$slug/_app/reports")({
  component: () => (
      <RoleGuard allow={["manager"]} permission="nav.reports">
      <Outlet />
    </RoleGuard>
  ),
  head: () => ({ meta: [{ title: "Reports — Smart Work Flow" }] }),
});
