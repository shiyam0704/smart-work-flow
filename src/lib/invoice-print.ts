import { amountInWords, computeDocument, type LineItemComputed, type TaxGroupRow, type DocumentTotals } from "@/lib/invoice-calc";
import { formatDate } from "@/lib/format";

export interface PrintBrand {
  companyName: string;
  logoUrl?: string | null;
  legalName?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  stateName?: string;
  stateCode?: string;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  upiId?: string;
  signatureUrl?: string;
  footerNote?: string;
}

export type PaperSize = "A4" | "A5";
export type PrintTemplate = "classic" | "modern" | "compact";

export interface PrintOptions {
  paperSize: PaperSize;
  template: PrintTemplate;
  accentColor: string;
  rowsFirstPage: number;
  rowsNextPage: number;
  repeatTableHeader: boolean;
  repeatBrandHeader: boolean;
  showPageNumbers: boolean;
  showContinuedMarker: boolean;
}

export const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  paperSize: "A4",
  template: "classic",
  accentColor: "#1f4f82",
  rowsFirstPage: 12,
  rowsNextPage: 18,
  repeatTableHeader: true,
  repeatBrandHeader: false,
  showPageNumbers: true,
  showContinuedMarker: true,
};

export interface PrintDocument {
  kind: "Quotation" | "Tax Invoice" | "Purchase Order";
  number: string;
  date: string;
  secondaryLabel?: string;
  secondaryValue?: string;
  title?: string;
  billToName: string;
  billToAddress: string;
  billToGstin?: string;
  billToContactPerson?: string;
  billToContactNumber?: string;
  placeOfSupply?: string;
  isInterstate: boolean;
  items: LineItemComputed[];
  totals: DocumentTotals;
  taxGroups: TaxGroupRow[];
  notes?: string;
  terms?: string;
  paidAmount?: number;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  );

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number.isFinite(n) ? n : 0,
  );

/* ------------------------------------------------------------------ styling */

function baseCss(o: PrintOptions): string {
  const a5 = o.paperSize === "A5";
  const compact = o.template === "compact";
  const fs = compact ? (a5 ? 9 : 10.5) : a5 ? 10 : 12;
  const pad = a5 ? 16 : 26;
  const sheetWidth = a5 ? "560px" : "820px";
  return `
  *{box-sizing:border-box}
  html,body{margin:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#111;padding:${pad}px;font-size:${fs}px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{max-width:${sheetWidth};margin:0 auto}
  .page{position:relative}
  .page + .page{page-break-before:always;break-before:page;padding-top:${a5 ? 8 : 12}px}
  .row{display:flex;justify-content:space-between;gap:${a5 ? 12 : 24}px}
  .brand{display:flex;gap:10px;align-items:flex-start}
  .brand img{width:${a5 ? 42 : 56}px;height:${a5 ? 42 : 56}px;object-fit:contain;background:#fff}
  h1{font-size:${a5 ? 14 : 18}px;margin:0 0 2px}
  h2{font-size:${a5 ? 12 : 14}px;margin:0;text-transform:uppercase;letter-spacing:.08em}
  .muted{color:#6b7280}
  .meta{text-align:right}
  .meta div{margin-bottom:2px}
  hr{border:0;border-top:1px solid #e5e7eb;margin:${compact ? 8 : 14}px 0}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{padding:${compact ? "3px 5px" : a5 ? "4px 6px" : "6px 8px"};text-align:left;vertical-align:top}
  th{font-size:${Math.max(8, fs - 1)}px;text-transform:uppercase;letter-spacing:.04em}
  td.num,th.num{text-align:right;white-space:nowrap}
  tr,td,th{break-inside:avoid;page-break-inside:avoid}
  .totals{width:auto;min-width:${a5 ? 220 : 280}px;margin-left:auto}
  .totals td{border:0;padding:2px 0}
  .totals td.num{padding-left:${a5 ? 14 : 24}px}
  .grand td{border-top:1px solid #111;font-weight:700;font-size:${fs + 1}px;padding-top:5px}
  .box{border:1px solid #e5e7eb;border-radius:8px;padding:${compact ? 7 : 10}px;flex:1}
  .cols{display:flex;gap:10px;margin-top:${compact ? 8 : 14}px}
  .keep{break-inside:avoid;page-break-inside:avoid}
  .sign{text-align:right;margin-top:${a5 ? 16 : 26}px}
  .sign img{height:${a5 ? 40 : 52}px;object-fit:contain}
  .pre{white-space:pre-wrap}
  .footer{margin-top:${a5 ? 12 : 18}px;text-align:center;font-size:${Math.max(8, fs - 1)}px}
  .contd{margin-top:8px;text-align:right;font-style:italic}
  .pageno{margin-top:8px;text-align:center;font-size:${Math.max(8, fs - 1)}px;color:#6b7280}
  .contstrip{display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:6px;font-weight:600}
  @media print{body{padding:0}@page{size:${o.paperSize} portrait;margin:${a5 ? "8mm" : "13mm"}}}
`;
}

