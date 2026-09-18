import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CLIENT_GROUPS, type ClientRow, type ClientInput } from "@/hooks/use-clients-data";
import { useClientGroups } from "@/hooks/use-client-groups";
import { useClientFields } from "@/hooks/use-client-fields";

interface Props {
  client: ClientRow | null;
  open: boolean;
  mode?: "edit" | "create";
  onOpenChange: (open: boolean) => void;
  onSave: (input: ClientInput, id?: string) => Promise<unknown>;
}

const empty: ClientInput = {
  name: "",
  status: "active",
  client_group: "",
  logo_url: "",
  address: "",
  city: "",
  contact_person: "",
  contact_number: "",
  note: "",
  custom_fields: {},
};


export function EditClientModal({ client, open, mode = "edit", onOpenChange, onSave }: Props) {
  const { groups } = useClientGroups();
  const { fields: customFields } = useClientFields();
  const [form, setForm] = useState<ClientInput>(empty);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        logo: client.logo,
        logo_url: client.logo_url ?? "",
        status: client.status,
        client_group: client.client_group,
        address: client.address ?? "",
        city: client.city ?? "",
        contact_person: client.contact_person ?? "",
        contact_number: client.contact_number ?? "",
        note: client.note ?? "",
        custom_fields: client.custom_fields ?? {},
      });
    } else {
      setForm({ ...empty, client_group: groups[0]?.name ?? "" });
    }
  }, [client, open, groups]);


  const setCF = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, custom_fields: { ...(f.custom_fields ?? {}), [key]: value } }));

  const handleLogoFile = (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError("Please choose an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image must be under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, logo_url: String(reader.result ?? "") }));
    };
    reader.onerror = () => setUploadError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const res = await onSave({ ...form }, client?.id);
    setSaving(false);
    if (res) onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Client" : "Edit Client"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="logo_url">Logo <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-accent flex items-center justify-center text-white font-display font-bold text-sm shadow-glow shrink-0 overflow-hidden">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    (form.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoFile(file);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      {form.logo_url ? "Change image" : "Upload image"}
                    </Button>
                    {form.logo_url && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, logo_url: "" })}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <Input
                    id="logo_url"
                    placeholder="…or paste an image URL"
                    value={form.logo_url?.startsWith("data:") ? "" : (form.logo_url ?? "")}
                    onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  />
                </div>
              </div>
              {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              <p className="text-xs text-muted-foreground">PNG/JPG/SVG up to 2 MB. Leave blank to auto-generate initials from the name.</p>
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="group">Client Group</Label>
              <Select value={form.client_group} onValueChange={(v) => setForm({ ...form, client_group: v })}>
                <SelectTrigger id="group"><SelectValue placeholder={groups.length ? "Select group" : "No groups yet"} /></SelectTrigger>
                <SelectContent>
                  {groups.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">No groups yet</div>
                  ) : (
                    groups.map((g) => (
                      <SelectItem key={g.id} value={g.name}>{g.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v: ClientRow["status"]) => setForm({ ...form, status: v })}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input id="contactPerson" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-2">
              <Label htmlFor="note">Note</Label>
              <Textarea id="note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </div>
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
                        <Checkbox
                          id={`cf-${f.id}`}
                          checked={!!val}
                          onCheckedChange={(c) => setCF(f.id, !!c)}
                        />
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
                  const type =
                    f.field_type === "number"
                      ? "number"
                      : f.field_type === "date"
                      ? "date"
                      : f.field_type === "url"
                      ? "url"
                      : "text";
                  return (
                    <div key={f.id} className="space-y-2">
                      <Label htmlFor={`cf-${f.id}`}>
                        {f.label}{f.required && <span className="text-destructive"> *</span>}
                      </Label>
                      <Input
                        id={`cf-${f.id}`}
                        type={type}
                        value={(val as string | number | undefined) ?? ""}
                        onChange={(e) => setCF(f.id, e.target.value)}
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary text-white">
            {saving ? "Saving…" : mode === "create" ? "Add client" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
