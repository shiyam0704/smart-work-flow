import { type LucideIcon } from "lucide-react";

export function ReportKpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="glass rounded-2xl p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {Icon ? <Icon className="w-4 h-4 text-muted-foreground" /> : null}
      </div>
      <div className="mt-2 font-display text-3xl font-bold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