function templateCss(o: PrintOptions): string {
  const accent = o.accentColor || DEFAULT_PRINT_OPTIONS.accentColor;
  if (o.template === "modern") {
    return `
    body{font-family:"Segoe UI",Helvetica,Arial,sans-serif}
    .bar{background:${accent};color:#fff;padding:10px 12px;border-radius:10px;margin-bottom:12px}
    .bar h1,.bar h2,.bar .muted{color:#fff}
    .bar .muted{opacity:.85}
    h2{color:${accent}}
    th{background:${accent};color:#fff;border:0}
    td{border:0;border-bottom:1px solid #eef2f7}
    tbody tr:nth-child(even) td{background:#f7fafc}
    .box{border:1px solid #e8eef5;background:#fbfdff}
    .grand td{border-top:2px solid ${accent};color:${accent}}
    hr{border-top:2px solid ${accent}}
  `;
  }
  if (o.template === "compact") {
    return `
    body{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif}
    h2{color:#111}
    th{background:#f3f4f6;border:1px solid #d1d5db}
    td{border:1px solid #e5e7eb}
    .box{border:1px solid #e5e7eb;border-radius:4px}
  `;
  }
  return `
    h1{font-family:Georgia,"Times New Roman",serif}
    h2{font-family:Georgia,"Times New Roman",serif;color:#111}
    th{background:#f9fafb;border:1px solid #cbd5e1}
    td{border:1px solid #e5e7eb}
    hr{border-top:1px solid #111}
  `;
}

/* ------------------------------------------------------------------ blocks */

