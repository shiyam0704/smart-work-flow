import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineItemsEditor, emptyLine } from "./LineItemsEditor";
import { computeDocument, type LineItemInput } from "@/lib/invoice-calc";
import { formatINR, todayLocalDate, formatDate } from "@/lib/format";
import { useClientsData } from "@/hooks/use-clients-data";
import { useClientGroups } from "@/hooks/use-client-groups";
import { useConfirm } from "@/components/app/confirm-dialog";
import { useProjects } from "@/hooks/use-projects";
import { useInvoiceSettings } from "@/hooks/use-invoice-settings";
import { toast } from "sonner";

const NONE = "none";

export interface DocFormValue {
  client_id: string | null;
  project_id: string | null;
  title: string;
  date: string;
  secondaryDate: string | null;
  status: string;
  place_of_supply: string;
  is_interstate: boolean;
  bill_to_name: string;
  bill_to_address: string;
  bill_to_gstin: string;
  bill_to_contact_person: string;
  bill_to_contact_number: string;
  notes: string;
  terms: string;
  items: LineItemInput[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "quotation" | "invoice";
  statuses: { value: string; label: string }[];
  initial?: Partial<DocFormValue> | null;
  numberLabel?: string;
  submitLabel?: string;
  onSubmit: (value: DocFormValue) => Promise<boolean>;
}

function today() {
  return todayLocalDate();
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return formatDate(d, "yyyy-MM-dd");
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  kind,
  statuses,
  initial,
  numberLabel,
  submitLabel,
  onSubmit,
}: Props) {
  const { clients, addClient } = useClientsData();
  const { groups } = useClientGroups();
  const confirmDialog = useConfirm();
  const [savingClient, setSavingClient] = useState(false);
  const { projects } = useProjects();
  const { settings } = useInvoiceSettings();
  const requireProject = settings?.require_project_on_invoice === true;

  const [saving, setSaving] = useState(false);
  const [v, setV] = useState<DocFormValue>(() => blank());

  function blank(): DocFormValue {
    return {
      client_id: null,
      project_id: null,
      title: "",
      date: today(),
      secondaryDate: null,
      status: statuses[0]?.value ?? "draft",
      place_of_supply: "",
      is_interstate: false,
      bill_to_name: "",
      bill_to_address: "",
      bill_to_gstin: "",
      bill_to_contact_person: "",
      bill_to_contact_number: "",
      notes: "",
      terms: "",
      items: [emptyLine()],
    };
  }

  const prevOpenRef = useRef(false);
  const docKey = numberLabel || (initial?.title ? `${initial.title}-${initial.date}` : "new");
  const prevDocKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      prevOpenRef.current = false;
      return;
    }
    const justOpened = !prevOpenRef.current;
    const docChanged = prevDocKeyRef.current !== docKey;
    prevOpenRef.current = true;

    if (justOpened || docChanged) {
      prevDocKeyRef.current = docKey;
      const base = blank();
      const defaults = {
        terms:
          kind === "quotation"
            ? settings?.default_quotation_terms ?? ""
            : settings?.default_invoice_terms ?? "",
        place_of_supply: settings?.state_name ?? "",
        secondaryDate:
          kind === "quotation"
            ? addDays(settings?.quotation_validity_days ?? 15)
            : addDays(settings?.invoice_due_days ?? 15),
        items: [emptyLine(settings?.default_gst_percent ?? 18)],
      };
      setV({ ...base, ...defaults, ...(initial ?? {}) } as DocFormValue);
    }
  }, [open, docKey, initial, settings, kind]);

  // Auto-derive interstate if place_of_supply differs from company state (BUG #37)
  useEffect(() => {
    if (!open) return;
    const companyState = settings?.state_name?.trim().toLowerCase();
    const pos = v.place_of_supply?.trim().toLowerCase();
    if (companyState && pos) {
      const isInter = pos !== companyState;
      if (v.is_interstate !== isInter) {
        setV((prev) => ({ ...prev, is_interstate: isInter }));
      }
    }
  }, [open, v.place_of_supply, settings?.state_name]);

  const set = (p: Partial<DocFormValue>) => setV((prev) => ({ ...prev, ...p }));

  const totals = useMemo(
    () => computeDocument(v.items, { isInterstate: v.is_interstate, roundOff: settings?.round_off_enabled !== false }).totals,
    [v.items, v.is_interstate, settings?.round_off_enabled],
  );

  const clientProjects = useMemo(
    () => (v.client_id ? projects.filter((p) => p.client_id === v.client_id) : projects),
    [projects, v.client_id],
  );

  function pickClient(id: string) {
    if (id === NONE) { set({ client_id: null }); return; }
    const c = clients.find((x) => x.id === id);
    set({
      client_id: id,
      bill_to_name: c?.name ?? "",
      bill_to_address: [c?.address, c?.city].filter(Boolean).join(", "),
      bill_to_contact_person: c?.contact_person ?? "",
      bill_to_contact_number: c?.contact_number ?? "",
    });
  }

  async function saveAsClient() {
    const name = v.bill_to_name.trim();
    if (!name) { toast.error("Add a customer name first"); return; }
    const dupe = clients.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    if (dupe) {
      const ok = await confirmDialog({
        title: "Client already exists",
        description: `“${dupe.name}” is already saved. Link this document to the existing client instead of creating a duplicate?`,
        confirmText: "Use existing",
      });
      if (ok) { pickClient(dupe.id); return; }
    }
    setSavingClient(true);
    const id = await addClient({
      name,
      logo_url: null,
      status: "active",
      client_group: groups[0]?.name ?? "SMB",
      address: v.bill_to_address,
      city: "",
      contact_person: v.bill_to_contact_person,
      contact_number: v.bill_to_contact_number,
      note: "",
      custom_fields: {},
    });
    setSavingClient(false);
    if (id) set({ client_id: id });
  }

  function pickProject(id: string) {
    if (id === NONE) { set({ project_id: null }); return; }
    const p = projects.find((x) => x.id === id);
    if (p?.client_id && !v.client_id) pickClient(p.client_id);
    set({ project_id: id });
  }

  async function handleSubmit() {
    if (!v.bill_to_name.trim()) { toast.error("Add a bill-to name or pick a client"); return; }
    if (kind === "invoice" && requireProject && !v.project_id) {
      toast.error("Pick a project for this invoice");
      return;
    }
    const items = v.items.filter((i) => i.description.trim() || i.rate > 0);
    if (!items.length) { toast.error("Add at least one line item"); return; }

    setSaving(true);
    const ok = await onSubmit({ ...v, items });
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  const isQuotation = kind === "quotation";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit" : "New"} {isQuotation ? "Quotation" : "Invoice"}
            {numberLabel ? <span className="text-muted-foreground font-normal"> · {numberLabel}</span> : null}
          </DialogTitle>
          <DialogDescription>
            {isQuotation
              ? "Prepare a quotation with GST-ready line items."
              : "Raise a tax invoice with GST-ready line items."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3 rounded-xl border border-glass-border p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-semibold">Customer details</Label>
              {!v.client_id ? (
                <>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-glass-border text-muted-foreground">
                    Walk-in customer — not a saved client
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    disabled={savingClient || !v.bill_to_name.trim()}
                    onClick={saveAsClient}
                  >
                    {savingClient ? "Saving…" : "Save as client"}
                  </Button>
                </>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary">
                  Linked to saved client
                </span>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Customer / bill to name</Label>
                <Input
                  value={v.bill_to_name}
                  onChange={(e) => set({ bill_to_name: e.target.value })}
                  placeholder="Name of the person or company"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact person</Label>
                <Input
                  value={v.bill_to_contact_person}
                  onChange={(e) => set({ bill_to_contact_person: e.target.value })}
                  placeholder="Who to reach"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Contact number</Label>
                <Input
                  value={v.bill_to_contact_number}
                  onChange={(e) => set({ bill_to_contact_number: e.target.value })}
                  placeholder="Phone / WhatsApp"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>Bill to address</Label>
                <Textarea
                  rows={2}
                  value={v.bill_to_address}
                  onChange={(e) => set({ bill_to_address: e.target.value })}
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Bill to GSTIN</Label>
                  <Input value={v.bill_to_gstin} onChange={(e) => set({ bill_to_gstin: e.target.value })} />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-glass-border px-3 py-2">
                  <div>
                    <Label className="cursor-pointer">Inter-state (IGST)</Label>
                    <p className="text-xs text-muted-foreground">Off = CGST + SGST</p>
                  </div>
                  <Switch checked={v.is_interstate} onCheckedChange={(c) => set({ is_interstate: c })} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={v.client_id ?? NONE} onValueChange={pickClient}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No client</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{kind === "invoice" && requireProject ? "Project" : "Project (optional)"}</Label>
            <Select value={v.project_id ?? NONE} onValueChange={pickProject}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>
                {!(kind === "invoice" && requireProject) && <SelectItem value={NONE}>No project</SelectItem>}

                {clientProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={v.status} onValueChange={(s) => set({ status: s })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <Label>Subject / title</Label>
            <Input
              value={v.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={isQuotation ? "Quotation for branding package" : "Invoice for branding package"}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{isQuotation ? "Quotation date" : "Invoice date"}</Label>
            <Input type="date" value={v.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>{isQuotation ? "Valid until" : "Due date"}</Label>
            <Input
              type="date"
              value={v.secondaryDate ?? ""}
              onChange={(e) => set({ secondaryDate: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Place of supply</Label>
            <Input
              value={v.place_of_supply}
              onChange={(e) => set({ place_of_supply: e.target.value })}
              placeholder="Tamil Nadu"
            />
          </div>
        </div>

        <div className="mt-2">
          <Label className="mb-2 block">Line items</Label>
          <LineItemsEditor
            items={v.items}
            onChange={(items) => set({ items })}
            defaultGst={settings?.default_gst_percent ?? 18}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea rows={3} value={v.notes} onChange={(e) => set({ notes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Terms &amp; conditions</Label>
              <Textarea rows={3} value={v.terms} onChange={(e) => set({ terms: e.target.value })} />
            </div>
          </div>
          <div className="rounded-xl border border-glass-border p-4 space-y-1.5 text-sm h-fit">
            <Row label="Subtotal" value={formatINR(totals.subtotal)} />
            {totals.discount_total ? <Row label="Discount" value={`- ${formatINR(totals.discount_total)}`} /> : null}
            <Row label="Taxable value" value={formatINR(totals.taxable_total)} />
            {v.is_interstate ? (
              <Row label="IGST" value={formatINR(totals.igst_total)} />
            ) : (
              <>
                <Row label="CGST" value={formatINR(totals.cgst_total)} />
                <Row label="SGST" value={formatINR(totals.sgst_total)} />
              </>
            )}
            {totals.round_off ? <Row label="Round off" value={formatINR(totals.round_off)} /> : null}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-glass-border font-semibold text-base">
              <span>Grand total</span>
              <span>{formatINR(totals.grand_total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : submitLabel ?? (initial ? "Save changes" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
