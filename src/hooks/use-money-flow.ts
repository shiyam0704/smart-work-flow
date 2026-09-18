import { useMemo } from "react";
import { useInvoicePayments } from "@/hooks/use-invoice-payments";
import { useProjectPayments, PAYMENT_MODES } from "@/hooks/use-project-payments";
import { useSupplierPayments } from "@/hooks/use-supplier-payments";
import { useSuppliers } from "@/hooks/use-suppliers";
import { useExpenses } from "@/hooks/use-expenses";
import { useInvoices } from "@/hooks/use-invoices";
import { useProjects } from "@/hooks/use-projects";
import { useClientsData } from "@/hooks/use-clients-data";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { usePaymentAccounts, useAccountTransfers, type PaymentAccountRow } from "@/hooks/use-payment-accounts";

export type MoneySource = "invoice" | "project" | "expense" | "supplier";

export interface MoneyRow {
  id: string;
  date: string;
  direction: "in" | "out";
  source: MoneySource;
  sourceLabel: string;
  ref: string;
  party: string;
  projectId: string | null;
  projectName: string;
  accountId: string | null;
  accountName: string;
  mode: string;
  note: string;
  amount: number;
}

export const modeLabel = (m: string) => PAYMENT_MODES.find((x) => x.value === m)?.label ?? m;

/**
 * One place that turns every money movement in the workspace into a common row
 * shape: invoice receipts, legacy project receipts, expenses and supplier
 * payments. Settings decide which optional sources are counted.
 */