function brandBlock(b: PrintBrand): string {
  const lines = [
    b.address,
    [b.stateName, b.stateCode ? `Code: ${b.stateCode}` : ""].filter(Boolean).join(" · "),
    [b.phone, b.email].filter(Boolean).join(" · "),
    b.gstin ? `GSTIN: ${b.gstin}` : "",
    b.pan ? `PAN: ${b.pan}` : "",
  ]
    .filter(Boolean)
    .map((l) => `<div class="muted">${esc(l)}</div>`)
    .join("");
  return `<div class="brand">
    ${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="${esc(b.companyName)}" />` : ""}
    <div>
      <h1>${esc(b.legalName || b.companyName)}</h1>
      ${lines}
    </div>
  </div>`;
}

function headerRow(inner: string, o: PrintOptions): string {
  return o.template === "modern" ? `<div class="bar"><div class="row">${inner}</div></div>` : `<div class="row">${inner}</div>${sepRule(o)}`;
}

const sepRule = (o: PrintOptions) => (o.template === "compact" ? "" : "<hr />");

function docMeta(d: PrintDocument): string {
  return `<div class="meta">
    <h2>${esc(d.kind)}</h2>
    <div><strong>${esc(d.number)}</strong></div>
    <div class="muted">Date: ${esc(formatDate(d.date, "d MMM yyyy"))}</div>
    ${d.secondaryValue ? `<div class="muted">${esc(d.secondaryLabel)}: ${esc(formatDate(d.secondaryValue, "d MMM yyyy"))}</div>` : ""}
    ${d.placeOfSupply ? `<div class="muted">Place of Supply: ${esc(d.placeOfSupply)}</div>` : ""}
  </div>`;
}

function tableHead(): string {
  return `<thead><tr>
      <th class="num">#</th><th>Description</th><th class="num">Qty</th><th class="num">Rate</th>
      <th class="num">Disc</th><th class="num">Taxable</th><th class="num">GST</th><th class="num">Amount</th>
    </tr></thead>`;
}

function itemRows(items: LineItemComputed[], startIndex: number): string {
  return items
    .map(
      (it, i) => `<tr>
      <td class="num">${startIndex + i + 1}</td>
      <td>${esc(it.description)}${it.hsn_sac ? `<div class="muted">HSN/SAC: ${esc(it.hsn_sac)}</div>` : ""}</td>
      <td class="num">${money(it.quantity)}${it.unit ? ` ${esc(it.unit)}` : ""}</td>
      <td class="num">${money(it.rate)}</td>
      <td class="num">${it.discount_percent ? `${money(it.discount_percent)}%` : "-"}</td>
      <td class="num">${money(it.taxable_amount)}</td>
      <td class="num">${money(it.gst_percent)}%</td>
      <td class="num">${money(it.line_total)}</td>
    </tr>`,
    )
    .join("");
}

function itemsTable(items: LineItemComputed[], startIndex: number, withHead: boolean): string {
  const rows = itemRows(items, startIndex);
  return `<table>
    ${withHead ? tableHead() : ""}
    <tbody>${rows || `<tr><td colspan="8" class="muted">No items</td></tr>`}</tbody>
  </table>`;
}

function taxSummary(d: PrintDocument): string {
  if (!d.taxGroups.length) return "";
  const rows = d.taxGroups
    .map(
      (g) => `<tr>
      <td class="num">${money(g.gst_percent)}%</td>
      <td class="num">${money(g.taxable)}</td>
      ${d.isInterstate ? `<td class="num">${money(g.igst)}</td>` : `<td class="num">${money(g.cgst)}</td><td class="num">${money(g.sgst)}</td>`}
    </tr>`,
    )
    .join("");
  return `<table>
    <thead><tr><th class="num">Rate</th><th class="num">Taxable Value</th>
    ${d.isInterstate ? `<th class="num">IGST</th>` : `<th class="num">CGST</th><th class="num">SGST</th>`}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totalsTable(d: PrintDocument): string {
  const t = d.totals;
  const line = (label: string, value: number) =>
    `<tr><td class="muted">${esc(label)}</td><td class="num">${money(value)}</td></tr>`;
  const balance =
    d.paidAmount === undefined ? "" :
    `${line("Amount Paid", d.paidAmount)}<tr class="grand"><td>Balance Due</td><td class="num">₹ ${money(t.grand_total - d.paidAmount)}</td></tr>`;
  return `<table class="totals">
    ${line("Subtotal", t.subtotal)}
    ${t.discount_total ? line("Discount", t.discount_total) : ""}
    ${line("Taxable Value", t.taxable_total)}
    ${d.isInterstate ? line("IGST", t.igst_total) : line("CGST", t.cgst_total) + line("SGST", t.sgst_total)}
    ${t.round_off ? line("Round Off", t.round_off) : ""}
    <tr class="grand"><td>Grand Total</td><td class="num">₹ ${money(t.grand_total)}</td></tr>
    ${balance}
  </table>`;
}

function bankBox(b: PrintBrand): string {
  const items = [
    b.bankName ? `Bank: ${b.bankName}` : "",
    b.bankAccountName ? `Account Name: ${b.bankAccountName}` : "",
    b.bankAccountNo ? `A/c No: ${b.bankAccountNo}` : "",
    b.bankIfsc ? `IFSC: ${b.bankIfsc}` : "",
    b.upiId ? `UPI: ${b.upiId}` : "",
  ].filter(Boolean);
  if (!items.length) return "";
  return `<div class="box"><strong>Payment Details</strong>${items.map((i) => `<div class="muted">${esc(i)}</div>`).join("")}</div>`;
}

