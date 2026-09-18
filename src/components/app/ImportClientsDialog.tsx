import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseClientsCsv, clientsCsvTemplate, type ParsedClientRow } from "@/lib/clients-csv";
import { useClientFields } from "@/hooks/use-client-fields";
import { useClientsData } from "@/hooks/use-clients-data";
import { Download, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportClientsDialog({ open, onOpenChange }: Props) {
  const { fields } = useClientFields();
  const { bulkAddClients } = useClientsData();
  const [fileName, setFileName] = useState<string>("");
  const [parsed, setParsed] = useState<ParsedClientRow[]>([]);
  const [headerErrors, setHeaderErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const valid = useMemo(() => parsed.filter((p) => !p.error), [parsed]);
  const invalid = useMemo(() => parsed.filter((p) => p.error), [parsed]);

  const reset = () => {
    setFileName(""); setParsed([]); setHeaderErrors([]);
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const res = parseClientsCsv(text, fields);
    setParsed(res.rows);
    setHeaderErrors(res.headerErrors);
  };

  const downloadTemplate = () => {
    const csv = clientsCsvTemplate(fields);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "clients-template.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (valid.length === 0) return;
    setImporting(true);
    const res = await bulkAddClients(valid.map((v) => v.input));
    setImporting(false);
    if (res.inserted > 0) {
      onOpenChange(false);
      reset();
    } else if (res.failed > 0) {
      toast.error("Import failed. Check console for details.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="bg-background border-border sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Clients from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" variant="outline" onClick={downloadTemplate} className="glass border-glass-border">
              <Download className="w-4 h-4" /> Download template
            </Button>
            <p className="text-xs text-muted-foreground">
              Required column: <code>name</code>. Optional: client_group, status, logo_url, address, city, contact_person, contact_number, note{fields.length > 0 && `, plus custom fields (${fields.map(f => f.label).join(", ")})`}.
            </p>
          </div>

          <label className="flex items-center gap-2 glass rounded-lg p-3 border-2 border-dashed border-glass-border cursor-pointer hover:bg-white/5 transition">
            <FileUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {fileName || "Click to choose a .csv file"}
            </span>
            <Input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </label>

          {headerErrors.length > 0 && (
            <div className="glass rounded-lg p-3 text-sm border border-destructive/50 text-destructive space-y-1">
              {headerErrors.map((h, i) => (
                <div key={i} className="flex items-center gap-2"><AlertCircle className="w-4 h-4" />{h}</div>
              ))}
            </div>
          )}

          {parsed.length > 0 && headerErrors.length === 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="w-4 h-4" />{valid.length} ready</span>
                {invalid.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-destructive"><AlertCircle className="w-4 h-4" />{invalid.length} skipped</span>
                )}
              </div>
              <div className="glass rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">#</th>
                      <th className="text-left p-2 font-medium">Name</th>
                      <th className="text-left p-2 font-medium">Group</th>
                      <th className="text-left p-2 font-medium">City</th>
                      <th className="text-left p-2 font-medium">Contact</th>
                      <th className="text-left p-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 50).map((p) => (
                      <tr key={p.line} className={`border-t border-glass-border ${p.error ? "opacity-50" : ""}`}>
                        <td className="p-2 tabular-nums text-muted-foreground">{p.line}</td>
                        <td className="p-2">{p.error ? <span className="text-destructive">{p.error}</span> : p.input.name}</td>
                        <td className="p-2 text-muted-foreground">{p.input.client_group ?? ""}</td>
                        <td className="p-2 text-muted-foreground">{p.input.city ?? ""}</td>
                        <td className="p-2 text-muted-foreground">{p.input.contact_person ?? ""}</td>
                        <td className="p-2 text-muted-foreground">{p.input.status ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing first 50 of {parsed.length} rows.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleImport}
            disabled={importing || valid.length === 0 || headerErrors.length > 0}
            className="bg-gradient-primary text-white"
          >
            {importing ? "Importing…" : `Import ${valid.length} client${valid.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}