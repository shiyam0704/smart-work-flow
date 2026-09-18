import { createFileRoute } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, Download, Building2, ExternalLink, Pencil, Trash2, RotateCcw, CalendarClock, Phone, MessageCircle, FileText, Plus } from "lucide-react";
import {
  useLeads,
  useLeadEntries,
  useLeadAttachments,
  updateStageEntry,
  STAGE_LABEL,
  STAGES,
  type LeadStage,
  type LeadStageEntry,
} from "@/hooks/use-leads";
import { useQuotations } from "@/hooks/use-quotations";
import { DOC_STATUS_META } from "@/lib/invoice-calc";
import { AdvanceStageModal } from "@/components/app/AdvanceStageModal";
import { ConvertToClientDialog } from "@/components/app/ConvertToClientDialog";
import { EditLeadModal } from "@/components/app/EditLeadModal";
import { EditStageEntryModal } from "@/components/app/EditStageEntryModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useEmployees } from "@/hooks/use-employees";
import { useProfileNames } from "@/hooks/use-profile-names";
import { cn } from "@/lib/utils";
import { formatINR, formatDate } from "@/lib/format";

export const Route = createFileRoute("/c/$slug/_app/leads/$leadId")({
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const { leads, advanceStage, updateLead, deleteLead, reopenLead } = useLeads();
  const { entries, reload: reloadEntries } = useLeadEntries(leadId);
  const { items: attachments, getSignedUrl } = useLeadAttachments(leadId);
  const { isAdmin } = useAuth();
  const canManageLeads = useCanManage("leads");
  const canManageInvoicing = useCanManage("invoicing");
  const { quotations: leadQuotations } = useQuotations({ leadId });
  const { employees } = useEmployees();
  const { nameByUserId } = useProfileNames();
  const employeeById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.name);
    return m;
  }, [employees]);
  const canEdit = canManageLeads || canManageInvoicing;

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<LeadStage>("follow_up");
  const [suppressPrefill, setSuppressPrefill] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<LeadStageEntry | null>(null);

  const lead = leads.find((l) => l.id === leadId);

  const attachmentsByEntry = useMemo(() => {
    const m = new Map<string, typeof attachments>();
    for (const a of attachments) {
      if (!a.stage_entry_id) continue;
      if (!m.has(a.stage_entry_id)) m.set(a.stage_entry_id, []);
      m.get(a.stage_entry_id)!.push(a);
    }
    return m;
  }, [attachments]);

  const latestFollowUp = useMemo(() => {
    const fu = [...entries].reverse().find((e) => e.stage === "follow_up");
    return (fu?.data as Record<string, unknown> | undefined) ?? null;
  }, [entries]);

  const latestQuoted = useMemo(
    () => [...entries].reverse().find((e) => e.stage === "quoted") ?? null,
    [entries],
  );

  if (!lead) {
    return (
      <>
        <Topbar title="Lead" />
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      </>
    );
  }

  const canConvert = lead.current_stage === "closed" && lead.outcome === "success" && !lead.converted_client_id;

  const openStage = (s: LeadStage, opts?: { suppressPrefill?: boolean }) => {
    setTargetStage(s);
    setSuppressPrefill(!!opts?.suppressPrefill);
    setAdvanceOpen(true);
  };

  const openSigned = async (path: string) => {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank");
  };

  return (
    <>
      <Topbar title={lead.company_name} subtitle={lead.contact_person || "Lead detail"} />
      <div className="p-4 sm:p-6 max-w-5xl space-y-6">
        <Link to="/c/$slug/leads" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to leads
        </Link>

        {/* Header card */}
        <div className="glass-strong rounded-xl border border-glass-border p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Current stage</span>
              </div>
              <div className="text-2xl font-display font-bold">{STAGE_LABEL[lead.current_stage]}</div>
              {lead.outcome && (
                <div className="mt-2 inline-block text-xs font-bold uppercase px-2 py-0.5 rounded bg-white/10">
                  {lead.outcome}{lead.final_price ? ` · ${formatINR(lead.final_price)}` : ""}
                </div>
              )}
              {lead.outcome === "unsuccess" && lead.close_reason && (
                <div className="mt-2 text-xs text-muted-foreground max-w-md">
                  Reason: <span className="text-foreground">{lead.close_reason}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap md:justify-end">
              {canEdit && lead.current_stage !== "closed" && (
                <div className="flex flex-wrap gap-2">
                  {STAGES.filter((s) => s.id !== lead.current_stage && s.id !== "new_lead").map((s) => (
                    <Button key={s.id} variant="outline" size="sm" onClick={() => openStage(s.id)}>
                      Move to {s.label} <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  ))}
                </div>
              )}
              {canEdit && lead.current_stage === "closed" && (
                <Button variant="outline" size="sm" onClick={() => openStage("quoted", { suppressPrefill: true })}>
                  Move to Quote <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              {canConvert && canEdit && (
                <Button onClick={() => setConvertOpen(true)} className="bg-gradient-primary text-white">
                  Convert to Client
                </Button>
              )}
              {canEdit && lead.current_stage === "closed" && lead.outcome === "unsuccess" && (
                <Button variant="outline" size="sm" onClick={() => reopenLead(lead.id)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen lead
                </Button>
              )}
              {lead.converted_client_id && (
                <Link to="/c/$slug/clients/$clientId" params={{ clientId: lead.converted_client_id }}>
                  <Button variant="outline" size="sm">
                    View client <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate({
                      to: "/c/$slug/invoicing/quotations",
                      search: { leadId: lead.id, new: leadQuotations.length === 0 },
                    })
                  }
                >
                  <FileText className="w-3.5 h-3.5 mr-1" />
                  {leadQuotations.length > 0 ? `Quotations (${leadQuotations.length})` : "Create Quotation"}
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} aria-label="Edit lead">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                </Button>
              )}
              {canEdit && latestQuoted ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditEntry(latestQuoted)}
                  aria-label="Update quote"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Update quote
                </Button>
              ) : canEdit && lead.current_stage !== "closed" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const latestFu = [...entries].reverse().find((e) => e.stage === "follow_up");
                    if (latestFu) setEditEntry(latestFu);
                    else openStage("follow_up");
                  }}
                  aria-label="Update follow-up"
                >
                  <CalendarClock className="w-3.5 h-3.5 mr-1" /> Update follow-up
                </Button>
              ) : null}
              {isAdmin && (
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)} aria-label="Delete lead">
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
            <Field label="Contact person" value={lead.contact_person} />
            <ContactNumberField value={lead.contact_number} />
            <Field label="Source" value={lead.lead_source} />
            <Field label="Address" value={lead.address} />
            <Field
              label="Captured by"
              value={lead.captured_by_employee_id ? employeeById.get(lead.captured_by_employee_id) ?? "—" : "—"}
            />
            <Field
              label="Followed by"
              value={lead.followed_by_employee_id ? employeeById.get(lead.followed_by_employee_id) ?? "—" : "—"}
            />
          </div>
          {lead.note && (
            <div className="mt-4 text-sm">
              <div className="text-xs uppercase text-muted-foreground mb-1">Note</div>
              <div className="text-foreground">{lead.note}</div>
            </div>
          )}

          {/* Quotation Conversion Section below Address / Contact info */}
          <div className="mt-6 pt-5 border-t border-glass-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>Quotations</span>
                  {leadQuotations.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      {leadQuotations.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {leadQuotations.length > 0
                    ? `${leadQuotations.length} quotation${leadQuotations.length > 1 ? "s" : ""} generated for this lead`
                    : "Generate an official quotation with prefilled lead and contact details"}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {leadQuotations.length > 0 ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: "/c/$slug/invoicing/quotations",
                          search: { leadId: lead.id },
                        })
                      }
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> View Quotes ({leadQuotations.length})
                    </Button>
                    {canEdit && (
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate({
                            to: "/c/$slug/invoicing/quotations",
                            search: { leadId: lead.id, new: true },
                          })
                        }
                        className="bg-gradient-primary text-white shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Create Another Quotation
                      </Button>
                    )}
                  </>
                ) : (
                  canEdit && (
                    <Button
                      size="sm"
                      onClick={() =>
                        navigate({
                          to: "/c/$slug/invoicing/quotations",
                          search: { leadId: lead.id, new: true },
                        })
                      }
                      className="bg-gradient-primary text-white shadow-sm"
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" /> Create Quotation
                    </Button>
                  )
                )}
              </div>
            </div>

            {/* If lead quotations exist, show quick list */}
            {leadQuotations.length > 0 && (
              <div className="mt-4 divide-y divide-glass-border/50 rounded-lg border border-glass-border bg-glass/30 overflow-hidden">
                {leadQuotations.map((q) => {
                  const meta = DOC_STATUS_META[q.status];
                  return (
                    <div
                      key={q.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 text-xs gap-2 hover:bg-glass/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-semibold text-foreground">{q.quotation_no}</span>
                        <span className={cn("px-2 py-0.5 rounded-full text-[11px] border font-medium", meta?.cls)}>
                          {meta?.label ?? q.status}
                        </span>
                        <span className="text-muted-foreground">{formatDate(q.quotation_date, "d MMM yyyy")}</span>
                        {q.title && <span className="text-muted-foreground truncate max-w-[240px]">· {q.title}</span>}
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3">
                        <span className="font-semibold text-sm">{formatINR(q.grand_total)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2.5"
                          onClick={() =>
                            navigate({
                              to: "/c/$slug/invoicing/quotations",
                              search: { quoteId: q.id },
                            })
                          }
                        >
                          Open <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div>
          <h2 className="font-display font-bold text-lg mb-3">Activity</h2>
          <div className="space-y-3">
            {entries.length === 0 && (
              <div className="text-sm text-muted-foreground">No entries yet.</div>
            )}
            {entries.map((e) => {
              const files = attachmentsByEntry.get(e.id) ?? [];
              return (
                <div key={e.id} className="glass rounded-lg p-4 border border-glass-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
                          "bg-white/10",
                        )}
                      >
                        {STAGE_LABEL[e.stage]}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                  </div>
                  {(() => {
                    const handler =
                      (e.employee_id ? employeeById.get(e.employee_id) : null) ??
                      nameByUserId(e.created_by) ??
                      null;
                    if (!handler) return null;
                    return (
                      <div className="text-[11px] text-muted-foreground mb-2">
                        Handled by <span className="text-foreground font-medium">{handler}</span>
                      </div>
                    );
                  })()}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <EntryData stage={e.stage} data={e.data} />
                      {e.note && (
                        <div className="text-sm mt-2 whitespace-pre-wrap">{e.note}</div>
                      )}
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditEntry(e)} aria-label={`Edit ${STAGE_LABEL[e.stage]} entry`}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  {files.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {files.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => openSigned(f.storage_path)}
                          className="flex items-center gap-2 text-xs text-primary hover:underline"
                        >
                          <Download className="w-3 h-3" /> {f.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <AdvanceStageModal
        open={advanceOpen}
        stage={targetStage}
        onOpenChange={setAdvanceOpen}
        latestFollowUp={suppressPrefill ? null : latestFollowUp}
        onAdvance={(stage, data, note, files, extra, employeeId) =>
          advanceStage(lead.id, stage, data, note, files, extra, employeeId)
        }
      />
      <ConvertToClientDialog
        lead={lead}
        open={convertOpen}
        onOpenChange={setConvertOpen}
        onConverted={async (clientId) => {
          await updateLead(lead.id, { converted_client_id: clientId });
          navigate({ to: "/c/$slug/clients/$clientId", params: { clientId } });
        }}
      />
      <EditLeadModal
        open={editOpen}
        onOpenChange={setEditOpen}
        lead={lead}
        onSave={(patch) => updateLead(lead.id, patch)}
      />
      <EditStageEntryModal
        open={!!editEntry}
        entry={editEntry}
        onOpenChange={(v) => { if (!v) setEditEntry(null); }}
        onSave={async (entry, patch, closedExtras) => {
          const ok = await updateStageEntry(entry.id, patch);
          if (!ok) return false;
          // If this is the latest entry for the lead's current stage and it's a closed entry,
          // re-sync the lead-level outcome / final_price so the header stays accurate.
          if (closedExtras && lead.current_stage === "closed") {
            const latestClosed = [...entries].reverse().find((x) => x.stage === "closed");
            if (latestClosed && latestClosed.id === entry.id) {
              await updateLead(lead.id, {
                outcome: closedExtras.outcome,
                final_price: closedExtras.final_price,
                close_reason: closedExtras.close_reason,
              });
            }
          }
          await reloadEntries();
          return true;
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the lead, its stage history and all attachments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                const ok = await deleteLead(lead.id);
                if (ok) navigate({ to: "/c/$slug/leads" });
              }}
            >
              Delete lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-foreground truncate">{value || "—"}</div>
    </div>
  );
}

function ContactNumberField({ value }: { value: string }) {
  const raw = (value ?? "").trim();
  const digits = raw.replace(/[^\d+]/g, "");
  const waDigits = digits.replace(/^\+/, "");
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">Contact number</div>
      {raw ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-foreground truncate">{raw}</span>
          <a
            href={`tel:${digits}`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition"
            aria-label="Call"
            title="Call"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
          <a
            href={`https://wa.me/${waDigits}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition"
            aria-label="Open WhatsApp"
            title="WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="text-foreground">—</div>
      )}
    </div>
  );
}

function EntryData({ stage, data }: { stage: LeadStage; data: Record<string, unknown> }) {
  if (stage === "follow_up") {
    return (
      <div className="text-sm space-y-1">
        <div>
          Follow-up on <span className="font-semibold">{String(data.follow_up_date ?? "—")}</span>
        </div>
        {data.project_name ? <div className="font-semibold">{String(data.project_name)}</div> : null}
        {data.project_details ? <div className="text-sm">{String(data.project_details)}</div> : null}
      </div>
    );
  }
  if (stage === "quoted") {
    return (
      <div className="text-sm space-y-1">
        {data.project_name ? (
          <div className="font-semibold">{String(data.project_name)}</div>
        ) : null}
        {data.work_details ? <div>{String(data.work_details)}</div> : null}
        <div className="text-muted-foreground text-xs">
          Quoted {formatINR(Number(data.quoted_price ?? 0))} · Offer {formatINR(Number(data.offer_price ?? 0))}
        </div>
      </div>
    );
  }


  if (stage === "closed") {
    return (
      <div className="text-sm">
        Outcome: <span className="font-semibold">{String(data.outcome ?? "—")}</span>
        {data.outcome === "success" && (
          <> · Final {formatINR(Number(data.final_price ?? 0))}</>
        )}
      </div>
    );
  }
  if (stage === "new_lead") {
    return (
      <div className="text-xs text-muted-foreground">Lead created</div>
    );
  }
  return null;
}
