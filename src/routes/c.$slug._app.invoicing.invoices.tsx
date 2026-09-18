import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Printer, Pencil, Trash2, ReceiptText, Download, IndianRupee } from "lucide-react";
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
import { RecordPaymentDialog } from "@/components/invoicing/RecordPaymentDialog";
import { useInvoices, type InvoiceRow, type InvoiceStatus } from "@/hooks/use-invoices";
import { useInvoicePayments } from "@/hooks/use-invoice-payments";
import { useProjects } from "@/hooks/use-projects";

import { allocateDocumentNumber, useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { usePrintBrand } from "@/hooks/use-print-brand";
import { buildDocumentHtml, printHtml, recompute } from "@/lib/invoice-print";
import { DOC_STATUS_META, invoiceDisplayStatus } from "@/lib/invoice-calc";
import { formatINR, formatDate } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/invoicing/invoices")({
  component: InvoicesPage,
});

const ALL = "all";
const STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "cancelled", label: "Cancelled" },
];

function InvoicesPage() {
  const { invoices, loading, createInvoice, updateInvoice, deleteInvoice } = useInvoices();
  const canManage = useCanManage("invoicing");
  const { paidFor } = useInvoicePayments();
  const { projects } = useProjects();
  const { settings } = useInvoiceSettings();
  const { brand, printOptions } = usePrintBrand();
  const confirm = useConfirm();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>(ALL);
  const [projectId, setProjectId] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvoiceRow | null>(null);
  const [payFor, setPayFor] = useState<string | null>(null);

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const enriched = useMemo(

    () =>
      invoices.map((i) => {
        const paid = paidFor(i.id);
        return {
          ...i,
          paid,
          balance: i.grand_total - paid,
          display: invoiceDisplayStatus(i.status, i.grand_total, paid, i.due_date),
          projectName: i.project_id ? projectById.get(i.project_id)?.name ?? "" : "",
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, paidFor, projectById],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((r) => {
      if (status !== ALL && r.display !== status) return false;
      if (projectId !== ALL) {
        if (projectId === "none" ? Boolean(r.project_id) : r.project_id !== projectId) return false;
      }
      if (!q) return true;
      return [r.invoice_no, r.title, r.bill_to_name, r.projectName].join(" ").toLowerCase().includes(q);
    });
  }, [enriched, query, status, projectId]);


  const kpis = useMemo(() => {
    const invoiced = enriched.filter((r) => r.status !== "cancelled");
    const total = invoiced.reduce((s, r) => s + r.grand_total, 0);
    const collected = invoiced.reduce((s, r) => s + r.paid, 0);
    return { total, collected, outstanding: total - collected };
  }, [enriched]);

  const initial = useMemo<Partial<DocFormValue> | null>(() => {
    if (!editing) return null;
    return {
      client_id: editing.client_id,
      project_id: editing.project_id,
      title: editing.title,
      date: editing.invoice_date,
      secondaryDate: editing.due_date,
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
  }, [editing?.id]);

  async function handleSubmit(v: DocFormValue) {
    const payload = {
      client_id: v.client_id,
      project_id: v.project_id,
      title: v.title,
      invoice_date: v.date,
      due_date: v.secondaryDate,
      status: v.status as InvoiceStatus,
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
    if (editing) return await updateInvoice(editing.id, payload);
    const number = await allocateDocumentNumber("invoice");
    if (!number) return false;
    const id = await createInvoice({ ...payload, invoice_no: number });
    return Boolean(id);
  }

  function handlePrint(i: InvoiceRow, paid: number) {
    const { lines, totals, taxGroups } = recompute(i.items as any, i.is_interstate);
    const html = buildDocumentHtml(
      {
        kind: "Tax Invoice",
        number: i.invoice_no,
        date: i.invoice_date,
        secondaryLabel: "Due",
        secondaryValue: i.due_date ?? undefined,
        title: i.title,
        billToName: i.bill_to_name,
        billToAddress: i.bill_to_address,
        billToGstin: i.bill_to_gstin,
        billToContactPerson: i.bill_to_contact_person,
        billToContactNumber: i.bill_to_contact_number,
        placeOfSupply: i.place_of_supply,
        isInterstate: i.is_interstate,
        items: lines,
        totals,
        taxGroups,
        notes: i.notes,
        terms: i.terms,
        paidAmount: paid,
      },
      brand,
      printOptions,
    );
    if (!printHtml(html)) toast.error("Allow pop-ups to print this invoice");
  }

  async function handleDelete(i: InvoiceRow) {
    const ok = await confirm({
      title: "Delete invoice?",
      description: `${i.invoice_no} and its line items will be permanently removed.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteInvoice(i.id);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Kpi label="Total invoiced" value={formatINR(kpis.total)} />
        <Kpi label="Collected" value={formatINR(kpis.collected)} />
        <Kpi label="Outstanding" value={formatINR(kpis.outstanding)} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          placeholder="Search invoices…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {["draft", "sent", "partly_paid", "paid", "overdue", "cancelled"].map((s) => (
              <SelectItem key={s} value={s}>{DOC_STATUS_META[s]?.label ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All projects</SelectItem>
            <SelectItem value="none">Not linked to a project</SelectItem>
            {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-2 sm:ml-auto">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv("invoices", rows, [
                { key: "no", label: "Invoice No", value: (r) => r.invoice_no },
                { key: "date", label: "Date", value: (r) => r.invoice_date },
                { key: "due", label: "Due Date", value: (r) => r.due_date ?? "" },
                { key: "client", label: "Bill To", value: (r) => r.bill_to_name },
                { key: "project", label: "Project", value: (r) => r.projectName },

                { key: "status", label: "Status", value: (r) => DOC_STATUS_META[r.display]?.label ?? r.display },
                { key: "total", label: "Grand Total", value: (r) => r.grand_total },
                { key: "paid", label: "Paid", value: (r) => r.paid },
                { key: "balance", label: "Balance", value: (r) => r.balance },
              ])
            }
          >
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button variant="outline" onClick={() => setPayFor("")} disabled={!canManage}>
            <IndianRupee className="w-4 h-4 mr-1" /> Record payment
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={!canManage}>
            <Plus className="w-4 h-4 mr-1" /> New invoice
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading invoices…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <ReceiptText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="font-medium">No invoices yet</p>
          <p className="text-sm text-muted-foreground">Raise your first invoice or convert a quotation.</p>
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b border-glass-border">
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Bill to</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>



                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const meta = DOC_STATUS_META[i.display];
                return (
                  <tr key={i.id} className="border-b border-glass-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">{i.invoice_no}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDate(i.invoice_date, "d MMM yyyy")}
                      {i.due_date && <div className="text-xs text-muted-foreground">Due {formatDate(i.due_date, "d MMM yyyy")}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="truncate max-w-[200px]">{i.bill_to_name}</div>
                      {i.title && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{i.title}</div>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{i.projectName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full border text-xs whitespace-nowrap", meta?.cls)}>
                        {meta?.label ?? i.display}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatINR(i.grand_total)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatINR(i.balance)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Record payment" disabled={!canManage} onClick={() => setPayFor(i.id)}>
                          <IndianRupee className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Print" onClick={() => handlePrint(i, i.paid)}>
                          <Printer className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" disabled={!canManage} onClick={() => { setEditing(i); setOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" disabled={!canManage} onClick={() => handleDelete(i)}>
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
        onOpenChange={setOpen}
        kind="invoice"
        statuses={STATUSES}
        initial={initial}
        numberLabel={editing?.invoice_no}
        onSubmit={handleSubmit}
      />
      <RecordPaymentDialog
        open={payFor !== null}
        onOpenChange={(o) => { if (!o) setPayFor(null); }}
        invoiceId={payFor || undefined}
      />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold mt-1">{value}</div>
    </div>
  );
}
