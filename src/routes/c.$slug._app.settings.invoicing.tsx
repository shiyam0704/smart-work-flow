import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RoleGuard } from "@/components/app/RoleGuard";
import { cn } from "@/lib/utils";
import { usePrintBrand } from "@/hooks/use-print-brand";
import {
  buildDocumentHtml,
  printHtml,
  DEFAULT_PRINT_OPTIONS,
  type PaperSize,
  type PrintTemplate,
  type PrintOptions,
} from "@/lib/invoice-print";
import { computeDocument } from "@/lib/invoice-calc";
import {
  useInvoiceSettings,
  useNumberSeries,
  useTaxRates,
  useUnits,
  type InvoiceSettingsRow,
  type NumberSeriesRow,
} from "@/hooks/use-invoice-settings";

export const Route = createFileRoute("/c/$slug/_app/settings/invoicing")({
  component: () => (
    <RoleGuard allow={[]} permission="settings.invoicing">
      <InvoicingSettings />
    </RoleGuard>
  ),
  head: () => ({
    meta: [
      { title: "Invoicing Settings — Smart Work Flow" },
      { name: "description", content: "Configure tax details, number series, terms and bank details for quotations and invoices." },
      { property: "og:title", content: "Invoicing Settings — Smart Work Flow" },
      { property: "og:description", content: "Configure tax details, number series, terms and bank details." },
    ],
  }),
});

type Draft = Partial<InvoiceSettingsRow>;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-glass-border px-3 py-2">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

const TEMPLATES: { key: PrintTemplate; label: string; hint: string }[] = [
  { key: "classic", label: "Classic", hint: "Bordered table, serif headings, formal GST layout." },
  { key: "modern", label: "Modern", hint: "Accent colour band, zebra rows, airy spacing." },
  { key: "compact", label: "Compact", hint: "Tight rows, fits more items per page." },
];

function TemplateThumb({ template, accent }: { template: PrintTemplate; accent: string }) {
  const bar =
    template === "modern"
      ? { background: accent }
      : template === "compact"
        ? { background: "hsl(var(--muted-foreground) / 0.35)" }
        : { background: "hsl(var(--foreground) / 0.7)" };
  const rowCount = template === "compact" ? 7 : 4;
  return (
    <div className="rounded-lg border border-glass-border bg-background/60 p-2 aspect-[1/1.25] flex flex-col gap-1.5">
      <div className="h-3 rounded-sm" style={bar} />
      <div className="flex gap-1">
        <div className="h-2 flex-1 rounded-sm bg-muted" />
        <div className="h-2 w-1/3 rounded-sm bg-muted" />
      </div>
      <div className="flex-1 space-y-1 pt-0.5">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-sm",
              template === "compact" ? "h-1" : "h-1.5",
              template === "modern" && i % 2 === 0 ? "bg-muted/60" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="ml-auto h-2 w-1/2 rounded-sm bg-muted" />
    </div>
  );
}

