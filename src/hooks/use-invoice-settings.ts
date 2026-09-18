import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";

export interface InvoiceSettingsRow {
  id: string;
  company_id: string | null;
  legal_name: string;
  gstin: string;
  pan: string;
  registered_address: string;
  state_name: string;
  state_code: string;
  email: string;
  phone: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  upi_id: string;
  default_quotation_terms: string;
  default_invoice_terms: string;
  footer_note: string;
  signature_url: string;
  default_gst_percent: number;
  quotation_validity_days: number;
  invoice_due_days: number;
  round_off_enabled: boolean;
  paper_size: "A4" | "A5";
  receipt_paper_size: "A4" | "A5";
  print_template: "classic" | "modern" | "compact";
  print_accent_color: string;
  rows_first_page: number;
  rows_next_page: number;
  repeat_table_header: boolean;
  repeat_brand_header: boolean;
  show_page_numbers: boolean;
  show_continued_marker: boolean;
  require_project_on_invoice: boolean;
  include_supplier_payments_in_accounts: boolean;
  include_project_payments_in_income: boolean;
  ledger_opening_date: string | null;
}


export interface NumberSeriesRow {
  id: string;
  doc_type: "quotation" | "invoice" | "receipt" | "purchase_order" | "purchase_payment";
  prefix: string;
  next_number: number;
  padding: number;
  reset_yearly: boolean;
  current_year: number;
}

export interface TaxRateRow { id: string; label: string; percent: number; sort_order: number }
export interface UnitRow { id: string; name: string; sort_order: number }

const S_KEY = "invoice_settings";
const S_EVENT = "invoice-settings:changed";
const N_KEY = "invoice_number_series";
const N_EVENT = "invoice-number-series:changed";
const T_KEY = "invoice_tax_rates";
const T_EVENT = "invoice-tax-rates:changed";
const U_KEY = "invoice_units";
const U_EVENT = "invoice-units:changed";

async function fetchSettings(): Promise<InvoiceSettingsRow | null> {
  const { data, error } = await supabase.from("invoice_settings").select("*").limit(1).maybeSingle();
  if (error) return null;
  if (!data) return null;
  const r = data as any;
  return {
    ...r,
    default_gst_percent: Number(r.default_gst_percent),
  } as InvoiceSettingsRow;
}

export function useInvoiceSettings() {
  const { data, loading, reload } = useSharedResource<InvoiceSettingsRow | null>(
    S_KEY,
    fetchSettings,
    { eventName: S_EVENT },
  );

  const save = async (patch: Partial<InvoiceSettingsRow>) => {
    if (data?.id) {
      const { error } = await supabase.from("invoice_settings").update(patch as any).eq("id", data.id);
      if (error) { toast.error(error.message); return false; }
    } else {
      const { error } = await supabase.from("invoice_settings").insert(patch as any);
      if (error) { toast.error(error.message); return false; }
    }
    invalidateCache(S_KEY);
    await reload();
    window.dispatchEvent(new Event(S_EVENT));
    toast.success("Invoicing settings saved");
    return true;
  };

  return { settings: data ?? null, loading, save, reload };
}

export function useNumberSeries() {
  const { data, loading, reload } = useSharedResource<NumberSeriesRow[]>(
    N_KEY,
    async () => {
      const { data, error } = await supabase
        .from("invoice_number_series")
        .select("*")
        .order("doc_type");
      if (error) return [];
      return (data ?? []) as unknown as NumberSeriesRow[];
    },
    { eventName: N_EVENT },
  );

  const saveSeries = async (docType: NumberSeriesRow["doc_type"], patch: Partial<NumberSeriesRow>) => {
    const existing = (data ?? []).find((s) => s.doc_type === docType);
    if (existing) {
      const { error } = await supabase.from("invoice_number_series").update(patch as any).eq("id", existing.id);
      if (error) { toast.error(error.message); return false; }
    } else {
      const { error } = await supabase
        .from("invoice_number_series")
        .insert({ doc_type: docType, ...patch } as any);
      if (error) { toast.error(error.message); return false; }
    }
    invalidateCache(N_KEY);
    await reload();
    window.dispatchEvent(new Event(N_EVENT));
    toast.success("Number series saved");
    return true;
  };

  return { series: data ?? [], loading, saveSeries, reload };
}

export function useTaxRates() {
  const { data, loading, reload } = useSharedResource<TaxRateRow[]>(
    T_KEY,
    async () => {
      const { data, error } = await supabase.from("invoice_tax_rates").select("*").order("sort_order");
      if (error) return [];
      return ((data ?? []) as any[]).map((r) => ({ ...r, percent: Number(r.percent) })) as TaxRateRow[];
    },
    { eventName: T_EVENT },
  );

  const refresh = async () => {
    invalidateCache(T_KEY);
    await reload();
    window.dispatchEvent(new Event(T_EVENT));
  };

  const addRate = async (label: string, percent: number) => {
    const { error } = await supabase
      .from("invoice_tax_rates")
      .insert({ label, percent, sort_order: (data ?? []).length } as any);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const removeRate = async (id: string) => {
    const { error } = await supabase.from("invoice_tax_rates").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  return { rates: data ?? [], loading, addRate, removeRate };
}

export function useUnits() {
  const { data, loading, reload } = useSharedResource<UnitRow[]>(
    U_KEY,
    async () => {
      const { data, error } = await supabase.from("invoice_units").select("*").order("sort_order");
      if (error) return [];
      return (data ?? []) as unknown as UnitRow[];
    },
    { eventName: U_EVENT },
  );

  const refresh = async () => {
    invalidateCache(U_KEY);
    await reload();
    window.dispatchEvent(new Event(U_EVENT));
  };

  const addUnit = async (name: string) => {
    const { error } = await supabase
      .from("invoice_units")
      .insert({ name, sort_order: (data ?? []).length } as any);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const removeUnit = async (id: string) => {
    const { error } = await supabase.from("invoice_units").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  return { units: data ?? [], loading, addUnit, removeUnit };
}

/** Allocates the next document number atomically on the server. */
export async function allocateDocumentNumber(
  docType: "quotation" | "invoice" | "receipt" | "purchase_order" | "purchase_payment",
): Promise<string | null> {
  const { data, error } = await supabase.rpc("next_document_number", { _doc_type: docType });
  if (error) { toast.error(`Could not generate number: ${error.message}`); return null; }
  invalidateCache(N_KEY);
  window.dispatchEvent(new Event(N_EVENT));
  return data as unknown as string;
}