export function useMoneyFlow() {
  const { all: invoicePayments, loading: l1 } = useInvoicePayments();
  const { payments: projectPayments, loading: l2 } = useProjectPayments();
  const { payments: supplierPayments, loading: l3 } = useSupplierPayments();
  const { expenses, loading: l4 } = useExpenses();
  const { all: invoices } = useInvoices();
  const { projects } = useProjects();
  const { clients } = useClientsData();
  const { suppliers } = useSuppliers();
  const { settings } = useInvoiceSettings();
  const { accounts, nameFor } = usePaymentAccounts();

  const includeProjectReceipts = settings?.include_project_payments_in_income !== false;
  const includeSupplierPayments = settings?.include_supplier_payments_in_accounts !== false;

  const invoiceById = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const clientById = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const supplierById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const accountName = (id: string | null | undefined) => (id ? nameFor(id) || "—" : "Unassigned");

  const income = useMemo<MoneyRow[]>(() => {
    const minDate = settings?.ledger_opening_date;
    const rows: MoneyRow[] = invoicePayments
      .filter((p) => {
        const inv = invoiceById.get(p.invoice_id);
        if (!inv || inv.status === "cancelled" || inv.status === "draft") return false;
        if (minDate && p.paid_on < minDate) return false;
        return true;
      })
      .map((p) => {
        const inv = invoiceById.get(p.invoice_id);
        const project = inv?.project_id ? projectById.get(inv.project_id) : undefined;
        return {
          id: `ip-${p.id}`,
          date: p.paid_on,
          direction: "in",
          source: "invoice",
          sourceLabel: "Invoice receipt",
          ref: p.receipt_no || inv?.invoice_no || "—",
          party: inv?.bill_to_name ?? "—",
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          accountId: p.account_id ?? null,
          accountName: accountName(p.account_id),
          mode: modeLabel(p.mode),
          note: p.note || p.reference_no || "",
          amount: p.amount,
        };
      });
    if (includeProjectReceipts) {
      for (const p of projectPayments) {
        if (minDate && p.paid_on < minDate) continue;
        const project = projectById.get(p.project_id);
        const client = project ? clientById.get(project.client_id) : undefined;
        rows.push({
          id: `pp-${p.id}`,
          date: p.paid_on,
          direction: "in",
          source: "project",
          sourceLabel: "Project receipt",
          ref: "—",
          party: client?.name ?? "—",
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          accountId: p.account_id ?? null,
          accountName: accountName(p.account_id),
          mode: modeLabel(p.mode),
          note: p.description ?? "",
          amount: p.amount,
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [invoicePayments, projectPayments, invoiceById, projectById, clientById, includeProjectReceipts, accounts, settings?.ledger_opening_date]);

  const outgoing = useMemo<MoneyRow[]>(() => {
    const minDate = settings?.ledger_opening_date;
    const rows: MoneyRow[] = expenses
      .filter((e) => !minDate || e.spent_on >= minDate)
      .map((e) => {
        const project = e.project_id ? projectById.get(e.project_id) : undefined;
        const client = e.client_id ? clientById.get(e.client_id) : undefined;
        return {
          id: `ex-${e.id}`,
          date: e.spent_on,
          direction: "out",
          source: "expense",
          sourceLabel: "Expense",
          ref: e.category || "—",
          party: client?.name || e.title,
          projectId: project?.id ?? null,
          projectName: project?.name ?? "",
          accountId: e.account_id ?? null,
          accountName: accountName(e.account_id),
          mode: modeLabel(e.mode),
          note: e.note || e.title,
          amount: e.amount,
        };
      });
    if (includeSupplierPayments) {
      for (const p of supplierPayments) {
        if (minDate && p.paid_on < minDate) continue;
        rows.push({
          id: `sp-${p.id}`,
          date: p.paid_on,
          direction: "out",
          source: "supplier",
          sourceLabel: "Supplier payment",
          ref: p.voucher_no || "—",
          party: supplierById.get(p.supplier_id)?.name ?? "—",
          projectId: null,
          projectName: "",
          accountId: p.account_id ?? null,
          accountName: accountName(p.account_id),
          mode: modeLabel(p.mode),
          note: p.note || p.reference_no || "",
          amount: p.amount,
        });
      }
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, supplierPayments, projectById, clientById, supplierById, includeSupplierPayments, accounts, settings?.ledger_opening_date]);

  return {
    income,
    outgoing,
    includeProjectReceipts,
    includeSupplierPayments,
    loading: l1 || l2 || l3 || l4,
  };
}

export interface AccountBalance {
  account: PaymentAccountRow;
  opening: number;
  received: number;
  spent: number;
  transferIn: number;
  transferOut: number;
  balance: number;
}

export interface AccountStatementLine {
  id: string;
  date: string;
  label: string;
  detail: string;
  inAmount: number;
  outAmount: number;
  balance: number;
}

/**
 * Cash / bank book: per-account balance from opening balance, receipts,
 * payments and transfers, plus a running statement for one account.
 */
export function useAccountBook() {
  const { accounts, loading: aLoading } = usePaymentAccounts();
  const { income, outgoing, loading: mLoading } = useMoneyFlow();
  const { transfers, loading: tLoading } = useAccountTransfers();
  const { settings } = useInvoiceSettings();

  const activeTransfers = useMemo(() => {
    const minDate = settings?.ledger_opening_date;
    return minDate ? transfers.filter((t) => t.transfer_date >= minDate) : transfers;
  }, [transfers, settings?.ledger_opening_date]);

  const balances = useMemo<AccountBalance[]>(
    () =>
      accounts.map((account) => {
        const received = income.filter((r) => r.accountId === account.id).reduce((s, r) => s + r.amount, 0);
        const spent = outgoing.filter((r) => r.accountId === account.id).reduce((s, r) => s + r.amount, 0);
        const transferIn = activeTransfers.filter((t) => t.to_account_id === account.id).reduce((s, t) => s + t.amount, 0);
        const transferOut = activeTransfers.filter((t) => t.from_account_id === account.id).reduce((s, t) => s + t.amount, 0);
        return {
          account,
          opening: account.opening_balance,
          received,
          spent,
          transferIn,
          transferOut,
          balance: account.opening_balance + received + transferIn - spent - transferOut,
        };
      }),
    [accounts, income, outgoing, activeTransfers],
  );

  const unassigned = useMemo(() => {
    const received = income.filter((r) => !r.accountId).reduce((s, r) => s + r.amount, 0);
    const spent = outgoing.filter((r) => !r.accountId).reduce((s, r) => s + r.amount, 0);
    return { received, spent, count: income.filter((r) => !r.accountId).length + outgoing.filter((r) => !r.accountId).length };
  }, [income, outgoing]);

  const statementFor = (accountId: string): AccountStatementLine[] => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return [];
    const lines: AccountStatementLine[] = [];
    if (account.opening_balance !== 0) {
      lines.push({
        id: "opening",
        date: account.opening_date ?? account.created_at.slice(0, 10),
        label: "Opening balance",
        detail: "",
        inAmount: account.opening_balance > 0 ? account.opening_balance : 0,
        outAmount: account.opening_balance < 0 ? -account.opening_balance : 0,
        balance: 0,
      });
    }
    for (const r of income.filter((x) => x.accountId === accountId)) {
      lines.push({ id: r.id, date: r.date, label: r.sourceLabel, detail: [r.ref, r.party].filter(Boolean).join(" · "), inAmount: r.amount, outAmount: 0, balance: 0 });
    }
    for (const r of outgoing.filter((x) => x.accountId === accountId)) {
      lines.push({ id: r.id, date: r.date, label: r.sourceLabel, detail: [r.ref, r.party].filter(Boolean).join(" · "), inAmount: 0, outAmount: r.amount, balance: 0 });
    }
    for (const t of activeTransfers) {
      const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
      if (t.to_account_id === accountId) {
        lines.push({ id: `tr-in-${t.id}`, date: t.transfer_date, label: "Transfer in", detail: `From ${nameOf(t.from_account_id)}`, inAmount: t.amount, outAmount: 0, balance: 0 });
      }
      if (t.from_account_id === accountId) {
        lines.push({ id: `tr-out-${t.id}`, date: t.transfer_date, label: "Transfer out", detail: `To ${nameOf(t.to_account_id)}`, inAmount: 0, outAmount: t.amount, balance: 0 });
      }
    }
    lines.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));
    let running = 0;
    for (const l of lines) {
      running += l.inAmount - l.outAmount;
      l.balance = running;
    }
    return lines;
  };

  const totalBalance = balances.reduce((s, b) => s + b.balance, 0);

  return { balances, unassigned, statementFor, totalBalance, transfers, loading: aLoading || mLoading || tLoading };
}
