import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmployeePicker } from "@/components/app/EmployeePicker";
import { useCurrentEmployee } from "@/hooks/use-current-employee";
import { todayLocalDate, type NewLeadInput } from "@/hooks/use-leads";
import type { EmployeeRow } from "@/hooks/use-employees";
import { useLeadFields } from "@/hooks/use-lead-fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (input: NewLeadInput) => Promise<unknown>;
}

const empty: NewLeadInput = {
  company_name: "",
  address: "",
  city: "",
  contact_person: "",
  contact_number: "",
  lead_source: "",
  note: "",
  lead_date: "",
  captured_by_employee_id: null,
  followed_by_employee_id: null,
  custom_fields: {},
};

// Any active employee can be assigned to a lead; access to the Leads
// module itself is gated by role permissions.
const leadAccess = (e: EmployeeRow) => e.status === "active";

export function NewLeadModal({ open, onOpenChange, onCreate }: Props) {
  const [form, setForm] = useState<NewLeadInput>(empty);
  const [saving, setSaving] = useState(false);
  const currentEmployee = useCurrentEmployee();
  const { fields: customFields } = useLeadFields();

  const setCF = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, custom_fields: { ...(f.custom_fields ?? {}), [key]: value } }));

  useEffect(() => {
    if (open) {
      const me = currentEmployee?.id ?? null;
      setForm({ ...empty, lead_date: todayLocalDate(), captured_by_employee_id: me, followed_by_employee_id: me });
    }
  }, [open, currentEmployee]);

  const submit = async () => {
    if (!form.company_name.trim()) return;
    setSaving(true);
    const res = await onCreate(form);
    setSaving(false);
    if (res) {
      const me = currentEmployee?.id ?? null;
      setForm({ ...empty, lead_date: todayLocalDate(), captured_by_employee_id: me, followed_by_employee_id: me });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
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
              <Input
                placeholder="Referral, Website, Cold call…"
                value={form.lead_source}
                onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Lead date</Label>
              <Input
                type="date"
                value={form.lead_date ?? ""}
                onChange={(e) => setForm({ ...form, lead_date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EmployeePicker
              label="Captured by"
              value={form.captured_by_employee_id ?? null}
              onChange={(v) => setForm({ ...form, captured_by_employee_id: v })}
              filter={leadAccess}
            />
            <EmployeePicker
              label="Followed by"
              value={form.followed_by_employee_id ?? null}
              onChange={(v) => setForm({ ...form, followed_by_employee_id: v })}
              filter={leadAccess}
            />
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
            {saving ? "Saving…" : "Create lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
