import type { ClientRow, ClientInput } from "@/hooks/use-clients-data";
import type { ClientFieldDefRow } from "@/hooks/use-client-fields";
import { exportRowsAsCsv } from "@/lib/csv";

const BASE_HEADERS = [
  "name",
  "client_group",
  "status",
  "logo_url",
  "address",
  "city",
  "contact_person",
  "contact_number",
  "note",
] as const;

export function exportClientsCsv(
  clients: ClientRow[],
  fields: ClientFieldDefRow[],
  filename = "clients",
) {
  const cfCols = fields
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => ({
      key: `cf_${f.id}`,
      label: f.label,
      value: (r: ClientRow) => {
        const v = (r.custom_fields ?? {})[f.id];
        if (v === undefined || v === null) return "";
        if (typeof v === "boolean") return v ? "yes" : "no";
        return String(v);
      },
    }));

  exportRowsAsCsv(filename, clients, [
    { key: "name", label: "name", value: (r) => r.name },
    { key: "client_group", label: "client_group", value: (r) => r.client_group },
    { key: "status", label: "status", value: (r) => r.status },
    { key: "logo_url", label: "logo_url", value: (r) => (r as any).logo_url ?? "" },
    { key: "address", label: "address", value: (r) => r.address ?? "" },
    { key: "city", label: "city", value: (r) => r.city ?? "" },
    { key: "contact_person", label: "contact_person", value: (r) => r.contact_person ?? "" },
    { key: "contact_number", label: "contact_number", value: (r) => r.contact_number ?? "" },
    { key: "note", label: "note", value: (r) => r.note ?? "" },
    ...cfCols,
  ]);
}

export function clientsCsvTemplate(fields: ClientFieldDefRow[]): string {
  const cfHeaders = fields
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => f.label);
  const headers = [...BASE_HEADERS, ...cfHeaders].map(escape).join(",");
  const sample = [
    "Acme Inc",
    "Enterprise",
    "active",
    "",
    "123 Main St",
    "New York",
    "Jane Doe",
    "+15551234567",
    "",
    ...cfHeaders.map(() => ""),
  ].map(escape).join(",");
  return `${headers}\n${sample}\n`;
}

function escape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

// Minimal RFC-4180-ish parser (handles quoted fields with embedded commas/newlines/escaped quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^\uFEFF/, "");
  while (i < src.length) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ",") { row.push(cur); cur = ""; i++; continue; }
    if (c === "\n" || c === "\r") {
      row.push(cur); cur = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      // consume \r\n as one
      if (c === "\r" && src[i + 1] === "\n") i++;
      i++;
      continue;
    }
    cur += c; i++;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export interface ParsedClientRow {
  input: ClientInput;
  line: number;
  error?: string;
}

export function parseClientsCsv(
  text: string,
  fields: ClientFieldDefRow[],
): { rows: ParsedClientRow[]; headerErrors: string[] } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { rows: [], headerErrors: ["Empty file"] };
  const headers = grid[0].map((h) => h.trim());
  const lowerMap = new Map(headers.map((h, i) => [h.toLowerCase(), i]));
  const cfLabelMap = new Map(fields.map((f) => [f.label.toLowerCase(), f]));

  const idx = (name: string) => lowerMap.get(name.toLowerCase()) ?? -1;
  const headerErrors: string[] = [];
  if (idx("name") === -1) headerErrors.push('Missing required "name" column');

  const validStatus = new Set(["active", "paused", "churned"]);
  const rows: ParsedClientRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const raw = grid[r];
    if (raw.every((c) => c.trim() === "")) continue;
    const get = (name: string) => {
      const i = idx(name);
      return i === -1 ? "" : (raw[i] ?? "").trim();
    };
    const name = get("name");
    if (!name) {
      rows.push({ line: r + 1, input: {} as ClientInput, error: "Missing name" });
      continue;
    }
    const statusRaw = get("status").toLowerCase();
    const status = (validStatus.has(statusRaw) ? statusRaw : "active") as ClientInput["status"];

    const custom_fields: Record<string, unknown> = {};
    for (const [labelLower, def] of cfLabelMap) {
      const i = lowerMap.get(labelLower);
      if (i === undefined) continue;
      const v = (raw[i] ?? "").trim();
      if (v === "") continue;
      if (def.field_type === "number") {
        const n = Number(v);
        if (!Number.isNaN(n)) custom_fields[def.id] = n;
      } else if (def.field_type === "checkbox") {
        custom_fields[def.id] = /^(1|true|yes|y)$/i.test(v);
      } else {
        custom_fields[def.id] = v;
      }
    }

    const input: ClientInput = {
      name,
      client_group: get("client_group") || "Enterprise",
      status,
      logo: "",
      address: get("address"),
      city: get("city"),
      contact_person: get("contact_person"),
      contact_number: get("contact_number"),
      note: get("note"),
      custom_fields,
    };
    const logoUrl = get("logo_url");
    if (logoUrl) (input as any).logo_url = logoUrl;
    rows.push({ line: r + 1, input });
  }

  return { rows, headerErrors };
}