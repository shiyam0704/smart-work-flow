import { createFileRoute } from "@tanstack/react-router";
import { useCanManage } from "@/hooks/use-permissions";
import { CLink as Link } from "@/lib/nav";
import { useEffect, useMemo, useState } from "react";
import { Topbar } from "@/components/app/Topbar";
import { Button } from "@/components/ui/button";
import { Upload, Download, Plus, Search, Settings2, ChevronUp, ChevronDown, Trash2, Pencil, Check, X, Phone, MessageCircle, LayoutGrid, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditClientModal } from "@/components/app/EditClientModal";
import { ImportClientsDialog } from "@/components/app/ImportClientsDialog";

import { useClientsData, type ClientRow, type ClientInput } from "@/hooks/use-clients-data";
import { useClientGroups } from "@/hooks/use-client-groups";
import { useClientFields } from "@/hooks/use-client-fields";
import { exportClientsCsv } from "@/lib/clients-csv";

import { useAuth } from "@/hooks/use-auth";
import { useConfirm } from "@/components/app/confirm-dialog";

export const Route = createFileRoute("/c/$slug/_app/clients/")({
  component: ClientsPage,
  head: () => ({ meta: [{ title: "Clients — Smart Work Flow" }] }),
});

function ClientsPage() {
  const { clients, loading, addClient, updateClient } = useClientsData();
  const { groups, addGroup, renameGroup, deleteGroup, move } = useClientGroups();
  const { fields: customFields } = useClientFields();
  
  const { isAdmin } = useAuth();
  const isManager = useCanManage("clients");
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<"grid" | "table">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("clients:view") as "grid" | "table") ?? "grid";
  });
  useEffect(() => { localStorage.setItem("clients:view", view); }, [view]);
  const [groupFilter, setGroupFilter] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window === "undefined") return 24;
    const raw = Number(localStorage.getItem("clients:pageSize"));
    return Number.isFinite(raw) && raw > 0 ? raw : 24;
  });
  useEffect(() => { localStorage.setItem("clients:pageSize", String(pageSize)); }, [pageSize]);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const groupNames = useMemo(() => groups.map((g) => g.name), [groups]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      const matchesGroup = groupFilter === "All" || c.client_group === groupFilter;
      if (!matchesGroup) return false;
      if (!q) return true;
      const hay = [
        c.name,
        c.city,
        c.contact_person,
        c.contact_number,
        c.client_group,
        (c as any).email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, groupFilter, query]);

  // Reset to first page whenever filters change
  useEffect(() => { setPage(1); }, [query, groupFilter, pageSize, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paged = useMemo(
    () => filtered.slice(pageStart, pageStart + pageSize),
    [filtered, pageStart, pageSize],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, ClientRow[]>();
    for (const c of paged) {
      const key = c.client_group || "Ungrouped";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    // Sort by configured group order, unknowns last
    return Array.from(map.entries()).sort(([a], [b]) => {
      const ai = groupNames.indexOf(a);
      const bi = groupNames.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [paged, groupNames]);

  const handleSave = async (input: ClientInput, id?: string) => {
    return id ? updateClient(id, input) : addClient(input);
  };

  const handleAddGroup = async () => {
    const ok = await addGroup(newGroupName);
    if (ok) setNewGroupName("");
  };

  const startRename = (id: string, name: string) => {
    setEditingGroupId(id);
    setEditingName(name);
  };
  const commitRename = async () => {
    if (!editingGroupId) return;
    await renameGroup(editingGroupId, editingName);
    setEditingGroupId(null);
    setEditingName("");
  };

  const groupOptions = ["All", ...groupNames];

  const STATUS_COLORS: Record<ClientRow["status"], string> = {
    active: "bg-success/15 text-success border-success/30",
    paused: "bg-warning/15 text-warning border-warning/30",
    churned: "bg-destructive/15 text-destructive border-destructive/30",
  };

  const handleExport = () => exportClientsCsv(filtered, customFields);

  const LogoTile = ({ c, size = "lg" }: { c: ClientRow; size?: "lg" | "sm" }) => {
    const dim = size === "lg" ? "w-14 h-14 text-lg rounded-xl" : "w-9 h-9 text-xs rounded-lg";
    return (
      <div className={`${dim} bg-gradient-accent flex items-center justify-center text-white font-display font-bold shadow-glow shrink-0 overflow-hidden`}>
        {c.logo_url ? (
          <img src={c.logo_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        ) : (
          c.logo
        )}
      </div>
    );
  };

  return (
    <>
      <Topbar title="Clients" subtitle={loading ? "Loading…" : `${clients.length} accounts`} />
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, city, contact, phone…"
              className="bg-transparent border-0 h-7 px-0 focus-visible:ring-0"
            />
          </div>
          <div className="glass rounded-lg p-1 inline-flex" role="tablist" aria-label="View mode">
            <button
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition ${view === "grid" ? "bg-gradient-primary text-white shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setView("table")}
              aria-pressed={view === "table"}
              className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition ${view === "table" ? "bg-gradient-primary text-white shadow-glow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <Button variant="outline" className="glass border-glass-border" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" /> Export
          </Button>
          {isManager && (
            <Button variant="outline" className="glass border-glass-border" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> Import
            </Button>
          )}
          {isManager && (
            <Button onClick={() => setOpen(true)} className="bg-gradient-primary text-white shadow-glow"><Plus className="w-4 h-4" /> Add Client</Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {groupOptions.map((g) => {
            const isActive = groupFilter === g;
            const count = g === "All" ? clients.length : clients.filter((c) => c.client_group === g).length;
            return (
              <button
                key={g}
                onClick={() => setGroupFilter(g)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                  isActive
                    ? "bg-gradient-primary text-white shadow-glow"
                    : "glass border-glass-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {g} <span className="opacity-60">({count})</span>
              </button>
            );
          })}

          {isAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" className="glass border-glass-border h-8">
                  <Settings2 className="w-3.5 h-3.5" /> Manage groups
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                collisionPadding={12}
                className="w-80 z-50 bg-popover text-popover-foreground border border-border shadow-xl p-3 space-y-3"
              >
                <div className="text-sm font-display font-bold">Client Groups</div>
                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {groups.map((g, i) => {
                    const usage = clients.filter((c) => c.client_group === g.name).length;
                    const isEditing = editingGroupId === g.id;
                    return (
                      <div key={g.id} className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white/5">
                        {isEditing ? (
                          <>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename();
                                if (e.key === "Escape") setEditingGroupId(null);
                              }}
                              className="h-7 text-xs"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commitRename} aria-label="Confirm rename">
                              <Check className="w-3.5 h-3.5 text-neon-green" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingGroupId(null)} aria-label="Cancel rename">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm truncate">{g.name}</span>
                            <span className="text-[10px] text-muted-foreground mr-1">{usage}</span>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === 0} onClick={() => move(g.id, "up")} aria-label={`Move ${g.name} up`}>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={i === groups.length - 1} onClick={() => move(g.id, "down")} aria-label={`Move ${g.name} down`}>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startRename(g.id, g.name)} aria-label={`Rename ${g.name}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={usage > 0}
                              title={usage > 0 ? `In use by ${usage} client(s)` : "Delete"}
                              onClick={async () => { if (await confirm({ title: `Delete group "${g.name}"?`, requireType: "DELETE" })) deleteGroup(g.id); }}
                              aria-label={`Delete ${g.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-neon-pink" />
                            </Button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2 border-t border-glass-border">
                  <Input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddGroup()}
                    placeholder="New group name"
                    className="h-8 text-xs"
                  />
                  <Button size="sm" onClick={handleAddGroup} className="bg-gradient-primary text-white">Add</Button>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {!loading && grouped.length === 0 && (
          <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
            {clients.length === 0 ? "No clients yet." : "No clients match your filters."}
          </div>
        )}

        {view === "grid" && grouped.map(([groupName, groupClients]) => (
          <section key={groupName} className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h2 className="font-display font-bold text-lg">{groupName}</h2>
              <span className="text-xs text-muted-foreground">{groupClients.length} clients</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
              {groupClients.map((c) => {
                const waDigits = (c.contact_number ?? "").replace(/\D/g, "");
                return (
                  <div
                    key={c.id}
                    className="glass rounded-2xl p-5 shadow-card hover:shadow-glow transition group flex items-center gap-3"
                  >
                    <Link
                      to="/c/$slug/clients/$clientId"
                      params={{ clientId: c.id }}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <LogoTile c={c} />
                      <div className="flex-1 min-w-0">
                        <div className="font-display font-bold truncate group-hover:text-gradient transition">{c.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.city || "—"}</div>
                      </div>
                    </Link>
                    {c.contact_number && (
                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={`tel:${c.contact_number}`}
                          className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
                          aria-label="Call"
                          title="Call"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                        {waDigits && (
                          <a
                            href={`https://wa.me/${waDigits}`}
                            target="_blank"
                            rel="noreferrer"
                            className="h-9 w-9 grid place-items-center rounded-lg hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition"
                            aria-label="WhatsApp"
                            title="WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {view === "table" && paged.length > 0 && (
          <div className="glass rounded-2xl overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Client</th>
                    <th className="text-left px-4 py-3 font-medium">Group</th>
                    <th className="text-left px-4 py-3 font-medium">City</th>
                    <th className="text-left px-4 py-3 font-medium">Contact person</th>
                    <th className="text-left px-4 py-3 font-medium">Phone</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {paged
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => {
                      const waDigits = (c.contact_number ?? "").replace(/\D/g, "");
                      return (
                        <tr key={c.id} className="border-t border-glass-border hover:bg-white/5 transition">
                          <td className="px-4 py-3">
                            <Link to="/c/$slug/clients/$clientId" params={{ clientId: c.id }} className="flex items-center gap-3">
                              <LogoTile c={c} size="sm" />
                              <span className="font-medium truncate">{c.name}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{c.client_group || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.city || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.contact_person || "—"}</td>
                          <td className="px-4 py-3">
                            {c.contact_number ? (
                              <div className="flex items-center gap-1">
                                <a href={`tel:${c.contact_number}`} onClick={(e) => e.stopPropagation()} className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/10 text-muted-foreground hover:text-foreground" aria-label="Call"><Phone className="w-3.5 h-3.5" /></a>
                                {waDigits && (
                                  <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="h-7 w-7 grid place-items-center rounded-md hover:bg-white/10 text-emerald-400" aria-label="WhatsApp"><MessageCircle className="w-3.5 h-3.5" /></a>
                                )}
                                <span className="text-xs text-muted-foreground ml-1 tabular-nums">{c.contact_number}</span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[c.status]}`}>{c.status}</span>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            <ChevronDown className="w-4 h-4 -rotate-90" />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-muted-foreground">
              Showing <span className="text-foreground font-medium">{pageStart + 1}</span>
              –<span className="text-foreground font-medium">{Math.min(pageStart + pageSize, filtered.length)}</span>
              {" "}of <span className="text-foreground font-medium">{filtered.length}</span>
              {query && <> matching “{query}”</>}
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Per page</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-glass-border rounded-md h-8 px-2 text-xs bg-background text-foreground"
              >
                {[12, 24, 48, 96].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <div className="inline-flex items-center gap-1 ml-2">
                <Button
                  size="icon"
                  variant="outline"
                  className="glass border-glass-border h-8 w-8"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2 tabular-nums">
                  Page {currentPage} / {totalPages}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="glass border-glass-border h-8 w-8"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <EditClientModal client={null} mode="create" open={open} onOpenChange={setOpen} onSave={handleSave} />
      <ImportClientsDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
