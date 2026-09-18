import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { Topbar } from "@/components/app/Topbar";
import { RoleGuard } from "@/components/app/RoleGuard";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/c/$slug/_app/settings")({
  component: () => (
    <RoleGuard allow={[]} permission="nav.settings">
      <SettingsLayout />
    </RoleGuard>
  ),
  head: () => ({ meta: [{ title: "Settings — Smart Work Flow" }] }),
});

function SettingsLayout() {
  const loc = useLocation();
  const isIndex = /\/settings\/?$/.test(loc.pathname);
  return (
    <>
      <Topbar title="Settings" subtitle="Configure departments, fields and workflow" />
      {!isIndex && (
        <div className="px-6 pt-4">
          <Link
            to="/c/$slug/settings"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ChevronLeft className="w-4 h-4" /> All settings
          </Link>
        </div>
      )}
      <div className={isIndex ? "" : "p-6"}>
        <Outlet />
      </div>
    </>
  );
}
