import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";

export type PaymentMode = "cash" | "bank_transfer" | "upi" | "card" | "cheque" | "other";

export interface PaymentRow {
  id: string;
  project_id: string;
  amount: number;
  paid_on: string;
  description: string;
  mode: PaymentMode;
  account_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PaymentInput {
  project_id: string;
  amount: number;
  paid_on: string;
  description: string;
  mode: PaymentMode;
  account_id?: string | null;
}

export const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

const CACHE_KEY = "project_payments";
const EVENT = "project-payments:changed";

async function fetchPayments(): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("project_payments" as any)
    .select("*")
    .order("paid_on", { ascending: false });
  if (error) toast.error(`Failed to load payments: ${error.message}`);
  return ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount) })) as PaymentRow[];
}

export function useProjectPayments(projectId?: string) {
  const { data, loading, reload } = useSharedResource<PaymentRow[]>(CACHE_KEY, fetchPayments, {
    eventName: EVENT,
  });

  useEffect(() => {
    return subscribeTables("project_payments", ["project_payments"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const all = data ?? [];
  const payments = projectId ? all.filter((p) => p.project_id === projectId) : all;
  const total = payments.reduce((s, p) => s + p.amount, 0);

  const addPayment = async (input: PaymentInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("project_payments" as any).insert({
      ...input,
      created_by: userData.user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
    toast.success("Payment recorded");
    return true;
  };

  const updatePayment = async (id: string, patch: Partial<PaymentInput>) => {
    const { error } = await supabase.from("project_payments" as any).update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
    toast.success("Payment updated");
    return true;
  };

  const deletePayment = async (id: string) => {
    const { error } = await supabase.from("project_payments" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
    toast.success("Payment deleted");
    return true;
  };

  return { payments, total, loading, addPayment, updatePayment, deletePayment };
}
