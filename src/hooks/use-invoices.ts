import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import { computeDocument, type LineItemInput } from "@/lib/invoice-calc";
import type { DocItemRow } from "@/hooks/use-quotations";

export type InvoiceStatus = "draft" | "sent" | "cancelled";

export interface InvoiceRow {
  id: string;
  invoice_no: string;
  client_id: string | null;
  project_id: string | null;
  quotation_id: string | null;
  title: string;
  invoice_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  place_of_supply: string;
  is_interstate: boolean;
  bill_to_name: string;
  bill_to_address: string;
  bill_to_gstin: string;
  bill_to_contact_person: string;
  bill_to_contact_number: string;
  notes: string;
  terms: string;
  subtotal: number;
  discount_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  round_off: number;
  grand_total: number;
  created_by: string | null;
  created_at: string;
  items: DocItemRow[];
}

export interface InvoiceInput {
  invoice_no?: string;
  client_id: string | null;
  project_id: string | null;
  quotation_id?: string | null;
  title: string;
  invoice_date: string;
  due_date: string | null;
  status: InvoiceStatus;
  place_of_supply: string;
  is_interstate: boolean;
  bill_to_name: string;
  bill_to_address: string;
  bill_to_gstin: string;
  bill_to_contact_person?: string;
  bill_to_contact_number?: string;
  notes: string;
  terms: string;
  items: LineItemInput[];
  roundOff?: boolean;
}

const CACHE_KEY = "invoices";
const EVENT = "invoices:changed";

const num = (v: any) => Number(v ?? 0);

async function fetchInvoices(): Promise<InvoiceRow[]> {
  const [{ data: docs, error }, { data: items }] = await Promise.all([
    supabase.from("invoices").select("*").order("invoice_date", { ascending: false }),
    supabase.from("invoice_items").select("*").order("sort_order"),
  ]);
  if (error) {
    toast.error(`Failed to load invoices: ${error.message}`);
    return [];
  }
  const byDoc = new Map<string, DocItemRow[]>();
  for (const it of (items ?? []) as any[]) {
    const list = byDoc.get(it.invoice_id) ?? [];
    list.push({
      id: it.id,
      item_id: it.item_id ?? null,
      description: it.description,
      hsn_sac: it.hsn_sac,
      unit: it.unit,
      quantity: num(it.quantity),
      rate: num(it.rate),
      discount_percent: num(it.discount_percent),
      gst_percent: num(it.gst_percent),
      taxable_amount: num(it.taxable_amount),
      tax_amount: num(it.tax_amount),
      line_total: num(it.line_total),
      sort_order: it.sort_order,
    });
    byDoc.set(it.invoice_id, list);
  }
  return ((docs ?? []) as any[]).map((d) => ({
    ...d,
    subtotal: num(d.subtotal),
    discount_total: num(d.discount_total),
    cgst_total: num(d.cgst_total),
    sgst_total: num(d.sgst_total),
    igst_total: num(d.igst_total),
    round_off: num(d.round_off),
    grand_total: num(d.grand_total),
    items: byDoc.get(d.id) ?? [],
  })) as InvoiceRow[];
}

function docPayload(input: InvoiceInput) {
  const { lines, totals } = computeDocument(input.items, {
    isInterstate: input.is_interstate,
    roundOff: input.roundOff !== false,
  });
  return {
    doc: {
      client_id: input.client_id,
      project_id: input.project_id,
      quotation_id: input.quotation_id ?? null,
      title: input.title,
      invoice_date: input.invoice_date,
      due_date: input.due_date,
      status: input.status,
      place_of_supply: input.place_of_supply,
      is_interstate: input.is_interstate,
      bill_to_name: input.bill_to_name,
      bill_to_address: input.bill_to_address,
      bill_to_gstin: input.bill_to_gstin,
      bill_to_contact_person: input.bill_to_contact_person ?? "",
      bill_to_contact_number: input.bill_to_contact_number ?? "",
      notes: input.notes,
      terms: input.terms,
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      cgst_total: totals.cgst_total,
      sgst_total: totals.sgst_total,
      igst_total: totals.igst_total,
      round_off: totals.round_off,
      grand_total: totals.grand_total,
    },
    lines,
  };
}

