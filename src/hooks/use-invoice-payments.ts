import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import type { PaymentMode } from "@/hooks/use-project-payments";
import { allocateDocumentNumber } from "@/hooks/use-invoice-settings";

export interface InvoicePaymentRow {
  id: string;
  invoice_id: string;
  receipt_no: string;
  amount: number;
  paid_on: string;
  mode: PaymentMode;
  reference_no: string;
  note: string;
  account_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InvoicePaymentInput {
  invoice_id: string;
  amount: number;
  paid_on: string;
  mode: PaymentMode;
  reference_no: string;
  note: string;
  account_id?: string | null;
}

const CACHE_KEY = "invoice_payments";
const EVENT = "invoice-payments:changed";

async function fetchPayments(): Promise<InvoicePaymentRow[]> {
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .order("paid_on", { ascending: false });
  if (error) toast.error(`Failed to load payments: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as InvoicePaymentRow[];
}

export function useInvoicePayments(invoiceId?: string) {
  const { data, loading, reload } = useSharedResource<InvoicePaymentRow[]>(CACHE_KEY, fetchPayments, {
    eventName: EVENT,
  });

  useEffect(() => {
    return subscribeTables("invoice_payments", ["invoice_payments"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const all = data ?? [];
  const payments = invoiceId ? all.filter((p) => p.invoice_id === invoiceId) : all;
  const total = payments.reduce((s, p) => s + p.amount, 0);

  const refresh = async () => {
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  /** Total paid for a given invoice, across the whole company list. */
  const paidFor = (id: string) =>
    all.filter((p) => p.invoice_id === id).reduce((s, p) => s + p.amount, 0);

  const addPayment = async (input: InvoicePaymentInput): Promise<string | null> => {
    if (!input.amount || input.amount <= 0 || isNaN(input.amount)) {
      toast.error("Payment amount must be greater than zero");
      return null;
    }
    const { data: inv, error: invErr } = await supabase
      .from("invoices")
      .select("id, status, grand_total")
      .eq("id", input.invoice_id)
      .maybeSingle();
    if (invErr || !inv) {
      toast.error("Invoice not found");
      return null;
    }
    if (inv.status === "cancelled" || inv.status === "draft") {
      toast.error(`Cannot record payment against a ${inv.status} invoice`);
      return null;
    }
    const currentPaid = paidFor(input.invoice_id);
    const balance = Number(inv.grand_total) - currentPaid;
    if (input.amount > balance + 0.01) {
      toast.error(`Payment amount exceeds remaining balance (₹${balance.toFixed(2)})`);
      return null;
    }

    const { data: userData } = await supabase.auth.getUser();
    const receiptNo = (await allocateDocumentNumber("receipt")) ?? "";
    const { data: created, error } = await supabase
      .from("invoice_payments")
      .insert({ ...input, receipt_no: receiptNo, created_by: userData.user?.id ?? null } as any)
      .select("id")
      .single();
    if (error || !created) {
      toast.error(error?.message ?? "Could not record payment");
      return null;
    }
    await refresh();
    toast.success(`Payment recorded${receiptNo ? ` — ${receiptNo}` : ""}`);
    return (created as any).id as string;
  };

  const updatePayment = async (id: string, patch: Partial<InvoicePaymentInput>) => {
    const { error } = await supabase.from("invoice_payments").update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    toast.success("Payment updated");
    return true;
  };

  const deletePayment = async (id: string) => {
    const { error } = await supabase.from("invoice_payments").delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    toast.success("Payment deleted");
    return true;
  };

  return { payments, all, total, loading, paidFor, addPayment, updatePayment, deletePayment };
}
