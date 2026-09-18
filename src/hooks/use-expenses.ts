import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import type { PaymentMode } from "@/hooks/use-project-payments";
import { isFutureLocalDate } from "@/lib/format";

export type ExpenseMode = PaymentMode;

export interface ExpenseItemRow {
  id: string;
  expense_id: string;
  description: string;
  category: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
}

export interface ExpenseItemInput {
  description: string;
  category: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface ExpenseRow {
  id: string;
  title: string;
  amount: number;
  spent_on: string;
  category: string;
  mode: ExpenseMode;
  note: string;
  client_id: string | null;
  project_id: string | null;
  account_id: string | null;
  created_by: string | null;
  created_at: string;
  items: ExpenseItemRow[];
}

export interface ExpenseInput {
  title: string;
  amount: number;
  spent_on: string;
  category: string;
  mode: ExpenseMode;
  note: string;
  client_id: string | null;
  project_id: string | null;
  account_id?: string | null;
}

export interface ExpenseCategoryRow {
  id: string;
  name: string;
  sort_order: number;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Travel",
  "Materials",
  "Salary",
  "Rent",
  "Utilities",
  "Marketing",
  "Misc",
];

const CACHE_KEY = "expenses";
const EVENT = "expenses:changed";
const CAT_CACHE_KEY = "expense_categories";
const CAT_EVENT = "expense-categories:changed";

/** Fallback item derived from the parent row, for legacy single-amount expenses. */
function syntheticItem(e: any): ExpenseItemRow {
  return {
    id: `${e.id}-legacy`,
    expense_id: e.id,
    description: e.title,
    category: e.category ?? "",
    quantity: 1,
    rate: Number(e.amount),
    amount: Number(e.amount),
    sort_order: 0,
  };
}

async function fetchExpenses(): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses" as any)
    .select("*")
    .order("spent_on", { ascending: false });
  if (error) toast.error(`Failed to load expenses: ${error.message}`);
  const rows = (data ?? []) as any[];
  if (rows.length === 0) return [];

  const { data: itemData } = await supabase
    .from("expense_items" as any)
    .select("*")
    .order("sort_order");
  const byExpense = new Map<string, ExpenseItemRow[]>();
  for (const it of (itemData ?? []) as any[]) {
    const row: ExpenseItemRow = {
      id: it.id,
      expense_id: it.expense_id,
      description: it.description ?? "",
      category: it.category ?? "",
      quantity: Number(it.quantity),
      rate: Number(it.rate),
      amount: Number(it.amount),
      sort_order: it.sort_order ?? 0,
    };
    const list = byExpense.get(row.expense_id);
    if (list) list.push(row);
    else byExpense.set(row.expense_id, [row]);
  }

  return rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    items: byExpense.get(r.id) ?? [syntheticItem(r)],
  })) as ExpenseRow[];
}


async function fetchCategories(): Promise<ExpenseCategoryRow[]> {
  const { data, error } = await supabase
    .from("expense_categories" as any)
    .select("*")
    .order("sort_order");
  if (error) return [];
  return (data ?? []) as unknown as ExpenseCategoryRow[];
}

