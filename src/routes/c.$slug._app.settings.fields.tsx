import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CustomFieldsPanel, type FieldsHookApi } from "@/components/settings/CustomFieldsPanel";
import { useEmployeeFields } from "@/hooks/use-employee-fields";
import { useClientFields } from "@/hooks/use-client-fields";
import { useProjectFields } from "@/hooks/use-project-fields";
import { useLeadFields } from "@/hooks/use-lead-fields";

export const Route = createFileRoute("/c/$slug/_app/settings/fields")({
  component: CustomFieldsSettings,
});

type TabKey = "employees" | "clients" | "projects" | "leads";

const TABS: { key: TabKey; label: string }[] = [
  { key: "employees", label: "Employees" },
  { key: "clients", label: "Clients" },
  { key: "projects", label: "Projects" },
  { key: "leads", label: "Leads" },
];

function CustomFieldsSettings() {
  const [tab, setTab] = useState<TabKey>("employees");
  const employees = useEmployeeFields() as FieldsHookApi;
  const clients = useClientFields() as FieldsHookApi;
  const projects = useProjectFields() as FieldsHookApi;
  const leads = useLeadFields() as FieldsHookApi;

  return (
    <div className="space-y-5">
      <div className="glass rounded-xl p-1 inline-flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition",
              tab === t.key
                ? "bg-gradient-primary text-white shadow-glow"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employees" && (
        <CustomFieldsPanel api={employees} noun="employee" nounPlural="employees" labelPlaceholder="e.g. Employee ID" />
      )}
      {tab === "clients" && (
        <CustomFieldsPanel api={clients} noun="client" nounPlural="clients" labelPlaceholder="e.g. GST Number" />
      )}
      {tab === "projects" && (
        <CustomFieldsPanel api={projects} noun="project" nounPlural="projects" labelPlaceholder="e.g. Contract Number" />
      )}
      {tab === "leads" && (
        <CustomFieldsPanel api={leads} noun="lead" nounPlural="leads" labelPlaceholder="e.g. Source Campaign" />
      )}
    </div>
  );
}