export type DateRange = { from: string | null; to: string | null }; // ISO yyyy-mm-dd
export type PresetKey =
  | "all"
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_week"
  | "last_week"
  | "month"
  | "last_month"
  | "quarter"
  | "year"
  | "custom";

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This week" },
  { key: "last_week", label: "Last week" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "quarter", label: "This quarter" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Week starts Monday
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - dow);
  return x;
}

export function rangeFromPreset(key: PresetKey): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case "all":
      return { from: null, to: null };
    case "today":
      return { from: iso(today), to: iso(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: iso(y), to: iso(y) };
    }
    case "this_week": {
      const s = startOfWeek(today);
      return { from: iso(s), to: iso(today) };
    }
    case "last_week": {
      const s = startOfWeek(today);
      const lwEnd = new Date(s);
      lwEnd.setDate(lwEnd.getDate() - 1);
      const lwStart = new Date(lwEnd);
      lwStart.setDate(lwStart.getDate() - 6);
      return { from: iso(lwStart), to: iso(lwEnd) };
    }
    case "7d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 6);
      return { from: iso(f), to: iso(today) };
    }
    case "30d": {
      const f = new Date(today);
      f.setDate(f.getDate() - 29);
      return { from: iso(f), to: iso(today) };
    }
    case "month":
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(today) };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(s), to: iso(e) };
    }
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      return { from: iso(new Date(now.getFullYear(), q * 3, 1)), to: iso(today) };
    }
    case "year":
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(today) };
    default:
      return { from: null, to: null };
  }
}

export function rangeFromMonth(year: number, monthIndex0: number): DateRange {
  const s = new Date(year, monthIndex0, 1);
  const e = new Date(year, monthIndex0 + 1, 0);
  return { from: iso(s), to: iso(e) };
}

export function inRange(dateIso: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!dateIso) return false;
  const d = dateIso.slice(0, 10);
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}
