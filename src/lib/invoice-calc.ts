import { todayLocalDate } from "./format";

export interface LineItemInput {
  description: string;
  hsn_sac: string;
  unit: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  gst_percent: number;
  /** Optional link to a stock item, so the line can be billed from stock. */
  item_id?: string | null;
}


export interface LineItemComputed extends LineItemInput {
  taxable_amount: number;
  tax_amount: number;
  line_total: number;
}

export interface DocumentTotals {
  subtotal: number;
  discount_total: number;
  taxable_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  tax_total: number;
  round_off: number;
  grand_total: number;
}

export interface TaxGroupRow {
  gst_percent: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
}

const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

export function computeLine(item: LineItemInput): LineItemComputed {
  const discountPct = Math.min(100, Math.max(0, item.discount_percent || 0));
  const gross = r2((item.quantity || 0) * (item.rate || 0));
  const discount = r2((gross * discountPct) / 100);
  const taxable = r2(gross - discount);
  const tax = r2((taxable * (item.gst_percent || 0)) / 100);
  return { ...item, discount_percent: discountPct, taxable_amount: taxable, tax_amount: tax, line_total: r2(taxable + tax) };
}

export function computeDocument(
  items: LineItemInput[],
  opts: { isInterstate: boolean; roundOff?: boolean },
): { lines: LineItemComputed[]; totals: DocumentTotals; taxGroups: TaxGroupRow[] } {
  const lines = items.map(computeLine);
  let subtotal = 0;
  let discount_total = 0;
  let taxable_total = 0;
  let tax_total = 0;
  for (const l of lines) {
    const gross = r2((l.quantity || 0) * (l.rate || 0));
    subtotal = r2(subtotal + gross);
    discount_total = r2(discount_total + r2(gross - l.taxable_amount));
    taxable_total = r2(taxable_total + l.taxable_amount);
    tax_total = r2(tax_total + l.tax_amount);
  }

  const groupMap = new Map<number, TaxGroupRow>();
  for (const l of lines) {
    const key = Number(l.gst_percent || 0);
    const g = groupMap.get(key) ?? { gst_percent: key, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    g.taxable = r2(g.taxable + l.taxable_amount);
    if (opts.isInterstate) {
      g.igst = r2(g.igst + l.tax_amount);
    } else {
      const half = r2(l.tax_amount / 2);
      g.cgst = r2(g.cgst + half);
      g.sgst = r2(g.sgst + r2(l.tax_amount - half));
    }
    groupMap.set(key, g);
  }
  const taxGroups = Array.from(groupMap.values()).sort((a, b) => a.gst_percent - b.gst_percent);

  const cgst_total = opts.isInterstate ? 0 : r2(taxGroups.reduce((s, g) => s + g.cgst, 0));
  const sgst_total = opts.isInterstate ? 0 : r2(taxGroups.reduce((s, g) => s + g.sgst, 0));
  const igst_total = opts.isInterstate ? r2(taxGroups.reduce((s, g) => s + g.igst, 0)) : 0;

  const beforeRound = r2(taxable_total + tax_total);
  const rounded = opts.roundOff === false ? beforeRound : Math.round(beforeRound);
  const round_off = r2(rounded - beforeRound);

  return {
    lines,
    totals: {
      subtotal,
      discount_total,
      taxable_total,
      cgst_total,
      sgst_total,
      igst_total,
      tax_total,
      round_off,
      grand_total: r2(rounded),
    },
    taxGroups,
  };
}

// ---------------- Amount in words (Indian numbering) ----------------
const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ` ${ONES[o]}` : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", rest ? twoDigits(rest) : ""].filter(Boolean).join(" ");
}

function indianWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${indianWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/** "One Thousand Two Hundred Rupees and Fifty Paise Only" */
export function amountInWords(value: number): string {
  const safe = Math.max(0, Math.round((Number.isFinite(value) ? value : 0) * 100) / 100);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  const main = `${indianWords(rupees)} Rupee${rupees === 1 ? "" : "s"}`;
  return paise > 0 ? `${main} and ${twoDigits(paise)} Paise Only` : `${main} Only`;
}

export const DOC_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:      { label: "Draft",      cls: "bg-muted text-muted-foreground border-border" },
  sent:       { label: "Sent",       cls: "bg-info/20 text-info border-info/30" },
  accepted:   { label: "Accepted",   cls: "bg-success/20 text-success border-success/30" },
  rejected:   { label: "Rejected",   cls: "bg-destructive/20 text-destructive border-destructive/30" },
  expired:    { label: "Expired",    cls: "bg-warning/20 text-warning border-warning/30" },
  cancelled:  { label: "Cancelled",  cls: "bg-destructive/20 text-destructive border-destructive/30" },
  paid:       { label: "Paid",       cls: "bg-success/20 text-success border-success/30" },
  partly_paid:{ label: "Partly Paid",cls: "bg-warning/20 text-warning border-warning/30" },
  overdue:    { label: "Overdue",    cls: "bg-destructive/20 text-destructive border-destructive/30" },
  unpaid:     { label: "Unpaid",     cls: "bg-muted text-muted-foreground border-border" },
};

/** Derived invoice status combining stored status, payments and due date. */
export function invoiceDisplayStatus(
  status: string,
  grandTotal: number,
  paid: number,
  dueDate: string | null,
  timezone = "Asia/Kolkata",
): keyof typeof DOC_STATUS_META {
  if (status === "cancelled") return "cancelled";
  if (status === "draft") return "draft";
  if (grandTotal > 0 && paid >= grandTotal - 0.01) return "paid";
  const today = todayLocalDate(timezone);
  const isOverdue = Boolean(dueDate && dueDate < today);
  if (isOverdue) return "overdue";
  if (paid > 0) return "partly_paid";
  return "sent";
}
