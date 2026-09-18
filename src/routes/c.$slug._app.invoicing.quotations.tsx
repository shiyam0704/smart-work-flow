import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Printer, Pencil, Trash2, FileText, Download, ArrowRightLeft } from "lucide-react";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfirm } from "@/components/app/confirm-dialog";
import { DocumentFormDialog, type DocFormValue } from "@/components/invoicing/DocumentFormDialog";
import {
  useQuotations,
  type QuotationRow,
  type QuotationStatus,
  type QuotationInput,
} from "@/hooks/use-quotations";
import { useInvoices } from "@/hooks/use-invoices";
import { allocateDocumentNumber, useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { usePrintBrand } from "@/hooks/use-print-brand";
import { buildDocumentHtml, printHtml, recompute } from "@/lib/invoice-print";
import { DOC_STATUS_META } from "@/lib/invoice-calc";
import { formatINR, formatDate, todayLocalDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCanManage } from "@/hooks/use-permissions";
import { supabase } from "@/integrations/supabase/client";
import { emptyLine } from "@/components/invoicing/LineItemsEditor";
import { CLink as Link, useCNavigate as useNavigate } from "@/lib/nav";

const searchSchema = z.object({
  leadId: z.string().optional(),
  new: z.boolean().optional(),
  quoteId: z.string().optional(),
});

export const Route = createFileRoute("/c/$slug/_app/invoicing/quotations")({
  validateSearch: zodValidator(searchSchema),
  component: QuotationsPage,
});

const ALL = "all";
const STATUSES: { value: QuotationStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
];

function QuotationsPage() {
  const { leadId, new: isNewQuote, quoteId } = Route.useSearch();
  const navigate = useNavigate();
  const { quotations, loading, createQuotation, updateQuotation, deleteQuotation, setStatus } = useQuotations();
  const canManage = useCanManage("invoicing");
  const { createInvoice } = useInvoices();
  const { settings } = useInvoiceSettings();
  const { brand, printOptions } = usePrintBrand();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [status, setStatus_] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuotationRow | null>(null);
  const [associatedLeadId, setAssociatedLeadId] = useState<string | null>(null);
  const [leadPrefill, setLeadPrefill] = useState<Partial<DocFormValue> | null>(null);

  // Handle quoteId or leadId from search query params
  useEffect(() => {
    if (loading) return;

    // Direct quote open
    if (quoteId) {
      const found = quotations.find((q) => q.id === quoteId);
      if (found) {
        setEditing(found);
        setAssociatedLeadId(found.lead_id ?? null);
        setLeadPrefill(null);
        setOpen(true);
      }
      return;
    }

    // Lead to quotation conversion / view
    if (leadId) {
      const targetLeadId = leadId;
      const existingForLead = quotations.filter((q) => q.lead_id === targetLeadId);

      // If existing quotation exists and not explicitly asking for a new one, open the existing one
      if (existingForLead.length > 0 && !isNewQuote) {
        setEditing(existingForLead[0]);
        setAssociatedLeadId(targetLeadId);
        setLeadPrefill(null);
        setOpen(true);
        toast.info(`Opened existing quotation ${existingForLead[0].quotation_no} for this lead`);
        return;
      }

      // Fetch lead details and stage entries to prefill
      let cancelled = false;
      async function prepareLeadQuote() {
        try {
          const [{ data: leadData, error: leadErr }, { data: entriesData }] = await Promise.all([
            supabase.from("leads").select("*").eq("id", targetLeadId).maybeSingle(),
            supabase.from("lead_stage_entries").select("*").eq("lead_id", targetLeadId).order("created_at", { ascending: false }),
          ]);

          if (cancelled) return;
          if (leadErr || !leadData) {
            toast.error("Could not find originating lead details");
            return;
          }

          const quotedEntry = entriesData?.find((e) => e.stage === "quoted");
          const quotedData = (quotedEntry?.data as Record<string, any> | undefined) ?? {};
          const projectName = quotedData?.project_name || leadData.company_name;
          const quotedPrice = Number(quotedData?.quoted_price || leadData.final_price || 0);
          const workDetails = quotedData?.work_details || "";

          // Custom fields GSTIN fallback
          const customFields = (leadData.custom_fields as Record<string, any> | null) ?? {};
          const gstin = customFields.gstin || customFields.GSTIN || "";

          const fullAddress = [leadData.address, leadData.city].filter(Boolean).join(", ");

          const items = quotedPrice > 0
            ? [{
                item_id: null,
                description: workDetails || `Quotation for ${projectName || leadData.company_name}`,
                hsn_sac: "",
                unit: "unit",
                quantity: 1,
                rate: quotedPrice,
                discount_percent: 0,
                gst_percent: settings?.default_gst_percent ?? 18,
              }]
            : [emptyLine(settings?.default_gst_percent ?? 18)];

          setAssociatedLeadId(targetLeadId);
          setEditing(null);
          setLeadPrefill({
            client_id: leadData.converted_client_id ?? null,
            title: projectName ? `Quotation for ${projectName}` : `Quotation for ${leadData.company_name}`,
            bill_to_name: leadData.company_name,
            bill_to_contact_person: leadData.contact_person ?? "",
            bill_to_contact_number: leadData.contact_number ?? "",
            bill_to_address: fullAddress,
            bill_to_gstin: gstin,
            notes: leadData.note ?? "",
            items,
          });
          setOpen(true);
          if (existingForLead.length > 0) {
            toast.info(`Creating an additional quotation for this lead (${existingForLead.length} existing found)`);
          }
        } catch (err: any) {
          console.error("Failed to prefill quotation from lead:", err);
        }
      }

      prepareLeadQuote();

      return () => {
        cancelled = true;
      };
    }
  }, [leadId, isNewQuote, quoteId, loading]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotations.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (!q) return true;
      return [r.quotation_no, r.title, r.bill_to_name].join(" ").toLowerCase().includes(q);
    });
  }, [quotations, query, status]);

  const initial = useMemo<Partial<DocFormValue> | null>(() => {
    if (editing) {
      return {
        client_id: editing.client_id,
        project_id: editing.project_id,
        title: editing.title,
        date: editing.quotation_date,
        secondaryDate: editing.valid_until,
        status: editing.status,
        place_of_supply: editing.place_of_supply,
        is_interstate: editing.is_interstate,
        bill_to_name: editing.bill_to_name,
        bill_to_address: editing.bill_to_address,
        bill_to_gstin: editing.bill_to_gstin,
        bill_to_contact_person: editing.bill_to_contact_person,
        bill_to_contact_number: editing.bill_to_contact_number,
        notes: editing.notes,
        terms: editing.terms,
        items: editing.items,
      };
    }
    if (leadPrefill) {
      return leadPrefill;
    }
    return null;
  }, [editing, leadPrefill]);

  async function handleSubmit(v: DocFormValue) {
    const payload: QuotationInput = {
      client_id: v.client_id,
      project_id: v.project_id,
      lead_id: editing?.lead_id ?? associatedLeadId ?? null,
      title: v.title,
      quotation_date: v.date,
      valid_until: v.secondaryDate,
      status: v.status as QuotationStatus,
      place_of_supply: v.place_of_supply,
      is_interstate: v.is_interstate,
      bill_to_name: v.bill_to_name,
      bill_to_address: v.bill_to_address,
      bill_to_gstin: v.bill_to_gstin,
      bill_to_contact_person: v.bill_to_contact_person,
      bill_to_contact_number: v.bill_to_contact_number,
      notes: v.notes,
      terms: v.terms,
      items: v.items,
      roundOff: settings?.round_off_enabled !== false,
    };
    if (editing) return await updateQuotation(editing.id, payload);
    const number = await allocateDocumentNumber("quotation");
    if (!number) return false;
    const id = await createQuotation({ ...payload, quotation_no: number });
    if (id) {
      toast.success(`Quotation ${number} created successfully`);
    }
    return Boolean(id);
  }

  function handlePrint(q: QuotationRow) {
    const { lines, totals, taxGroups } = recompute(q.items as any, q.is_interstate);
    const html = buildDocumentHtml(
      {
        kind: "Quotation",
        number: q.quotation_no,
        date: q.quotation_date,
        secondaryLabel: "Valid until",
        secondaryValue: q.valid_until ?? undefined,
        title: q.title,
        billToName: q.bill_to_name,
        billToAddress: q.bill_to_address,
        billToGstin: q.bill_to_gstin,
        billToContactPerson: q.bill_to_contact_person,
        billToContactNumber: q.bill_to_contact_number,
        placeOfSupply: q.place_of_supply,
        isInterstate: q.is_interstate,
        items: lines,
        totals,
        taxGroups,
        notes: q.notes,
        terms: q.terms,
      },
      brand,
      printOptions,
    );
    if (!printHtml(html)) toast.error("Allow pop-ups to print this quotation");
  }

  async function handleConvert(q: QuotationRow) {
    const ok = await confirm({
      title: "Convert to invoice?",
      description: `A new invoice will be created from ${q.quotation_no} with the same items.`,
      confirmText: "Convert",
    });
    if (!ok) return;
    const number = await allocateDocumentNumber("invoice");
    if (!number) return;
    const dueDays = settings?.invoice_due_days ?? 15;
    const due = new Date();
    due.setDate(due.getDate() + dueDays);
    const id = await createInvoice({
      invoice_no: number,
      client_id: q.client_id,
      project_id: q.project_id,
      quotation_id: q.id,
      title: q.title,
      invoice_date: todayLocalDate(),
      due_date: formatDate(due, "yyyy-MM-dd"),
      status: "sent",
      place_of_supply: q.place_of_supply,
      is_interstate: q.is_interstate,
      bill_to_name: q.bill_to_name,
      bill_to_address: q.bill_to_address,
      bill_to_gstin: q.bill_to_gstin,
      bill_to_contact_person: q.bill_to_contact_person,
      bill_to_contact_number: q.bill_to_contact_number,
      notes: q.notes,
      terms: settings?.default_invoice_terms || q.terms,
      items: q.items,
      roundOff: settings?.round_off_enabled !== false,
    });
    if (id) await setStatus(q.id, "accepted");
  }

  async function handleDelete(q: QuotationRow) {
    const ok = await confirm({
      title: "Delete quotation?",
      description: `${q.quotation_no} will be permanently removed.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteQuotation(q.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          placeholder="Search quotations…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus_}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv("quotations", rows, [
                { key: "no", label: "Quotation No", value: (r) => r.quotation_no },
                { key: "date", label: "Date", value: (r) => r.quotation_date },
                { key: "client", label: "Bill To", value: (r) => r.bill_to_name },
                { key: "title", label: "Subject", value: (r) => r.title },
                { key: "status", label: "Status", value: (r) => r.status },
                { key: "total", label: "Grand Total", value: (r) => r.grand_total },
              ])
            }
          >
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={!canManage}>
            <Plus className="w-4 h-4 mr-1" /> New quotation
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading quotations…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No quotations yet</p>
          <p className="text-sm text-muted-foreground">Create your first quotation to get started.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-glass-border">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Bill to</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => {
                const meta = DOC_STATUS_META[q.status];
                return (
                  <tr key={q.id} className="border-b border-glass-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{q.quotation_no}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(q.quotation_date, "d MMM yyyy")}</td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[220px] font-medium">{q.bill_to_name}</div>
                      {q.title && <div className="text-xs text-muted-foreground truncate max-w-[220px]">{q.title}</div>}
                      {q.lead_id && (
                        <Link
                          to="/c/$slug/leads/$leadId"
                          params={{ leadId: q.lead_id }}
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                          Lead linked
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full border text-xs", meta?.cls)}>{meta?.label ?? q.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatINR(q.grand_total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Print" onClick={() => handlePrint(q)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Convert to invoice" disabled={!canManage} onClick={() => handleConvert(q)}>
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" disabled={!canManage} onClick={() => { setEditing(q); setOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" disabled={!canManage} onClick={() => handleDelete(q)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DocumentFormDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setEditing(null);
            setLeadPrefill(null);
            setAssociatedLeadId(null);
          }
        }}
        kind="quotation"
        statuses={STATUSES}
        initial={initial}
        numberLabel={editing?.quotation_no}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
