import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { isFutureLocalDate } from "@/lib/format";

export type AccountType = "cash" | "bank" | "upi" | "other";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "upi", label: "UPI / Wallet" },
  { value: "other", label: "Other" },
];

export const accountTypeLabel = (t: string) =>
  ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;

export interface PaymentAccountRow {
  id: string;
  name: string;
  account_type: AccountType;
  bank_name: string;
  account_no: string;
  ifsc: string;
  holder_name: string;
  opening_balance: number;
  opening_date: string | null;
  is_active: boolean;
  notes: string;
  sort_order: number;
  created_at: string;
}

export interface PaymentAccountInput {
  name: string;
  account_type: AccountType;
  bank_name: string;
  account_no: string;
  ifsc: string;
  holder_name: string;
  opening_balance: number;
  opening_date: string | null;
  is_active: boolean;
  notes: string;
}

export interface AccountTransferRow {
  id: string;
  from_account_id: string;
  to_account_id: string;
  transfer_date: string;
  amount: number;
  reference_no: string;
  note: string;
  created_at: string;
}

export interface AccountTransferInput {
  from_account_id: string;
  to_account_id: string;
  transfer_date: string;
  amount: number;
  reference_no: string;
  note: string;
}

const KEY = "payment_accounts";
const EVENT = "payment-accounts:changed";
const T_KEY = "account_transfers";
const T_EVENT = "account-transfers:changed";

/** Remembers the account last used when recording money, per browser. */
const LAST_USED = "swf:last-account-id";
export const rememberAccount = (id: string | null) => {
  try {
    if (typeof window === "undefined") return;
    if (id) window.localStorage.setItem(LAST_USED, id);
    else window.localStorage.removeItem(LAST_USED);
  } catch { /* storage unavailable */ }
};
export const lastUsedAccount = (validAccounts?: { id: string }[]): string | null => {
  try {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(LAST_USED);
    if (!stored) return null;
    if (validAccounts && validAccounts.length > 0 && !validAccounts.some((a) => a.id === stored)) {
      window.localStorage.removeItem(LAST_USED);
      return null;
    }
    return stored;
  } catch { return null; }
};

async function fetchAccounts(): Promise<PaymentAccountRow[]> {
  const { data, error } = await supabase
    .from("payment_accounts" as any)
    .select("*")
    .order("sort_order")
    .order("name");
  if (error) {
    toast.error(`Failed to load accounts: ${error.message}`);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    opening_balance: Number(r.opening_balance ?? 0),
  })) as PaymentAccountRow[];
}

async function fetchTransfers(): Promise<AccountTransferRow[]> {
  const { data, error } = await supabase
    .from("account_transfers" as any)
    .select("*")
    .order("transfer_date", { ascending: false });
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({ ...r, amount: Number(r.amount ?? 0) })) as AccountTransferRow[];
}

export function usePaymentAccounts() {
  const { data, loading, reload } = useSharedResource<PaymentAccountRow[]>(KEY, fetchAccounts, {
    eventName: EVENT,
  });

  const refresh = async () => {
    invalidateCache(KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const accounts = useMemo(() => data ?? [], [data]);
  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts]);
  const nameFor = useCallback(
    (id: string | null | undefined) => (id ? accounts.find((a) => a.id === id)?.name : "") || "",
    [accounts]
  );

  const addAccount = async (input: PaymentAccountInput) => {
    const { data: row, error } = await supabase
      .from("payment_accounts" as any)
      .insert({ ...input, sort_order: accounts.length } as any)
      .select("id")
      .single();
    if (error) { toast.error(error.message); return null; }
    toast.success("Account added");
    await refresh();
    return (row as any)?.id as string;
  };

  const updateAccount = async (id: string, patch: Partial<PaymentAccountInput>) => {
    const { error } = await supabase.from("payment_accounts" as any).update(patch as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Account updated");
    await refresh();
    return true;
  };

  const deleteAccount = async (id: string) => {
    // Check for linked transactions across invoice payments, expenses, supplier payments and transfers
    const [ipRes, expRes, spRes, trRes] = await Promise.all([
      supabase.from("invoice_payments").select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("expenses" as any).select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("supplier_payments" as any).select("id", { count: "exact", head: true }).eq("account_id", id),
      supabase.from("account_transfers" as any).select("id", { count: "exact", head: true }).or(`from_account_id.eq.${id},to_account_id.eq.${id}`),
    ]);
    const totalRefs = (ipRes.count ?? 0) + (expRes.count ?? 0) + (spRes.count ?? 0) + (trRes.count ?? 0);
    if (totalRefs > 0) {
      toast.error(`Cannot delete account: it has ${totalRefs} linked transaction(s). Deactivate the account instead.`);
      return false;
    }

    const { error } = await supabase.from("payment_accounts" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Account deleted");
    await refresh();
    return true;
  };

  return { accounts, activeAccounts, nameFor, loading, addAccount, updateAccount, deleteAccount, reload: refresh };
}

export function useAccountTransfers() {
  const { data, loading, reload } = useSharedResource<AccountTransferRow[]>(T_KEY, fetchTransfers, {
    eventName: T_EVENT,
  });

  const refresh = async () => {
    invalidateCache(T_KEY);
    await reload();
    window.dispatchEvent(new Event(T_EVENT));
  };

  const addTransfer = async (input: AccountTransferInput) => {
    if (input.from_account_id === input.to_account_id) {
      toast.error("From and To accounts must be different");
      return false;
    }
    if (!input.amount || input.amount <= 0 || isNaN(input.amount)) {
      toast.error("Transfer amount must be greater than zero");
      return false;
    }
    if (isFutureLocalDate(input.transfer_date)) {
      toast.error("Transfer date cannot be in the future");
      return false;
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("account_transfers" as any)
      .insert({ ...input, created_by: auth.user?.id ?? null } as any);
    if (error) { toast.error(error.message); return false; }
    toast.success("Transfer recorded");
    await refresh();
    return true;
  };

  const deleteTransfer = async (id: string) => {
    const { error } = await supabase.from("account_transfers" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Transfer deleted");
    await refresh();
    return true;
  };

  return { transfers: data ?? [], loading, addTransfer, deleteTransfer, reload: refresh };
}