function InvoicingSettings() {
  const { settings, loading, save } = useInvoiceSettings();
  const { series, saveSeries } = useNumberSeries();
  const { rates, addRate, removeRate } = useTaxRates();
  const { units, addUnit, removeUnit } = useUnits();
  const { brand } = usePrintBrand();

  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [sameReceipt, setSameReceipt] = useState(true);
  const [newRate, setNewRate] = useState({ label: "", percent: "" });
  const [newUnit, setNewUnit] = useState("");

  useEffect(() => {
    setD(settings ?? {});
    if (settings) setSameReceipt((settings.receipt_paper_size ?? "A4") === (settings.paper_size ?? "A4"));
  }, [settings]);

  const set = (p: Draft) => setD((prev) => ({ ...prev, ...p }));
  const str = (k: keyof InvoiceSettingsRow) => (d[k] as string) ?? "";

  async function handleSave() {
    setSaving(true);
    await save({
      legal_name: str("legal_name"),
      gstin: str("gstin"),
      pan: str("pan"),
      registered_address: str("registered_address"),
      state_name: str("state_name"),
      state_code: str("state_code"),
      email: str("email"),
      phone: str("phone"),
      bank_name: str("bank_name"),
      bank_account_name: str("bank_account_name"),
      bank_account_no: str("bank_account_no"),
      bank_ifsc: str("bank_ifsc"),
      upi_id: str("upi_id"),
      default_quotation_terms: str("default_quotation_terms"),
      default_invoice_terms: str("default_invoice_terms"),
      footer_note: str("footer_note"),
      signature_url: str("signature_url"),
      default_gst_percent: Number(d.default_gst_percent ?? 18),
      quotation_validity_days: Number(d.quotation_validity_days ?? 15),
      invoice_due_days: Number(d.invoice_due_days ?? 15),
      round_off_enabled: d.round_off_enabled !== false,
      paper_size: (d.paper_size ?? "A4") as PaperSize,
      receipt_paper_size: (d.receipt_paper_size ?? d.paper_size ?? "A4") as PaperSize,
      print_template: (d.print_template ?? "classic") as PrintTemplate,
      print_accent_color: d.print_accent_color || DEFAULT_PRINT_OPTIONS.accentColor,
      rows_first_page: Math.max(1, Number(d.rows_first_page ?? 12)),
      rows_next_page: Math.max(1, Number(d.rows_next_page ?? 18)),
      repeat_table_header: d.repeat_table_header !== false,
      repeat_brand_header: d.repeat_brand_header === true,
      show_page_numbers: d.show_page_numbers !== false,
      show_continued_marker: d.show_continued_marker !== false,
      require_project_on_invoice: d.require_project_on_invoice === true,
      include_supplier_payments_in_accounts: d.include_supplier_payments_in_accounts !== false,
      include_project_payments_in_income: d.include_project_payments_in_income !== false,
      ledger_opening_date: (d.ledger_opening_date as string) || null,

    });
    setSaving(false);
  }

  const draftPrintOptions = (): PrintOptions => ({
    paperSize: (d.paper_size ?? "A4") as PaperSize,
    template: (d.print_template ?? "classic") as PrintTemplate,
    accentColor: d.print_accent_color || DEFAULT_PRINT_OPTIONS.accentColor,
    rowsFirstPage: Math.max(1, Number(d.rows_first_page ?? 12)),
    rowsNextPage: Math.max(1, Number(d.rows_next_page ?? 18)),
    repeatTableHeader: d.repeat_table_header !== false,
    repeatBrandHeader: d.repeat_brand_header === true,
    showPageNumbers: d.show_page_numbers !== false,
    showContinuedMarker: d.show_continued_marker !== false,
  });

  function handlePreview() {
    const o = draftPrintOptions();
    const gst = Number(d.default_gst_percent ?? 18);
    const raw = Array.from({ length: o.rowsFirstPage + 3 }, (_, i) => ({
      description: `Sample line item ${i + 1}`,
      hsn_sac: "998314",
      unit: "Nos",
      quantity: 1 + (i % 3),
      rate: 1200 + i * 150,
      discount_percent: i % 4 === 0 ? 5 : 0,
      gst_percent: gst,
    }));
    const { lines, totals, taxGroups } = computeDocument(raw as any, {
      isInterstate: false,
      roundOff: d.round_off_enabled !== false,
    });
    const html = buildDocumentHtml(
      {
        kind: "Tax Invoice",
        number: "PREVIEW-0001",
        date: new Date().toISOString().slice(0, 10),
        secondaryLabel: "Due",
        secondaryValue: new Date().toISOString().slice(0, 10),
        title: "Sample document — print format preview",
        billToName: "Sample Client Pvt Ltd",
        billToAddress: "12, Sample Street\nChennai 600001",
        billToGstin: "33AAAAA0000A1Z5",
        placeOfSupply: str("state_name") || "Tamil Nadu",
        isInterstate: false,
        items: lines,
        totals,
        taxGroups,
        notes: "This is a preview generated from your current print settings.",
        terms: str("default_invoice_terms"),
      },
      brand,
      o,
    );
    if (!printHtml(html)) toast.error("Allow pop-ups to preview the print format");
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading invoicing settings…</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <Section title="Business & tax details" description="Printed at the top of every quotation and invoice.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Legal name"><Input value={str("legal_name")} onChange={(e) => set({ legal_name: e.target.value })} /></Field>
          <Field label="GSTIN"><Input value={str("gstin")} onChange={(e) => set({ gstin: e.target.value })} /></Field>
          <Field label="PAN"><Input value={str("pan")} onChange={(e) => set({ pan: e.target.value })} /></Field>
          <Field label="Phone"><Input value={str("phone")} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={str("email")} onChange={(e) => set({ email: e.target.value })} /></Field>
          <Field label="State"><Input value={str("state_name")} onChange={(e) => set({ state_name: e.target.value })} /></Field>
          <Field label="State code"><Input value={str("state_code")} onChange={(e) => set({ state_code: e.target.value })} /></Field>
          <div className="md:col-span-2">
            <Field label="Registered address">
              <Textarea rows={3} value={str("registered_address")} onChange={(e) => set({ registered_address: e.target.value })} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Bank & payment details" description="Shown in the payment details block of documents.">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Bank name"><Input value={str("bank_name")} onChange={(e) => set({ bank_name: e.target.value })} /></Field>
          <Field label="Account name"><Input value={str("bank_account_name")} onChange={(e) => set({ bank_account_name: e.target.value })} /></Field>
          <Field label="Account number"><Input value={str("bank_account_no")} onChange={(e) => set({ bank_account_no: e.target.value })} /></Field>
          <Field label="IFSC"><Input value={str("bank_ifsc")} onChange={(e) => set({ bank_ifsc: e.target.value })} /></Field>
          <Field label="UPI ID"><Input value={str("upi_id")} onChange={(e) => set({ upi_id: e.target.value })} /></Field>
          <Field label="Signature image URL"><Input value={str("signature_url")} onChange={(e) => set({ signature_url: e.target.value })} placeholder="https://…" /></Field>
        </div>
      </Section>

      <Section title="Accounts & project linking" description="How invoices connect to projects and what the Accounts pages count.">
        <div className="flex items-center justify-between rounded-xl border border-glass-border px-3 py-2">
          <div>
            <Label>Always link an invoice to a project</Label>
            <p className="text-xs text-muted-foreground">When off, an invoice can be raised without choosing a project.</p>
          </div>
          <Switch checked={d.require_project_on_invoice === true} onCheckedChange={(c) => set({ require_project_on_invoice: c })} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-glass-border px-3 py-2">
          <div>
            <Label>Count project receipts as income</Label>
            <p className="text-xs text-muted-foreground">Includes payments recorded directly against a project, not only invoice receipts.</p>
          </div>
          <Switch checked={d.include_project_payments_in_income !== false} onCheckedChange={(c) => set({ include_project_payments_in_income: c })} />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-glass-border px-3 py-2">
          <div>
            <Label>Count supplier payments as money out</Label>
            <p className="text-xs text-muted-foreground">Shows purchase payments alongside expenses in Accounts.</p>
          </div>
          <Switch checked={d.include_supplier_payments_in_accounts !== false} onCheckedChange={(c) => set({ include_supplier_payments_in_accounts: c })} />
        </div>
      </Section>

      <Section title="Defaults" description="Applied when creating new quotations and invoices.">

        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Default GST %">
            <Input type="number" min={0} step="any" value={String(d.default_gst_percent ?? 18)} onChange={(e) => set({ default_gst_percent: Number(e.target.value) })} />
          </Field>
          <Field label="Quotation validity (days)">
            <Input type="number" min={0} value={String(d.quotation_validity_days ?? 15)} onChange={(e) => set({ quotation_validity_days: Number(e.target.value) })} />
          </Field>
          <Field label="Invoice due (days)">
            <Input type="number" min={0} value={String(d.invoice_due_days ?? 15)} onChange={(e) => set({ invoice_due_days: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-glass-border px-3 py-2">
          <div>
            <Label>Round off grand total</Label>
            <p className="text-xs text-muted-foreground">Rounds the final amount to the nearest rupee.</p>
          </div>
          <Switch checked={d.round_off_enabled !== false} onCheckedChange={(c) => set({ round_off_enabled: c })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Default quotation terms">
            <Textarea rows={4} value={str("default_quotation_terms")} onChange={(e) => set({ default_quotation_terms: e.target.value })} />
          </Field>
          <Field label="Default invoice terms">
            <Textarea rows={4} value={str("default_invoice_terms")} onChange={(e) => set({ default_invoice_terms: e.target.value })} />
          </Field>
        </div>
        <Field label="Document footer note">
          <Textarea rows={2} value={str("footer_note")} onChange={(e) => set({ footer_note: e.target.value })} />
        </Field>
      </Section>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <Section title="Print & paper" description="Paper size, document template and multi-page behaviour for quotations, invoices and receipts.">
        <div className="space-y-2">
          <Label>Paper size</Label>
          <div className="flex gap-2">
            {(["A4", "A5"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => set({ paper_size: size, receipt_paper_size: sameReceipt ? size : d.receipt_paper_size })}
                className={cn(
                  "rounded-xl border px-4 py-2 text-sm transition",
                  (d.paper_size ?? "A4") === size
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-glass-border hover:bg-muted/50",
                )}
              >
                {size}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-glass-border px-3 py-2">
            <div>
              <Label>Use the same size for payment receipts</Label>
              <p className="text-xs text-muted-foreground">Turn off to print receipts on a different size.</p>
            </div>
            <Switch
              checked={sameReceipt}
              onCheckedChange={(c) => {
                setSameReceipt(c);
                if (c) set({ receipt_paper_size: (d.paper_size ?? "A4") as PaperSize });
              }}
            />
          </div>
          {!sameReceipt && (
            <div className="flex gap-2">
              {(["A4", "A5"] as const).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => set({ receipt_paper_size: size })}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm transition",
                    (d.receipt_paper_size ?? "A4") === size
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-glass-border hover:bg-muted/50",
                  )}
                >
                  Receipts: {size}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Document format</Label>
          <div className="grid gap-3 sm:grid-cols-3">
            {TEMPLATES.map((t) => {
              const active = (d.print_template ?? "classic") === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => set({ print_template: t.key })}
                  className={cn(
                    "rounded-2xl border p-3 text-left transition",
                    active ? "border-primary ring-2 ring-primary/30" : "border-glass-border hover:bg-muted/40",
                  )}
                >
                  <TemplateThumb template={t.key} accent={d.print_accent_color || DEFAULT_PRINT_OPTIONS.accentColor} />
                  <p className="mt-2 text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.hint}</p>
                </button>
              );
            })}
          </div>
          {(d.print_template ?? "classic") === "modern" && (
            <Field label="Accent colour">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-14 rounded-md border border-glass-border bg-transparent"
                  value={d.print_accent_color || DEFAULT_PRINT_OPTIONS.accentColor}
                  onChange={(e) => set({ print_accent_color: e.target.value })}
                  aria-label="Accent colour"
                />
                <Input
                  className="w-32"
                  value={d.print_accent_color || DEFAULT_PRINT_OPTIONS.accentColor}
                  onChange={(e) => set({ print_accent_color: e.target.value })}
                />
              </div>
            </Field>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Line items on first page">
            <Input
              type="number"
              min={1}
              value={String(d.rows_first_page ?? 12)}
              onChange={(e) => set({ rows_first_page: Number(e.target.value) })}
            />
          </Field>
          <Field label="Line items on next pages">
            <Input
              type="number"
              min={1}
              value={String(d.rows_next_page ?? 18)}
              onChange={(e) => set({ rows_next_page: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <ToggleRow
            label="Repeat table header on every page"
            hint="Column titles are printed again on continuation pages."
            checked={d.repeat_table_header !== false}
            onChange={(c) => set({ repeat_table_header: c })}
          />
          <ToggleRow
            label="Repeat company header on next pages"
            hint="Off shows a slim “document no. — continued” strip instead."
            checked={d.repeat_brand_header === true}
            onChange={(c) => set({ repeat_brand_header: c })}
          />
          <ToggleRow
            label="Show page numbers"
            hint="Prints “Page X of Y” at the bottom of multi-page documents."
            checked={d.show_page_numbers !== false}
            onChange={(c) => set({ show_page_numbers: c })}
          />
          <ToggleRow
            label="Show “continued…” marker"
            hint="Adds a continued note at the bottom of every page except the last."
            checked={d.show_continued_marker !== false}
            onChange={(c) => set({ show_continued_marker: c })}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Printer className="w-4 h-4 mr-1" /> Preview print
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-1" /> {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </Section>

      <Section title="Number series" description="Prefix and running number for each document type.">
        <div className="space-y-3">
          {(["quotation", "invoice", "receipt"] as const).map((docType) => (
            <SeriesRow
              key={docType}
              docType={docType}
              row={series.find((s) => s.doc_type === docType)}
              onSave={saveSeries}
            />
          ))}
        </div>
      </Section>

      <Section title="GST rates" description="Rates offered in the line item editor.">
        <div className="flex flex-wrap gap-2">
          {rates.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1 rounded-full border border-glass-border px-3 py-1 text-sm">
              {r.label || `${r.percent}%`}
              <button type="button" aria-label={`Remove ${r.label}`} onClick={() => removeRate(r.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Input className="w-32" placeholder="Label" value={newRate.label} onChange={(e) => setNewRate({ ...newRate, label: e.target.value })} />
          <Input className="w-28" type="number" step="any" placeholder="Percent" value={newRate.percent} onChange={(e) => setNewRate({ ...newRate, percent: e.target.value })} />
          <Button
            variant="outline"
            onClick={async () => {
              const p = Number(newRate.percent);
              if (!Number.isFinite(p)) return;
              const ok = await addRate(newRate.label || `${p}%`, p);
              if (ok) setNewRate({ label: "", percent: "" });
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add rate
          </Button>
        </div>
      </Section>

      <Section title="Units" description="Units of measure offered in the line item editor.">
        <div className="flex flex-wrap gap-2">
          {units.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1 rounded-full border border-glass-border px-3 py-1 text-sm">
              {u.name}
              <button type="button" aria-label={`Remove ${u.name}`} onClick={() => removeUnit(u.id)}>
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input className="w-40" placeholder="Unit name" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} />
          <Button
            variant="outline"
            onClick={async () => {
              if (!newUnit.trim()) return;
              const ok = await addUnit(newUnit.trim());
              if (ok) setNewUnit("");
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add unit
          </Button>
        </div>
      </Section>
    </div>
  );
}

const SERIES_LABEL: Record<string, string> = {
  quotation: "Quotation",
  invoice: "Invoice",
  receipt: "Receipt",
};

function SeriesRow({
  docType,
  row,
  onSave,
}: {
  docType: NumberSeriesRow["doc_type"];
  row?: NumberSeriesRow;
  onSave: (docType: NumberSeriesRow["doc_type"], patch: Partial<NumberSeriesRow>) => Promise<boolean>;
}) {
  const [prefix, setPrefix] = useState(row?.prefix ?? "");
  const [next, setNext] = useState(String(row?.next_number ?? 1));
  const [padding, setPadding] = useState(String(row?.padding ?? 4));
  const [resetYearly, setResetYearly] = useState(row?.reset_yearly ?? false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPrefix(row?.prefix ?? "");
    setNext(String(row?.next_number ?? 1));
    setPadding(String(row?.padding ?? 4));
    setResetYearly(row?.reset_yearly ?? false);
  }, [row]);

  const preview = `${prefix}${String(Number(next) || 1).padStart(Number(padding) || 0, "0")}`;

  return (
    <div className="rounded-xl border border-glass-border p-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
      <Field label={`${SERIES_LABEL[docType]} prefix`}>
        <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="INV-" />
      </Field>
      <Field label="Next number">
        <Input type="number" min={1} value={next} onChange={(e) => setNext(e.target.value)} />
      </Field>
      <Field label="Padding">
        <Input type="number" min={0} max={10} value={padding} onChange={(e) => setPadding(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Switch checked={resetYearly} onCheckedChange={setResetYearly} aria-label="Reset yearly" />
        <span className="text-sm text-muted-foreground">Reset yearly</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Next: {preview}</span>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onSave(docType, {
              prefix,
              next_number: Math.max(1, Number(next) || 1),
              padding: Math.max(0, Number(padding) || 0),
              reset_yearly: resetYearly,
            });
            setBusy(false);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
