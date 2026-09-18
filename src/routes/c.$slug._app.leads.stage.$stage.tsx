import { createFileRoute, notFound } from "@tanstack/react-router";
import { CLink as Link } from "@/lib/nav";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/app/Topbar";
import { useLeads, STAGES, type LeadStage } from "@/hooks/use-leads";
import { useLeadStageMeta } from "@/hooks/use-lead-stage-meta";
import { LeadCard } from "@/components/app/LeadCard";

const VALID = new Set(STAGES.map((s) => s.id as string));

export const Route = createFileRoute("/c/$slug/_app/leads/stage/$stage")({
  beforeLoad: ({ params }) => {
    if (!VALID.has(params.stage)) throw notFound();
  },
  component: StagePage,
  head: ({ params }) => {
    const meta = STAGES.find((s) => s.id === params.stage);
    return { meta: [{ title: `${meta?.label ?? "Leads"} — Smart Work Flow` }] };
  },
});

function StagePage() {
  const { stage } = Route.useParams();
  const stageId = stage as LeadStage;
  const stageDef = STAGES.find((s) => s.id === stageId)!;
  const { leads, loading } = useLeads();
  const stageMeta = useLeadStageMeta(leads);

  const filtered = useMemo(
    () =>
      leads
        .filter((l) => l.current_stage === stageId)
        .sort((a, b) => (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)),
    [leads, stageId],
  );

  return (
    <>
      <Topbar title={`${stageDef.label} Leads`} subtitle={`All leads in ${stageDef.label.toLowerCase()} stage`} />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Link to="/c/$slug/leads" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> Back to pipeline
          </Link>
          <div className="text-sm text-muted-foreground">
            {loading ? "Loading…" : `${filtered.length} leads`}
          </div>
        </div>

        {filtered.length === 0 && !loading ? (
          <div className="glass rounded-xl border border-glass-border p-12 text-center text-sm text-muted-foreground">
            No leads in this stage yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} meta={stageMeta[lead.id]} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
