import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRESETS, rangeFromPreset, type DateRange, type PresetKey } from "@/lib/date-presets";

export interface SelectOption {
  value: string;
  label: string;
}

export interface ExtraFilter {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
}

export function ReportFilters({
  preset,
  onPreset,
  range,
  onRange,
  extras = [],
  onReset,
  onExport,
}: {
  preset: PresetKey;
  onPreset: (p: PresetKey) => void;
  range: DateRange;
  onRange: (r: DateRange) => void;
  extras?: ExtraFilter[];
  onReset: () => void;
  onExport: () => void;
}) {
  function pick(p: PresetKey) {
    onPreset(p);
    if (p !== "custom") onRange(rangeFromPreset(p));
  }

  return (
    <div className="glass rounded-xl p-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date range</label>
        <Select value={preset} onValueChange={(v) => pick(v as PresetKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">From</label>
        <Input
          type="date"
          value={range.from ?? ""}
          onChange={(e) => {
            onPreset("custom");
            onRange({ ...range, from: e.target.value || null });
          }}
          className="w-40"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] uppercase tracking-wide text-muted-foreground">To</label>
        <Input
          type="date"
          value={range.to ?? ""}
          onChange={(e) => {
            onPreset("custom");
            onRange({ ...range, to: e.target.value || null });
          }}
          className="w-40"
        />
      </div>

      {extras.map((f) => (
        <div key={f.id} className="flex flex-col gap-1.5">
          <label className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.label}</label>
          <Select value={f.value} onValueChange={f.onChange}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="w-4 h-4" /> Reset
        </Button>
        <Button size="sm" onClick={onExport} className="bg-gradient-primary text-white shadow-glow">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>
    </div>
  );
}
