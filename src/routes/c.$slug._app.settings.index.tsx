import { createFileRoute } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { Briefcase, LayoutTemplate, Sliders, Workflow, ArrowUpRight, Shield, Palette, Building2, History, ReceiptText, Boxes } from "lucide-react";

export const Route = createFileRoute("/c/$slug/_app/settings/")({
  component: SettingsIndex,
  head: () => ({ meta: [{ title: "Settings — Smart Work Flow" }] }),
});

const SECTIONS = [
  { to: "/c/$slug/settings/company",           title: "Company",             desc: "Branding, URL slug, timezone and date/time formats.",               icon: Building2 },
  { to: "/c/$slug/settings/appearance",        title: "Appearance",          desc: "Pick a premium theme and light or dark mode for the workspace.",     icon: Palette },
  { to: "/c/$slug/settings/invoicing",         title: "Invoicing",           desc: "Tax details, number series, default terms and bank details.",        icon: ReceiptText },
  { to: "/c/$slug/settings/stock",             title: "Stock & Purchase",    desc: "Stores, units, item categories, PO approval and print format.",     icon: Boxes },
  { to: "/c/$slug/settings/roles",             title: "Roles & Permissions", desc: "Configure what each role can see and do across the app.",           icon: Shield },
  { to: "/c/$slug/settings/audit",             title: "Audit Trail",         desc: "Admin-only log of who changed what and when.",                      icon: History },
  { to: "/c/$slug/settings/departments",       title: "Departments",         desc: "Organize teams, colors and codes for routing tasks and projects.",  icon: Briefcase },
  { to: "/c/$slug/settings/workflow",          title: "Workflow States",     desc: "Statuses tasks move through, from open to done.",                   icon: Workflow },
  { to: "/c/$slug/settings/project-templates", title: "Project Templates",   desc: "Reusable project scaffolds with pre-defined tasks.",                icon: LayoutTemplate },
  { to: "/c/$slug/settings/fields",            title: "Custom Fields",       desc: "Add fields to Employees, Clients, Projects and Leads in one place.", icon: Sliders },
] as const;

function SettingsIndex() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        return (
          <Link
            key={s.to}
            to={s.to}
            className="glass rounded-2xl p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow group"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold">{s.title}</h3>
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}