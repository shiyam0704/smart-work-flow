import { createFileRoute } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { Topbar } from "@/components/app/Topbar";
import { Sparkles, FolderKanban, Briefcase, ListChecks, Users, ArrowUpRight, Wallet } from "lucide-react";

export const Route = createFileRoute("/c/$slug/_app/reports/")({
  component: ReportsIndex,
  head: () => ({ meta: [{ title: "Reports — Smart Work Flow" }] }),
});

const REPORTS = [
  { to: "/c/$slug/reports/leads",       title: "Leads Report",       desc: "Pipeline, conversion and value by stage, owner and source.", icon: Sparkles },
  { to: "/c/$slug/reports/projects",    title: "Projects Report",    desc: "Active, overdue and completed projects by client and department.", icon: FolderKanban },
  { to: "/c/$slug/reports/departments", title: "Departments Report", desc: "Task load and completion across each department.", icon: Briefcase },
  { to: "/c/$slug/reports/tasks",       title: "Tasks Report",       desc: "All tasks with status, priority, assignee and due-date filters.", icon: ListChecks },
  { to: "/c/$slug/reports/employees",   title: "Employees Report",   desc: "Workload per employee — assigned, completed and overdue.", icon: Users },
  { to: "/c/$slug/reports/accounts",    title: "Accounts Report",    desc: "Payments received, outstanding balances and collection rate.", icon: Wallet },
] as const;

function ReportsIndex() {
  return (
    <>
      <Topbar title="Reports" subtitle="Operational dashboards with date and status filters" />
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.to}
              to={r.to}
              className="glass rounded-2xl p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-glow group"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-primary text-white grid place-items-center shadow-glow">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">{r.title}</h3>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