export function useExpenseCategories() {
  const { data, loading, reload } = useSharedResource<ExpenseCategoryRow[]>(
    CAT_CACHE_KEY,
    fetchCategories,
    { eventName: CAT_EVENT },
  );
  const rows = data ?? [];
  const names = rows.length ? rows.map((r) => r.name) : DEFAULT_EXPENSE_CATEGORIES;

  const addCategory = async (name: string) => {
    const clean = name.trim();
    if (!clean) return false;
    if (rows.some((r) => r.name.toLowerCase() === clean.toLowerCase())) return true;
    const { error } = await supabase
      .from("expense_categories" as any)
      .insert({ name: clean, sort_order: rows.length });
    if (error) {
      toast.error(error.message);
      return false;
    }
    invalidateCache(CAT_CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(CAT_EVENT));
    return true;
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("expense_categories" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    invalidateCache(CAT_CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(CAT_EVENT));
    return true;
  };

  return { categories: rows, names, loading, addCategory, deleteCategory, reload };
}

export function useExpenses(filter?: { projectId?: string; clientId?: string }) {
  const { data, loading, reload } = useSharedResource<ExpenseRow[]>(CACHE_KEY, fetchExpenses, {
    eventName: EVENT,
  });

  useEffect(() => {
    return subscribeTables("expenses", ["expenses", "expense_items"], () => {
      invalidateCache(CACHE_KEY);
      reload();
    });
  }, [reload]);

  const all = data ?? [];
  let expenses = all;
  if (filter?.projectId) expenses = expenses.filter((e) => e.project_id === filter.projectId);
  if (filter?.clientId) expenses = expenses.filter((e) => e.client_id === filter.clientId);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const refresh = async () => {
    invalidateCache(CACHE_KEY);
    await reload();
    window.dispatchEvent(new Event(EVENT));
  };

  const writeItems = async (expenseId: string, items: ExpenseItemInput[]) => {
    const { error: delError } = await supabase
      .from("expense_items" as any)
      .delete()
      .eq("expense_id", expenseId);
    if (delError) return delError.message;
    if (items.length === 0) return null;
    const { error } = await supabase.from("expense_items" as any).insert(
      items.map((it, i) => ({
        expense_id: expenseId,
        description: it.description,
        category: it.category,
        quantity: it.quantity,
        rate: it.rate,
        amount: it.amount,
        sort_order: i,
      })),
    );
    return error ? error.message : null;
  };

  const addExpense = async (input: ExpenseInput, items?: ExpenseItemInput[]) => {
    if (!input.amount || input.amount <= 0 || isNaN(input.amount)) {
      toast.error("Expense amount must be greater than zero");
      return false;
    }
    if (isFutureLocalDate(input.spent_on)) {
      toast.error("Expense date cannot be in the future");
      return false;
    }
    const sanitizedAccountId =
      input.account_id && input.account_id !== "none" ? input.account_id : null;
    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("expenses" as any)
      .insert({
        ...input,
        account_id: sanitizedAccountId,
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !created) {
      if (error?.message?.includes("expenses_account_id_fkey")) {
        toast.error("Selected payment account is invalid or was removed. Please reselect the account.");
      } else {
        toast.error(error?.message ?? "Failed to record expense");
      }
      return false;
    }
    if (items?.length) {
      const itemError = await writeItems((created as any).id, items);
      if (itemError) {
        // Rollback created expense
        await supabase.from("expenses" as any).delete().eq("id", (created as any).id);
        toast.error(`Failed to record expense items: ${itemError}`);
        await refresh();
        return false;
      }
    }
    await refresh();
    toast.success("Expense recorded");
    return true;
  };

  const updateExpense = async (
    id: string,
    patch: Partial<ExpenseInput>,
    items?: ExpenseItemInput[],
  ) => {
    if (patch.amount !== undefined && (patch.amount <= 0 || isNaN(patch.amount))) {
      toast.error("Expense amount must be greater than zero");
      return false;
    }
    if (patch.spent_on && isFutureLocalDate(patch.spent_on)) {
      toast.error("Expense date cannot be in the future");
      return false;
    }
    const payload: any = { ...patch };
    if ("account_id" in patch) {
      payload.account_id =
        patch.account_id && patch.account_id !== "none" ? patch.account_id : null;
    }
    const { error } = await supabase
      .from("expenses" as any)
      .update(payload)
      .eq("id", id);
    if (error) {
      if (error.message.includes("expenses_account_id_fkey")) {
        toast.error("Selected payment account is invalid or was removed. Please reselect the account.");
      } else {
        toast.error(error.message);
      }
      return false;
    }
    if (items) {
      const itemError = await writeItems(id, items);
      if (itemError) {
        toast.error(itemError);
        await refresh();
        return false;
      }
    }
    await refresh();
    toast.success("Expense updated");
    return true;
  };


  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from("expenses" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await refresh();
    toast.success("Expense deleted");
    return true;
  };

  return { expenses, all, total, loading, addExpense, updateExpense, deleteExpense, reload: refresh, refresh };
}