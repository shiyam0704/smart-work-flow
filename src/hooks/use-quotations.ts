import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import { computeDocument, type LineItemInput } from "@/lib/invoice-calc";

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export interface DocItemRow extends LineItemInput {
  id?: string;
  taxable_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
}

export interface QuotationRow {
  id: string;
  quotation_no: string;
  client_id: string | null;
  project_id: string | null;
  lead_id?: string | null;
  title: string;
  quotation_date: string;
  valid_until: string | null;
  status: QuotationStatus;
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

export interface QuotationInput {
  quotation_no?: string;
  client_id: string | null;
  project_id: string | null;
  lead_id?: string | null;
  title: string;
  quotation_date: string;
  valid_until: string | null;
  status: QuotationStatus;
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

const CACHE_KEY = "quotations";
const EVENT = "quotations:changed";

const num = (v: any) => Number(v ?? 0);

async function fetchQuotations(): Promise<QuotationRow[]> {
  const [{ data: docs, error }, { data: items }] = await Promise.all([
    supabase.from("quotations").select("*").order("quotation_date", { ascending: false }),
    supabase.from("quotation_items").select("*").order("sort_order"),
  ]);
  if (error) {
    toast.error(`Failed to load quotations: ${error.message}`);
    return [];
  }
  const byDoc = new Map<string, DocItemRow[]>();
  for (const it of (items ?? []) as any[]) {
    const list = byDoc.get(it.quotation_id) ?? [];
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
    byDoc.set(it.quotation_id, list);
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
  })) as QuotationRow[];
}

function docPayload(input: QuotationInput) {
  const { lines, totals } = computeDocument(input.items, {
    isInterstate: input.is_interstate,
    roundOff: input.roundOff !== false,
  });
  return {
    doc: {
      client_id: input.client_id,
      project_id: input.project_id,
      lead_id: input.lead_id ?? null,
      title: input.title,
      quotation_date: input.quotation_date,
      valid_until: input.valid_until,
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

export function useQuotations(filters?: { clientId?: string; projectId?: string; leadId?: string }) {
  const { data, loading, reload } = useSharedResource<QuotationRow[]>(CACHE_KEY, fetchQuotations, {
    eventName: EVENT,
  });

  useEffect(() => {
    return subscribeTables("quotations", ["quotations", "quotation_items"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const all = data ?? [];
  const quotations = all.filter(
    (q) =>
      (!filters?.clientId || q.client_id === filters.clientId) &&
      (!filters?.projectId || q.project_id === filters.projectId) &&
      (!filters?.leadId || q.lead_id === filters.leadId),
  );

  const refresh = async () => {
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const createQuotation = async (input: QuotationInput): Promise<string | null> => {
    const { doc, lines } = docPayload(input);
    const { data: userData } = await supabase.auth.getUser();
    let insertPayload: any = {
      ...doc,
      quotation_no: input.quotation_no ?? "",
      created_by: userData.user?.id ?? null,
    };
    let { data: created, error } = await supabase
      .from("quotations")
      .insert(insertPayload)
      .select("id")
      .single();

    // Graceful fallback if lead_id migration hasn't run on the database server yet
    if (error && error.message?.includes("lead_id") && insertPayload.lead_id !== undefined) {
      const { lead_id, ...withoutLead } = insertPayload;
      const res = await supabase.from("quotations").insert(withoutLead).select("id").single();
      created = res.data;
      error = res.error;
    }

    if (error || !created) {
      toast.error(error?.message ?? "Could not create quotation");
      return null;
    }
    const qid = (created as any).id as string;
    if (lines.length) {
      const { error: iErr } = await supabase.from("quotation_items").insert(
        lines.map((l, i) => ({ ...l, quotation_id: qid, sort_order: i })) as any,
      );
      if (iErr) {
        await supabase.from("quotations").delete().eq("id", qid);
        toast.error(`Failed to save quotation items: ${iErr.message}`);
        return null;
      }
    }
    await refresh();
    toast.success("Quotation created");
    return qid;
  };

  const updateQuotation = async (id: string, input: QuotationInput) => {
    const { doc, lines } = docPayload(input);
    let { error } = await supabase.from("quotations").update(doc as any).eq("id", id);
    if (error && error.message?.includes("lead_id") && (doc as any).lead_id !== undefined) {
      const { lead_id, ...withoutLead } = doc as any;
      const res = await supabase.from("quotations").update(withoutLead).eq("id", id);
      error = res.error;
    }
    if (error) { toast.error(error.message); return false; }
    await supabase.from("quotation_items").delete().eq("quotation_id", id);
    if (lines.length) {
      const { error: iErr } = await supabase.from("quotation_items").insert(
        lines.map((l, i) => ({ ...l, quotation_id: id, sort_order: i })) as any,
      );
      if (iErr) { toast.error(iErr.message); return false; }
    }
    await refresh();
    toast.success("Quotation updated");
    return true;
  };

  const setStatus = async (id: string, status: QuotationStatus) => {
    const { error } = await supabase.from("quotations").update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const deleteQuotation = async (id: string) => {
    const { error } = await supabase.from("quotations").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    toast.success("Quotation deleted");
    return true;
  };

  return {
    quotations,
    all,
    loading,
    createQuotation,
    updateQuotation,
    setStatus,
    deleteQuotation,
    reload: refresh,
    refresh,
  };
}
