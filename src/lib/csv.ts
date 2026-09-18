export type CsvColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => any;
};

function escapeCell(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") v = JSON.stringify(v);
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Convert rows to a CSV string.
 * - With column defs: `toCsv(rows, [{ key, label, value }])`
 * - Without column defs: keys of the first row become headers.
 */
export function toCsv<T extends Record<string, any>>(
  rows: T[],
  columns?: CsvColumn<T>[]
): string {
  if (rows.length === 0) {
    return columns ? columns.map((c) => c.label).join(",") : "";
  }
  const cols: CsvColumn<T>[] =
    columns ??
    Object.keys(rows[0]).map((k) => ({
      key: k,
      label: k,
      value: (r) => (r as any)[k],
    }));
  const lines = [cols.map((c) => escapeCell(c.label)).join(",")];
  for (const r of rows) {
    lines.push(cols.map((c) => escapeCell(c.value(r))).join(","));
  }
  return lines.join("\n");
}

/**
 * Trigger a browser download for a CSV string.
 * `downloadCsv(filename, csvString)`
 */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convenience: build CSV from rows and trigger a download in one call. */
export function exportRowsAsCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns?: CsvColumn<T>[]
) {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = filename.replace(/\.csv$/i, "");
  downloadCsv(`${base}-${stamp}.csv`, toCsv(rows, columns));
}
