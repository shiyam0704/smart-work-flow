import { CLink as Link } from "@/lib/nav";
import { ArrowRight, Phone, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import type { LeadRow } from "@/hooks/use-leads";
export type StageMeta = { follow_up_date?: string; quoted_price?: number };

function ContactRow({ name, phone }: { name: string; phone: string }) {
  const raw = (phone ?? "").trim();
  const digits = raw.replace(/[^\d+]/g, "");
  const waDigits = digits.replace(/^\+/, "");
  if (!name && !raw) return null;
  return (
    <div className="flex items-center gap-2 mt-1.5 text-xs min-w-0">
      {name && <span className="text-muted-foreground truncate">{name}</span>}
      {raw && (
        <>
          <span className="text-foreground/80 truncate">{raw}</span>
          <span className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); window.location.href = `tel:${digits}`; }}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition"
              aria-label="Call"
              title="Call"
            >
              <Phone className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); window.open(`https://wa.me/${waDigits}`, "_blank", "noopener,noreferrer"); }}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition"
              aria-label="Open WhatsApp"
              title="WhatsApp"
            >
              <MessageCircle className="w-3 h-3" />
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export function LeadCard({ lead, meta }: { lead: LeadRow; meta?: StageMeta }) {
  const m = meta ?? {};
  return (
    <Link
      to="/c/$slug/leads/$leadId"
      params={{ leadId: lead.id }}
      className="block glass-strong rounded-lg p-3 border border-glass-border hover:border-primary/40 transition"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{lead.company_name}</div>
          <ContactRow name={lead.contact_person} phone={lead.contact_number} />
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      {lead.current_stage === "new_lead" && (
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-2">
          Source: {lead.lead_source || "—"}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-1">
        Lead date:{" "}
        <span className="text-foreground/80">
          {new Date(lead.lead_date || lead.created_at).toLocaleDateString()}
        </span>
      </div>

      {lead.current_stage === "follow_up" && (
        <div className="text-xs text-muted-foreground mt-2">
          Next follow-up:{" "}
          <span className="text-foreground font-medium">
            {m.follow_up_date ? new Date(m.follow_up_date).toLocaleDateString() : "—"}
          </span>
        </div>
      )}
      {lead.current_stage === "quoted" && (
        <div className="text-xs text-muted-foreground mt-2">
          Quoted:{" "}
          <span className="text-foreground font-semibold">
            {m.quoted_price != null ? formatINR(m.quoted_price) : "—"}
          </span>
        </div>
      )}
      {lead.current_stage === "closed" && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {lead.outcome && (
            <span
              className={cn(
                "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                lead.outcome === "success"
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "bg-red-500/20 text-red-300",
              )}
            >
              {lead.outcome === "success" ? "Success" : "Unsuccess"}
            </span>
          )}
          {lead.final_price != null && (
            <span className="text-xs font-semibold">{formatINR(lead.final_price)}</span>
          )}
          {lead.outcome === "unsuccess" && lead.close_reason && (
            <span className="text-xs text-muted-foreground truncate">
              Reason: <span className="text-foreground">{lead.close_reason}</span>
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export function useStageMetaMap() {
  // placeholder export to keep imports tidy — actual hook stays inline per page
}
