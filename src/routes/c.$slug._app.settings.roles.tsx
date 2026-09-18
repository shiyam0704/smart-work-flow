import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useRolePermissions } from "@/hooks/use-permissions";
import {
  NON_ADMIN_ROLES,
  ROLE_LABELS,
  ROLE_HINTS,
  PERMISSION_MENUS,
  permissionByKey,
} from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$slug/_app/settings/roles")({
  component: RolesPage,
  head: () => ({
    meta: [
      { title: "Roles & Permissions — Smart Work Flow" },
      { name: "description", content: "Set what each role can view and manage in every menu." },
      { property: "og:title", content: "Roles & Permissions — Smart Work Flow" },
      { property: "og:description", content: "Set what each role can view and manage in every menu." },
    ],
  }),
});

function RolesPage() {
  const { isAllowed, setAllowed, loading } = useRolePermissions();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function toggle(role: AppRole, key: string, next: boolean) {
    try {
      await setAllowed(role, key, next);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update");
    }
  }

  async function toggleMenu(role: AppRole, keys: string[], next: boolean) {
    setBusy(true);
    try {
      for (const k of keys) await setAllowed(role, k, next);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  const cols = 2 + NON_ADMIN_ROLES.length;

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 shadow-card flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg">Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground">
            Configure what each role can do. Click a menu to expand its permissions.
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-glass-border z-20">
              <tr>
                <th className="text-left px-4 py-3 min-w-[300px] font-semibold sticky left-0 bg-background/95 backdrop-blur z-30">
                  Menu / Permission
                </th>
                <th className="text-center px-3 py-3 min-w-[110px]">
                  <div className="font-semibold">{ROLE_LABELS.admin}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-normal">{ROLE_HINTS.admin}</div>
                </th>
                {NON_ADMIN_ROLES.map((r) => (
                  <th key={r} className="text-center px-3 py-3 min-w-[110px]">
                    <div className="font-semibold">{ROLE_LABELS[r]}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-normal">{ROLE_HINTS[r]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MENUS.map((menu) => {
                const open = !!openMenus[menu.key];
                const perms = menu.keys.map((k) => permissionByKey(k)).filter(Boolean) as NonNullable<ReturnType<typeof permissionByKey>>[];
                return (
                  <Fragment key={menu.key}>
                    <tr
                      className={cn("border-t border-glass-border cursor-pointer hover:bg-white/5", open && "bg-white/5")}
                      onClick={() => setOpenMenus((p) => ({ ...p, [menu.key]: !p[menu.key] }))}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-background/80 backdrop-blur">
                        <div className="flex items-center gap-2">
                          <ChevronRight className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-90")} />
                          <span className="font-semibold">{menu.label}</span>
                          <span className="text-xs text-muted-foreground">({perms.length})</span>
                        </div>
                        <div className="text-xs text-muted-foreground pl-6">{menu.description}</div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] uppercase font-bold bg-gradient-primary text-white">
                          All
                        </span>
                      </td>
                      {NON_ADMIN_ROLES.map((role) => {
                        const on = perms.filter((p) => isAllowed(role, p.key)).length;
                        const all = on === perms.length && perms.length > 0;
                        const partial = on > 0 && !all;
                        return (
                          <td
                            key={role}
                            className="px-3 py-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <Switch
                                checked={all}
                                disabled={loading || busy}
                                onCheckedChange={(v) => toggleMenu(role, menu.keys, v)}
                                aria-label={`${ROLE_LABELS[role]} — all of ${menu.label}`}
                              />
                              {partial && (
                                <span className="text-[10px] text-muted-foreground leading-none">partial</span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>

                    {open &&
                      perms.map((perm) => (
                        <tr key={perm.key} className="border-t border-glass-border/60 bg-background/40">
                          <td className="px-4 py-3 pl-12 sticky left-0 bg-background/70 backdrop-blur">
                            <div className="font-medium">{perm.label}</div>
                            <div className="text-xs text-muted-foreground">{perm.description}</div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-[10px] uppercase font-bold text-primary">Always</span>
                          </td>
                          {NON_ADMIN_ROLES.map((role) => (
                            <td key={role} className="px-3 py-3 text-center">
                              <div className="inline-flex">
                                <Switch
                                  checked={isAllowed(role, perm.key)}
                                  disabled={loading || busy}
                                  onCheckedChange={(v) => toggle(role, perm.key, v)}
                                  aria-label={`${ROLE_LABELS[role]} — ${perm.label}`}
                                />
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              <tr>
                <td colSpan={cols} className="px-4 py-3 text-xs text-muted-foreground">
                  Admin always has full control. Turning a menu off hides it from that role everywhere.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Changes take effect immediately across menus and page access. “View” lets a role open the menu; “Manage” lets them add, edit and delete inside it.
      </p>
    </div>
  );
}