export function useInvoices(filters?: { clientId?: string; projectId?: string }) {
  const { data, loading, reload } = useSharedResource<InvoiceRow[]>(CACHE_KEY, fetchInvoices, {
    eventName: EVENT,
  });

  useEffect(() => {
    return subscribeTables("invoices", ["invoices", "invoice_items"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const all = data ?? [];
  const invoices = all.filter(
    (i) =>
      (!filters?.clientId || i.client_id === filters.clientId) &&
      (!filters?.projectId || i.project_id === filters.projectId),
  );

  const refresh = async () => {
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const createInvoice = async (input: InvoiceInput): Promise<string | null> => {
    const { doc, lines } = docPayload(input);
    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("invoices")
      .insert({
        ...doc,
        invoice_no: input.invoice_no ?? "",
        created_by: userData.user?.id ?? null,
      } as any)
      .select("id")
      .single();
    if (error || !created) {
      toast.error(error?.message ?? "Could not create invoice");
      return null;
    }
    const id = (created as any).id as string;
    if (lines.length) {
      const { error: iErr } = await supabase
        .from("invoice_items")
        .insert(lines.map((l, i) => ({ ...l, invoice_id: id, sort_order: i })) as any);
      if (iErr) {
        // Rollback created invoice if items failed
        await supabase.from("invoices").delete().eq("id", id);
        toast.error(`Failed to save invoice line items: ${iErr.message}`);
        return null;
      }
    }

    // Sync stock movements for linked stock items
    if (doc.status !== "cancelled") {
      const stockLines = lines.filter((l) => l.item_id && l.quantity > 0);
      if (stockLines.length > 0) {
        await supabase.from("stock_movements" as any).insert(
          stockLines.map((l) => ({
            item_id: l.item_id,
            movement_type: "out",
            quantity: l.quantity,
            rate: l.rate,
            reference_type: "invoice",
            reference_id: id,
            moved_on: doc.invoice_date,
            note: `Invoice ${input.invoice_no ?? ""}`,
            created_by: userData.user?.id ?? null,
          }))
        );
        invalidateCache("stock_movements");
        window.dispatchEvent(new Event("stock-movements:changed"));
      }
    }

    await refresh();
    toast.success("Invoice created");
    return id;
  };

  const updateInvoice = async (id: string, input: InvoiceInput) => {
    const { doc, lines } = docPayload(input);
    const { error } = await supabase.from("invoices").update(doc as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    if (lines.length) {
      const { error: iErr } = await supabase
        .from("invoice_items")
        .insert(lines.map((l, i) => ({ ...l, invoice_id: id, sort_order: i })) as any);
      if (iErr) { toast.error(iErr.message); return false; }
    }

    // Sync stock movements
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("stock_movements" as any).delete().eq("reference_type", "invoice").eq("reference_id", id);
    if (doc.status !== "cancelled") {
      const stockLines = lines.filter((l) => l.item_id && l.quantity > 0);
      if (stockLines.length > 0) {
        await supabase.from("stock_movements" as any).insert(
          stockLines.map((l) => ({
            item_id: l.item_id,
            movement_type: "out",
            quantity: l.quantity,
            rate: l.rate,
            reference_type: "invoice",
            reference_id: id,
            moved_on: doc.invoice_date,
            note: `Invoice ${input.invoice_no ?? ""}`,
            created_by: userData.user?.id ?? null,
          }))
        );
      }
    }
    invalidateCache("stock_movements");
    window.dispatchEvent(new Event("stock-movements:changed"));

    await refresh();
    toast.success("Invoice updated");
    return true;
  };

  const setStatus = async (id: string, status: InvoiceStatus) => {
    const { error } = await supabase.from("invoices").update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }

    if (status === "cancelled") {
      await supabase.from("stock_movements" as any).delete().eq("reference_type", "invoice").eq("reference_id", id);
      invalidateCache("stock_movements");
      window.dispatchEvent(new Event("stock-movements:changed"));
    }

    await refresh();
    return true;
  };

  const deleteInvoice = async (id: string) => {
    await supabase.from("stock_movements" as any).delete().eq("reference_type", "invoice").eq("reference_id", id);
    invalidateCache("stock_movements");
    window.dispatchEvent(new Event("stock-movements:changed"));

    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    toast.success("Invoice deleted");
    return true;
  };

  return {
    invoices,
    all,
    loading,
    createInvoice,
    updateInvoice,
    setStatus,
    deleteInvoice,
    reload: refresh,
    refresh,
  };
}
