// Format numbers as Indian Rupees (INR)
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(value: number): string {
  return inr.format(value);
}

// -----------------------------------------------------------------------------
// Company-aware date & time formatting
// -----------------------------------------------------------------------------

type DateFormat = "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd" | "d MMM yyyy";
type TimeFormat = "12h" | "24h";

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string; sample: string }[] = [
  { value: "dd/MM/yyyy", label: "15/01/2026 (dd/MM/yyyy)", sample: "15/01/2026" },
  { value: "MM/dd/yyyy", label: "01/15/2026 (MM/dd/yyyy)", sample: "01/15/2026" },
  { value: "yyyy-MM-dd", label: "2026-01-15 (yyyy-MM-dd)", sample: "2026-01-15" },
  { value: "d MMM yyyy", label: "15 Jan 2026 (d MMM yyyy)", sample: "15 Jan 2026" },
];

export const TIME_FORMAT_OPTIONS: { value: TimeFormat; label: string }[] = [
  { value: "12h", label: "02:30 PM (12-hour)" },
  { value: "24h", label: "14:30 (24-hour)" },
];

function partsInTZ(d: Date, timezone: string): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) if (p.type !== "literal") map[p.type] = p.value;
  return map;
}

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function formatDate(
  value: string | number | Date,
  fmt: DateFormat = "dd/MM/yyyy",
  timezone = "Asia/Kolkata",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = partsInTZ(d, timezone);
  const dd = p.day, MM = p.month, yyyy = p.year;
  const monthIdx = Math.max(0, Math.min(11, Number(MM) - 1));
  switch (fmt) {
    case "MM/dd/yyyy": return `${MM}/${dd}/${yyyy}`;
    case "yyyy-MM-dd": return `${yyyy}-${MM}-${dd}`;
    case "d MMM yyyy": return `${Number(dd)} ${MONTHS_SHORT[monthIdx]} ${yyyy}`;
    case "dd/MM/yyyy":
    default:           return `${dd}/${MM}/${yyyy}`;
  }
}

export function formatTime(
  value: string | number | Date,
  fmt: TimeFormat = "12h",
  timezone = "Asia/Kolkata",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit", minute: "2-digit",
    hour12: fmt === "12h",
  });
  return dtf.format(d).replace(/\s+/g, " ").trim();
}

export function formatDateTime(
  value: string | number | Date,
  dateFmt: DateFormat = "dd/MM/yyyy",
  timeFmt: TimeFormat = "12h",
  timezone = "Asia/Kolkata",
): string {
  return `${formatDate(value, dateFmt, timezone)} ${formatTime(value, timeFmt, timezone)}`;
}

export function todayLocalDate(timezone = "Asia/Kolkata"): string {
  const p = partsInTZ(new Date(), timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function isFutureLocalDate(dateStr: string, timezone = "Asia/Kolkata"): boolean {
  if (!dateStr) return false;
  const today = todayLocalDate(timezone);
  return dateStr > today;
}

