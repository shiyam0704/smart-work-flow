import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Download, Search, IndianRupee } from "lucide-react";
import { CLink as Link } from "@/lib/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConfirm } from "@/components/app/confirm-dialog";
import { SupplierFormDialog } from "@/components/purchase/SupplierFormDialog";
import { useSuppliers, type SupplierRow } from "@/hooks/use-suppliers";
import { useSupplierBalances } from "@/hooks/use-supplier-payments";
import { formatINR } from "@/lib/format";
import { exportRowsAsCsv } from "@/lib/csv";
import { useCanManage } from "@/hooks/use-permissions";

export const Route = createFileRoute("/c/$slug/_app/purchase/suppliers")({
  component: SuppliersPage,
});

const ALL = "all";

function SuppliersPage() {
  const { suppliers, loading, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const canManage = useCanManage("purchase");
  const { balances } = useSupplierBalances();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);

  const balanceOf = (id: string) => balances.find((b) => b.supplier.id === id)?.outstanding ?? 0;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (state === "active" && !s.is_active) return false;
      if (state === "inactive" && s.is_active) return false;
      if (!q) return true;
      return [s.name, s.contact_person, s.phone, s.city, s.gstin].join(" ").toLowerCase().includes(q);
    });
  }, [suppliers, query, state]);

  async function handleDelete(s: SupplierRow) {
    const ok = await confirm({
      title: "Delete supplier?",
      description: `${s.name} will be removed. Purchase history stays but loses the supplier link.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) await deleteSupplier(s.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative sm:max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search suppliers…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 bg-input border-border" />
        </div>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="sm:w-40 bg-input border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All suppliers</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <div className="sm:ml-auto flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportRowsAsCsv(
                "suppliers",
                rows.map((s) => ({
                  Name: s.name,
                  Contact: s.contact_person,
                  Phone: s.phone,
                  Email: s.email,
                  City: s.city,
                  GSTIN: s.gstin,
                  Outstanding: balanceOf(s.id),
                  Status: s.is_active ? "Active" : "Inactive",
                })),
              )
            }
          >
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="bg-gradient-primary text-white shadow-glow" disabled={!canManage}>
            <Plus className="w-4 h-4" /> New supplier
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">No suppliers yet.</div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground border-b border-glass-border">
            <div className="col-span-4">Supplier</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-2">City</div>
            <div className="col-span-2 text-right">Outstanding</div>
            <div className="col-span-1" />
          </div>
          {rows.map((s) => (
            <div key={s.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 border-b border-glass-border last:border-0 items-center">
              <div className="md:col-span-4 min-w-0">
                <Link to="/c/$slug/purchase/suppliers/$supplierId" params={{ supplierId: s.id }} className="font-medium truncate hover:text-primary">
                  {s.name}
                </Link>
                <p className="text-xs text-muted-foreground truncate">{s.gstin || "No GST number"}</p>
              </div>
              <div className="md:col-span-3 text-sm min-w-0 truncate">
                {s.contact_person || "—"}
                {s.phone ? <span className="text-muted-foreground"> · {s.phone}</span> : null}
              </div>
              <div className="md:col-span-2 text-sm truncate">{s.city || "—"}</div>
              <div className="md:col-span-2 text-sm md:text-right font-semibold flex md:justify-end items-center gap-1">
                <IndianRupee className="w-3.5 h-3.5 text-muted-foreground md:hidden" />
                {formatINR(balanceOf(s.id))}
              </div>
              <div className="md:col-span-1 flex md:justify-end gap-1">
                <Button variant="ghost" size="icon" aria-label="Edit supplier" disabled={!canManage} onClick={() => { setEditing(s); setOpen(true); }}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Delete supplier" disabled={!canManage} onClick={() => handleDelete(s)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SupplierFormDialog
        open={open}
        onOpenChange={setOpen}
        supplier={editing}
        onSubmit={async (v) => (editing ? await updateSupplier(editing.id, v) : await addSupplier(v))}
      />
    </div>
  );
}
