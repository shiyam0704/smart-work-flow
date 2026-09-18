import { LayoutGrid, List } from "lucide-react";
import { useEffect, useState } from "react";

export type ViewMode = "grid" | "table";

export function useViewMode(key: string, initial: ViewMode = "grid") {
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return initial;
    return (localStorage.getItem(key) as ViewMode) ?? initial;
  });
  useEffect(() => {
    localStorage.setItem(key, view);
  }, [key, view]);
  return [view, setView] as const;
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const btn = (v: ViewMode, Icon: typeof LayoutGrid, label: string) => (
    <button
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      className={`h-8 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition ${
        value === v
          ? "bg-gradient-primary text-white shadow-glow"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
  return (
    <div className="glass rounded-lg p-1 inline-flex" role="tablist" aria-label="View mode">
      {btn("grid", LayoutGrid, "Grid")}
      {btn("table", List, "Table")}
    </div>
  );
}
