import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { LeadRow } from "@/hooks/use-leads";
import { useLeadFields } from "@/hooks/use-lead-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead: LeadRow;
  onSave: (patch: Partial<LeadRow>) => Promise<unknown>;
}

export function EditLeadModal({ open, onOpenChange, lead, onSave }: Props) {
  const [form, setForm] = useState({
    company_name: lead.company_name,
    address: lead.address,
    city: lead.city ?? "",
    contact_person: lead.contact_person,
    contact_number: lead.contact_number,
    lead_source: lead.lead_source,
    note: lead.note,
    lead_date: lead.lead_date ?? "",
    custom_fields: (lead.custom_fields ?? {}) as Record<string, unknown>,
  });
  const [saving, setSaving] = useState(false);
  const { fields: customFields } = useLeadFields();
  const setCF = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, custom_fields: { ...(f.custom_fields ?? {}), [key]: value } }));

  useEffect(() => {
    if (open) {
      setForm({
        company_name: lead.company_name,
        address: lead.address,
        city: lead.city ?? "",
        contact_person: lead.contact_person,
        contact_number: lead.contact_number,
        lead_source: lead.lead_source,
        note: lead.note,
        lead_date: lead.lead_date ?? "",
        custom_fields: (lead.custom_fields ?? {}) as Record<string, unknown>,
      });
    }
  }, [open, lead]);

  const submit = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Company name *</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Contact person</Label>
              <Input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Contact number</Label>
              <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
            <div className="space-y-2">
              <Label>Lead source</Label>
              <Input value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Lead date</Label>
              <Input type="date" value={form.lead_date} onChange={(e) => setForm({ ...form, lead_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          {customFields.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-glass-border">
              <div className="text-sm font-medium text-muted-foreground">Custom fields</div>
              {customFields
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((f) => {
                  const val = (form.custom_fields ?? {})[f.id];
                  if (f.field_type === "checkbox") {
                    return (
                      <div key={f.id} className="flex items-center gap-2">
                        <Checkbox id={`cf-${f.id}`} checked={!!val} onCheckedChange={(c) => setCF(f.id, !!c)} />
                        <Label htmlFor={`cf-${f.id}`}>
                          {f.label}{f.required && <span className="text-destructive"> *</span>}
                        </Label>
                      </div>
                    );
                  }
                  if (f.field_type === "select") {
                    return (
                      <div key={f.id} className="space-y-2">
                        <Label>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                        <Select value={(val as string) ?? ""} onValueChange={(v) => setCF(f.id, v)}>
                          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            {(f.options ?? []).map((opt) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  const type = f.field_type === "number" ? "number" : f.field_type === "date" ? "date" : f.field_type === "url" ? "url" : "text";
                  return (
                    <div key={f.id} className="space-y-2">
                      <Label htmlFor={`cf-${f.id}`}>
                        {f.label}{f.required && <span className="text-destructive"> *</span>}
                      </Label>
                      <Input id={`cf-${f.id}`} type={type} value={(val as string) ?? ""} onChange={(e) => setCF(f.id, e.target.value)} />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.company_name.trim()} className="bg-gradient-primary text-white">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