function signBlock(b: PrintBrand): string {
  return `<div class="sign keep">
      ${b.signatureUrl ? `<div><img src="${esc(b.signatureUrl)}" alt="Signature" /></div>` : `<div style="height:52px"></div>`}
      <div class="muted">For ${esc(b.legalName || b.companyName)}</div>
      <div class="muted">Authorised Signatory</div>
    </div>`;
}

function chunkItems(items: LineItemComputed[], o: PrintOptions): LineItemComputed[][] {
  const first = Math.max(1, Math.floor(o.rowsFirstPage) || 1);
  const next = Math.max(1, Math.floor(o.rowsNextPage) || 1);
  if (!items.length) return [[]];
  const pages: LineItemComputed[][] = [items.slice(0, first)];
  let i = first;
  while (i < items.length) {
    pages.push(items.slice(i, i + next));
    i += next;
  }
  return pages;
}

/* ------------------------------------------------------------------ builders */

export function buildDocumentHtml(
  doc: PrintDocument,
  brand: PrintBrand,
  options: Partial<PrintOptions> = {},
): string {
  const o: PrintOptions = { ...DEFAULT_PRINT_OPTIONS, ...options };
  const chunks = chunkItems(doc.items, o);
  const total = chunks.length;

  const pageNo = (n: number) =>
    o.showPageNumbers && total > 1 ? `<div class="pageno">Page ${n} of ${total}</div>` : "";
  const contd = (n: number) =>
    o.showContinuedMarker && n < total ? `<div class="contd muted">Continued on page ${n + 1}…</div>` : "";
  const contHeader = () =>
    o.repeatBrandHeader
      ? headerRow(`${brandBlock(brand)}${docMeta(doc)}`, o)
      : `<div class="contstrip"><span>${esc(doc.kind)} ${esc(doc.number)} — continued</span><span class="muted">${esc(formatDate(doc.date, "d MMM yyyy"))}</span></div>`;

  const pages = chunks.map((chunk, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === total - 1;
    const startIndex = isFirst ? 0 : Math.max(1, Math.floor(o.rowsFirstPage) || 1) + (idx - 1) * Math.max(1, Math.floor(o.rowsNextPage) || 1);
    const head = isFirst
      ? `${headerRow(`${brandBlock(brand)}${docMeta(doc)}`, o)}
    <div class="cols">
      <div class="box">
        <strong>Bill To</strong>
        <div>${esc(doc.billToName)}</div>
        <div class="muted pre">${esc(doc.billToAddress)}</div>
        ${doc.billToContactPerson ? `<div class="muted">Contact: ${esc(doc.billToContactPerson)}</div>` : ""}
        ${doc.billToContactNumber ? `<div class="muted">Phone: ${esc(doc.billToContactNumber)}</div>` : ""}
        ${doc.billToGstin ? `<div class="muted">GSTIN: ${esc(doc.billToGstin)}</div>` : ""}
      </div>
      ${doc.title ? `<div class="box"><strong>Subject</strong><div class="muted pre">${esc(doc.title)}</div></div>` : ""}
    </div>`
      : contHeader();

    const tail = isLast
      ? `<div class="keep">
      ${totalsTable(doc)}
      <div class="muted" style="margin-top:6px">Amount in words: <strong>${esc(amountInWords(doc.totals.grand_total))}</strong></div>
    </div>
    <div class="cols keep">${taxSummary(doc) ? `<div class="box"><strong>Tax Summary</strong>${taxSummary(doc)}</div>` : ""}${bankBox(brand)}</div>
    <div class="cols keep">
      ${doc.notes ? `<div class="box"><strong>Notes</strong><div class="muted pre">${esc(doc.notes)}</div></div>` : ""}
      ${doc.terms ? `<div class="box"><strong>Terms &amp; Conditions</strong><div class="muted pre">${esc(doc.terms)}</div></div>` : ""}
    </div>
    ${signBlock(brand)}
    ${brand.footerNote ? `<div class="footer muted pre">${esc(brand.footerNote)}</div>` : ""}`
      : contd(idx + 1);

    return `<div class="page">
      ${head}
      ${itemsTable(chunk, startIndex, isFirst || o.repeatTableHeader)}
      ${tail}
      ${pageNo(idx + 1)}
    </div>`;
  });

  return `<!doctype html><html><head><meta charset="utf-8" />
  <title>${esc(doc.kind)} ${esc(doc.number)}</title>
  <style>${baseCss(o)}${templateCss(o)}</style></head>
  <body><div class="sheet">${pages.join("")}</div></body></html>`;
}

