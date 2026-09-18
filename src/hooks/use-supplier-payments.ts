import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { useSuppliers, type SupplierRow } from "@/hooks/use-suppliers";
import { usePurchaseOrders } from "@/hooks/use-purchase-orders";

export type SupplierPaymentMode = "cash" | "bank" | "upi" | "cheque" | "card" | "other";

export const SUPPLIER_PAYMENT_MODES: SupplierPaymentMode[] = ["cash", "bank", "upi", "cheque", "card", "other"];

export interface SupplierPaymentRow {
  id: string;
  supplier_id: string;
  purchase_order_id: string | null;
  voucher_no: string;
  amount: number;
  paid_on: string;
  mode: SupplierPaymentMode;
  reference_no: string;
  note: string;
  account_id: string | null;
  created_at: string;
}

export interface SupplierPaymentInput {
  supplier_id: string;
  purchase_order_id: string | null;
  amount: number;
  paid_on: string;
  mode: SupplierPaymentMode;
  reference_no: string;
  note: string;
  account_id?: string | null;
}

const KEY = "supplier_payments";
const EVENT = "supplier-payments:changed";

async function fetchPayments(): Promise<SupplierPaymentRow[]> {
  const { data, error } = await supabase
    .from("supplier_payments" as any)
    .select("*")
    .order("paid_on", { ascending: false });
  if (error) {
    toast.error(`Failed to load supplier payments: ${error.message}`);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount ?? 0) })) as SupplierPaymentRow[];
}

export function useSupplierPayments() {
  const { data, loading, reload } = useSharedResource<SupplierPaymentRow[]>(KEY, fetchPayments, {
    eventName: EVENT,
  });

  const refresh = async () => {
    invalidateCache(KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const addPayment = async (input: SupplierPaymentInput) => {
    let voucherNo: string | null = null;
    try {
      const { data: no, error: numErr } = await supabase.rpc("next_document_number" as any, {
        _doc_type: "purchase_payment",
      });
      if (!numErr && no) {
        voucherNo = no as unknown as string;
      }
    } catch {
      // Fallback below
    }

    if (!voucherNo) {
      try {
        const now = new Date();
        const month = now.getMonth() + 1;
        const fyYear = month < 4 ? now.getFullYear() - 1 : now.getFullYear();
        const prefix = `PV-${fyYear}-`;
        const { data } = await supabase
          .from("supplier_payments" as any)
          .select("voucher_no")
          .ilike("voucher_no", `${prefix}%`)
          .order("created_at", { ascending: false })
          .limit(100);
        let maxNum = 0;
        for (const r of (data ?? []) as any[]) {
          const match = String(r.voucher_no || "").match(/-(\d+)$/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
        voucherNo = `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
      } catch {
        voucherNo = `PV-${Date.now().toString().slice(-6)}`;
      }
    }

    const { data: auth } = await supabase.auth.getUser();
    const { data: row, error } = await supabase
      .from("supplier_payments" as any)
      .insert({ ...input, voucher_no: voucherNo, created_by: auth.user?.id ?? null } as any)
      .select("*")
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success(`Payment ${voucherNo} recorded`);
    await refresh();
    return { ...(row as any), amount: Number((row as any).amount) } as SupplierPaymentRow;
  };

  const updatePayment = async (id: string, patch: Partial<SupplierPaymentInput>) => {
    const { error } = await supabase.from("supplier_payments" as any).update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Payment updated");
    await refresh();
    return true;
  };

  const deletePayment = async (id: string) => {
    const { error } = await supabase.from("supplier_payments" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Payment deleted");
    await refresh();
    return true;
  };

  return { payments: data ?? [], loading, addPayment, updatePayment, deletePayment, reload: refresh };
}

export interface SupplierBalance {
  supplier: SupplierRow;
  opening: number;
  billed: number;
  paid: number;
  outstanding: number;
}

export interface StatementLine {
  date: string;
  kind: "opening" | "bill" | "payment";
  label: string;
  reference: string;
  debit: number; // amount we owe (bill)
  credit: number; // amount paid
  balance: number;
}

/** Supplier balances: opening + billed (goods received) − payments. Never stored. */
export function useSupplierBalances() {
  const { suppliers, loading: sLoading } = useSuppliers();
  const { receipts, loading: rLoading } = usePurchaseOrders();
  const { payments, loading: pLoading } = useSupplierPayments();

  const balances: SupplierBalance[] = suppliers.map((s) => {
    const billed = receipts.filter((r) => r.supplier_id === s.id).reduce((sum, r) => sum + r.total_value, 0);
    const paid = payments.filter((p) => p.supplier_id === s.id).reduce((sum, p) => sum + p.amount, 0);
    const opening = s.opening_balance;
    return { supplier: s, opening, billed, paid, outstanding: opening + billed - paid };
  });

  const statementFor = (supplierId: string): StatementLine[] => {
    const s = suppliers.find((x) => x.id === supplierId);
    const lines: StatementLine[] = [];
    if (s && s.opening_balance !== 0) {
      lines.push({
        date: s.created_at.slice(0, 10),
        kind: "opening",
        label: "Opening balance",
        reference: "",
        debit: s.opening_balance,
        credit: 0,
        balance: 0,
      });
    }
    for (const r of receipts.filter((x) => x.supplier_id === supplierId)) {
      lines.push({
        date: r.receipt_date,
        kind: "bill",
        label: r.bill_no ? `Bill ${r.bill_no}` : "Goods received",
        reference: r.bill_no,
        debit: r.total_value,
        credit: 0,
        balance: 0,
      });
    }
    for (const p of payments.filter((x) => x.supplier_id === supplierId)) {
      lines.push({
        date: p.paid_on,
        kind: "payment",
        label: `Payment ${p.voucher_no}`,
        reference: p.reference_no,
        debit: 0,
        credit: p.amount,
        balance: 0,
      });
    }
    lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "opening" ? -1 : 0));
    let running = 0;
    for (const l of lines) {
      running += l.debit - l.credit;
      l.balance = running;
    }
    return lines;
  };

  const totalOutstanding = balances.reduce((s, b) => s + b.outstanding, 0);

  return {
    balances,
    statementFor,
    totalOutstanding,
    loading: sLoading || rLoading || pLoading,
  };
}