export interface PrintReceipt {
  receiptNo: string;
  paidOn: string;
  amount: number;
  mode: string;
  referenceNo?: string;
  note?: string;
  receivedFrom: string;
  invoiceNo: string;
  invoiceTotal: number;
  paidTillNow: number;
  /** Optional label overrides so the same layout serves supplier payment vouchers. */
  headingLabel?: string;
  partyLabel?: string;
  refLabel?: string;
  totalLabel?: string;
  paidLabel?: string;
  balanceLabel?: string;
  hideTotals?: boolean;
}

export function buildReceiptHtml(
  r: PrintReceipt,
  brand: PrintBrand,
  options: Partial<PrintOptions> = {},
): string {
  const o: PrintOptions = { ...DEFAULT_PRINT_OPTIONS, ...options };
  const line = (l: string, v: string) =>
    `<tr><td class="muted" style="width:${o.paperSize === "A5" ? 130 : 180}px">${esc(l)}</td><td><strong>${esc(v)}</strong></td></tr>`;
  const meta = `<div class="meta">
        <h2>${esc(r.headingLabel ?? "Payment Receipt")}</h2>
        <div><strong>${esc(r.receiptNo)}</strong></div>
        <div class="muted">Date: ${esc(formatDate(r.paidOn, "d MMM yyyy"))}</div>
      </div>`;
  return `<!doctype html><html><head><meta charset="utf-8" />
  <title>Receipt ${esc(r.receiptNo)}</title>
  <style>${baseCss(o)}${templateCss(o)}</style></head>
  <body><div class="sheet"><div class="page">
    ${headerRow(`${brandBlock(brand)}${meta}`, o)}
    <table>
      ${line(r.partyLabel ?? "Received From", r.receivedFrom)}
      ${r.invoiceNo ? line(r.refLabel ?? "Against Invoice", r.invoiceNo) : ""}
      ${line("Amount Received", `₹ ${money(r.amount)}`)}
      ${line("Payment Mode", r.mode)}
      ${r.referenceNo ? line("Reference", r.referenceNo) : ""}
      ${r.hideTotals ? "" : line(r.totalLabel ?? "Invoice Total", `₹ ${money(r.invoiceTotal)}`)}
      ${r.hideTotals ? "" : line(r.paidLabel ?? "Total Paid", `₹ ${money(r.paidTillNow)}`)}
      ${r.hideTotals ? "" : line(r.balanceLabel ?? "Balance Due", `₹ ${money(r.invoiceTotal - r.paidTillNow)}`)}
      ${r.note ? line("Note", r.note) : ""}
    </table>
    <div class="muted" style="margin-top:8px">Amount in words: <strong>${esc(amountInWords(r.amount))}</strong></div>
    ${bankBox(brand) ? `<div class="cols keep">${bankBox(brand)}</div>` : ""}
    ${signBlock(brand)}
    ${brand.footerNote ? `<div class="footer muted pre">${esc(brand.footerNote)}</div>` : ""}
  </div></div></body></html>`;
}

/** Opens a print-ready window with the given HTML. */
export function printHtml(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}

/** Recomputes stored items so print always reflects consistent maths. */
export function recompute(items: LineItemComputed[], isInterstate: boolean) {
  return computeDocument(items, { isInterstate });
}
