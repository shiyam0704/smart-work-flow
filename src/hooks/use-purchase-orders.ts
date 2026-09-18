import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, invalidateCache } from "@/lib/shared-cache";
import { subscribeTables } from "@/lib/shared-realtime";
import { computeDocument } from "@/lib/invoice-calc";

export type POStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export const PO_STATUS_META: Record<POStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground border-border" },
  pending_approval: { label: "Pending approval", cls: "bg-warning/20 text-warning border-warning/30" },
  approved: { label: "Approved", cls: "bg-info/20 text-info border-info/30" },
  ordered: { label: "Ordered", cls: "bg-info/20 text-info border-info/30" },
  partially_received: { label: "Partly received", cls: "bg-warning/20 text-warning border-warning/30" },
  received: { label: "Received", cls: "bg-success/20 text-success border-success/30" },
  cancelled: { label: "Cancelled", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

export interface POItemRow {
  id?: string;
  item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  gst_percent: number;
  taxable_amount: number;
  tax_amount: number;
  line_total: number;
  received_quantity: number;
  sort_order: number;
}

export interface POItemInput {
  id?: string;
  item_id: string | null;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  discount_percent: number;
  gst_percent: number;
  received_quantity?: number;
}

export interface PurchaseOrderRow {
  id: string;
  po_no: string;
  supplier_id: string | null;
  po_date: string;
  expected_date: string | null;
  location_id: string | null;
  status: POStatus;
  is_interstate: boolean;
  notes: string;
  terms: string;
  subtotal: number;
  discount_total: number;
  cgst_total: number;
  sgst_total: number;
  igst_total: number;
  round_off: number;
  grand_total: number;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  items: POItemRow[];
}

export interface PurchaseOrderInput {
  po_no?: string;
  supplier_id: string | null;
  po_date: string;
  expected_date: string | null;
  location_id: string | null;
  status: POStatus;
  is_interstate: boolean;
  notes: string;
  terms: string;
  items: POItemInput[];
}

export interface ReceiptItemRow {
  id: string;
  receipt_id: string;
  purchase_order_item_id: string | null;
  item_id: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  sort_order: number;
}

export interface PurchaseReceiptRow {
  id: string;
  purchase_order_id: string | null;
  supplier_id: string | null;
  location_id: string | null;
  receipt_date: string;
  bill_no: string;
  bill_date: string | null;
  notes: string;
  total_value: number;
  created_at: string;
  items: ReceiptItemRow[];
}

const KEY = "purchase_orders";
const EVENT = "purchase-orders:changed";
const R_KEY = "purchase_receipts";
const R_EVENT = "purchase-receipts:changed";

const num = (v: any) => Number(v ?? 0);

async function fetchOrders(): Promise<PurchaseOrderRow[]> {
  const [{ data: docs, error }, { data: items }] = await Promise.all([
    supabase.from("purchase_orders" as any).select("*").order("po_date", { ascending: false }),
    supabase.from("purchase_order_items" as any).select("*").order("sort_order"),
  ]);
  if (error) {
    toast.error(`Failed to load purchase orders: ${error.message}`);
    return [];
  }
  const byDoc = new Map<string, POItemRow[]>();
  for (const it of (items ?? []) as any[]) {
    const row: POItemRow = {
      id: it.id,
      item_id: it.item_id,
      description: it.description ?? "",
      unit: it.unit ?? "Nos",
      quantity: num(it.quantity),
      rate: num(it.rate),
      discount_percent: num(it.discount_percent),
      gst_percent: num(it.gst_percent),
      taxable_amount: num(it.taxable_amount),
      tax_amount: num(it.tax_amount),
      line_total: num(it.line_total),
      received_quantity: num(it.received_quantity),
      sort_order: it.sort_order ?? 0,
    };
    const list = byDoc.get(it.purchase_order_id);
    if (list) list.push(row);
    else byDoc.set(it.purchase_order_id, [row]);
  }
  return ((docs ?? []) as any[]).map((d) => ({
    ...d,
    subtotal: num(d.subtotal),
    discount_total: num(d.discount_total),
    cgst_total: num(d.cgst_total),
    sgst_total: num(d.sgst_total),
    igst_total: num(d.igst_total),
    round_off: num(d.round_off),
    grand_total: num(d.grand_total),
    items: byDoc.get(d.id) ?? [],
  })) as PurchaseOrderRow[];
}

async function fetchReceipts(): Promise<PurchaseReceiptRow[]> {
  const [{ data: docs }, { data: items }] = await Promise.all([
    supabase.from("purchase_receipts" as any).select("*").order("receipt_date", { ascending: false }),
    supabase.from("purchase_receipt_items" as any).select("*").order("sort_order"),
  ]);
  const byDoc = new Map<string, ReceiptItemRow[]>();
  for (const it of (items ?? []) as any[]) {
    const row: ReceiptItemRow = {
      id: it.id,
      receipt_id: it.receipt_id,
      purchase_order_item_id: it.purchase_order_item_id,
      item_id: it.item_id,
      description: it.description ?? "",
      quantity: num(it.quantity),
      rate: num(it.rate),
      amount: num(it.amount),
      sort_order: it.sort_order ?? 0,
    };
    const list = byDoc.get(row.receipt_id);
    if (list) list.push(row);
    else byDoc.set(row.receipt_id, [row]);
  }
  return ((docs ?? []) as any[]).map((d) => ({
    ...d,
    total_value: num(d.total_value),
    items: byDoc.get(d.id) ?? [],
  })) as PurchaseReceiptRow[];
}

function docPayload(input: PurchaseOrderInput) {
  const { lines, totals } = computeDocument(
    input.items.map((i) => ({
      description: i.description,
      hsn_sac: "",
      unit: i.unit,
      quantity: i.quantity,
      rate: i.rate,
      discount_percent: i.discount_percent,
      gst_percent: i.gst_percent,
    })),
    { isInterstate: input.is_interstate, roundOff: true },
  );
  return {
    header: {
      supplier_id: input.supplier_id,
      po_date: input.po_date,
      expected_date: input.expected_date,
      location_id: input.location_id,
      status: input.status,
      is_interstate: input.is_interstate,
      notes: input.notes,
      terms: input.terms,
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      cgst_total: totals.cgst_total,
      sgst_total: totals.sgst_total,
      igst_total: totals.igst_total,
      round_off: totals.round_off,
      grand_total: totals.grand_total,
    },
    lines: lines.map((l, idx) => ({
      id: input.items[idx]?.id,
      item_id: input.items[idx]?.item_id ?? null,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      rate: l.rate,
      discount_percent: l.discount_percent,
      gst_percent: l.gst_percent,
      taxable_amount: l.taxable_amount,
      tax_amount: l.tax_amount,
      line_total: l.line_total,
      sort_order: idx,
      received_quantity: input.items[idx]?.received_quantity ?? 0,
    })),
  };
}

export function usePurchaseOrders() {
  const { data, loading, reload } = useSharedResource<PurchaseOrderRow[]>(KEY, fetchOrders, { eventName: EVENT });
  const receipts = useSharedResource<PurchaseReceiptRow[]>(R_KEY, fetchReceipts, { eventName: R_EVENT });

  useEffect(() => {
    return subscribeTables("purchase_orders", ["purchase_orders", "purchase_order_items"], () => {
      invalidateCache(KEY);
      reload();
    });
  }, [reload]);

  const refresh = async () => {
    invalidateCache(KEY);
    invalidateCache(R_KEY);
    await Promise.all([reload(), receipts.reload()]);
    window.dispatchEvent(new Event(EVENT));
    window.dispatchEvent(new Event(R_EVENT));
  };

  const nextNumber = async () => {
    try {
      const { data: no, error } = await supabase.rpc("next_document_number" as any, { _doc_type: "purchase_order" });
      if (!error && no) {
        return no as unknown as string;
      }
    } catch {
      // Fallback below
    }

    // Resilient fallback when database series check constraint is pending migration
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const fyYear = month < 4 ? now.getFullYear() - 1 : now.getFullYear();
      const prefix = `PO-${fyYear}-`;
      const { data } = await supabase
        .from("purchase_orders" as any)
        .select("po_no")
        .ilike("po_no", `${prefix}%`)
        .order("created_at", { ascending: false })
        .limit(100);
      let maxNum = 0;
      for (const r of (data ?? []) as any[]) {
        const match = String(r.po_no || "").match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
      return `${prefix}${String(maxNum + 1).padStart(3, "0")}`;
    } catch {
      return `PO-${Date.now().toString().slice(-6)}`;
    }
  };

  const createOrder = async (input: PurchaseOrderInput) => {
    const po_no = input.po_no || (await nextNumber());
    if (!po_no) return null;
    const { header, lines } = docPayload(input);
    const { data: row, error } = await supabase
      .from("purchase_orders" as any)
      .insert({ ...header, po_no } as any)
      .select("id")
      .single();
    if (error) { toast.error(error.message); return null; }
    const id = (row as any).id as string;
    if (lines.length) {
      const { error: e2 } = await supabase
        .from("purchase_order_items" as any)
        .insert(lines.map((l) => ({ ...l, purchase_order_id: id, received_quantity: 0 })) as any);
      if (e2) toast.error(e2.message);
    }
    toast.success(`Purchase order ${po_no} created`);
    await refresh();
    return id;
  };

  const updateOrder = async (id: string, input: PurchaseOrderInput) => {
    const { header, lines } = docPayload(input);

    // Fetch existing lines to preserve received_quantity and validate edits (BUG #2)
    const { data: existingData, error: fetchErr } = await supabase
      .from("purchase_order_items" as any)
      .select("*")
      .eq("purchase_order_id", id);
    if (fetchErr) {
      toast.error(fetchErr.message);
      return false;
    }
    const existingList = (existingData ?? []) as any[];
    const existingMap = new Map(existingList.map((it) => [it.id, it]));

    // Validate that ordered quantity is not reduced below already received quantity
    for (const line of lines) {
      if (line.id && existingMap.has(line.id)) {
        const existing = existingMap.get(line.id);
        const received = Number(existing.received_quantity || 0);
        if (line.quantity < received) {
          toast.error(`Cannot reduce ordered quantity for "${line.description}" below received (${received})`);
          return false;
        }
      }
    }

    // Check for removed items that were already partially received
    const incomingIds = new Set(lines.filter((l) => l.id).map((l) => l.id));
    for (const existing of existingList) {
      if (!incomingIds.has(existing.id) && Number(existing.received_quantity || 0) > 0) {
        toast.error(`Cannot remove "${existing.description}" because goods have already been received against it`);
        return false;
      }
    }

    // Update header
    const { error } = await supabase.from("purchase_orders" as any).update(header as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }

    // Remove deleted items with 0 received quantity
    for (const existing of existingList) {
      if (!incomingIds.has(existing.id)) {
        await supabase.from("purchase_order_items" as any).delete().eq("id", existing.id);
      }
    }

    // Update existing items preserving received_quantity, or insert new items
    for (const line of lines) {
      if (line.id && existingMap.has(line.id)) {
        const existing = existingMap.get(line.id);
        const { id: itemId, ...itemData } = line;
        await supabase
          .from("purchase_order_items" as any)
          .update({
            ...itemData,
            received_quantity: existing.received_quantity ?? 0,
          })
          .eq("id", itemId);
      } else {
        const { id: _ignore, ...itemData } = line;
        await supabase
          .from("purchase_order_items" as any)
          .insert({
            ...itemData,
            purchase_order_id: id,
            received_quantity: 0,
          });
      }
    }

    toast.success("Purchase order updated");
    await refresh();
    return true;
  };

  const setStatus = async (id: string, status: POStatus) => {
    const { error } = await supabase.from("purchase_orders" as any).update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    await refresh();
    return true;
  };

  const approveOrder = async (id: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("purchase_orders" as any)
      .update({ status: "approved", approved_by: auth.user?.id ?? null, approved_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Purchase order approved");
    await refresh();
    return true;
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from("purchase_orders" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Purchase order deleted");
    await refresh();
    return true;
  };

  /** Record a goods receipt against a PO: creates stock-in movements and updates PO status. */
  const receiveOrder = async (
    order: PurchaseOrderRow,
    input: {
      receipt_date: string;
      bill_no: string;
      bill_date: string | null;
      location_id: string | null;
      notes: string;
      lines: { po_item_id: string; item_id: string | null; description: string; quantity: number; rate: number }[];
    },
  ) => {
    // Validate PO is receivable (BUG #42)
    if (order.status === "cancelled" || order.status === "draft") {
      toast.error(`Cannot receive goods against a ${order.status} purchase order`);
      return false;
    }

    const remainingByItem = new Map(
      order.items.map((i) => [i.id ?? "", Math.max(0, i.quantity - i.received_quantity)] as const),
    );
    const overLine = input.lines.find(
      (l) => l.quantity > (remainingByItem.get(l.po_item_id) ?? 0) + 0.0001,
    );
    if (overLine) {
      toast.error(`Cannot receive more than ordered for "${overLine.description || "item"}"`);
      return false;
    }
    const lines = input.lines.filter((l) => l.quantity > 0);
    if (!lines.length) { toast.error("Enter at least one received quantity"); return false; }

    // Factor in GST percent to reconcile with PO grand total and payables (BUG #20)
    const total = lines.reduce((s, l) => {
      const poItem = order.items.find((it) => it.id === l.po_item_id);
      const gstPct = poItem?.gst_percent ?? 0;
      const lineGross = l.quantity * l.rate;
      const lineGst = (lineGross * gstPct) / 100;
      return s + lineGross + lineGst;
    }, 0);
    const { data: auth } = await supabase.auth.getUser();

    const { data: rec, error } = await supabase
      .from("purchase_receipts" as any)
      .insert({
        purchase_order_id: order.id,
        supplier_id: order.supplier_id,
        location_id: input.location_id ?? order.location_id,
        receipt_date: input.receipt_date,
        bill_no: input.bill_no,
        bill_date: input.bill_date,
        notes: input.notes,
        total_value: Math.round(total * 100) / 100,
        created_by: auth.user?.id ?? null,
      } as any)
      .select("id")
      .single();
    if (error) { toast.error(error.message); return false; }
    const receiptId = (rec as any).id as string;

    const { error: e2 } = await supabase.from("purchase_receipt_items" as any).insert(
      lines.map((l, idx) => ({
        receipt_id: receiptId,
        purchase_order_item_id: l.po_item_id,
        item_id: l.item_id,
        description: l.description,
        quantity: l.quantity,
        rate: l.rate,
        amount: l.quantity * l.rate,
        sort_order: idx,
      })) as any,
    );
    if (e2) toast.error(e2.message);

    // stock-in movements
    const movements = lines
      .filter((l) => l.item_id)
      .map((l) => ({
        item_id: l.item_id,
        location_id: input.location_id ?? order.location_id,
        movement_type: "in",
        quantity: l.quantity,
        rate: l.rate,
        reference_type: "purchase_receipt",
        reference_id: receiptId,
        note: input.bill_no ? `Bill ${input.bill_no}` : "",
        moved_on: input.receipt_date,
        created_by: auth.user?.id ?? null,
      }));
    if (movements.length) {
      const { error: e3 } = await supabase.from("stock_movements" as any).insert(movements as any);
      if (e3) toast.error(e3.message);
    }

    // update received quantities + status
    let allDone = true;
    for (const poItem of order.items) {
      const got = lines.find((l) => l.po_item_id === poItem.id)?.quantity ?? 0;
      const received = poItem.received_quantity + got;
      if (got > 0 && poItem.id) {
        await supabase.from("purchase_order_items" as any).update({ received_quantity: received } as any).eq("id", poItem.id);
      }
      if (received + 0.0001 < poItem.quantity) allDone = false;
    }
    await supabase
      .from("purchase_orders" as any)
      .update({ status: allDone ? "received" : "partially_received" } as any)
      .eq("id", order.id);

    toast.success("Goods received and added to stock");
    await refresh();
    invalidateCache("stock_movements");
    invalidateCache("stock_items");
    window.dispatchEvent(new Event("stock-movements:changed"));
    window.dispatchEvent(new Event("stock-items:changed"));
    return true;
  };

  return {
    orders: data ?? [],
    receipts: receipts.data ?? [],
    loading,
    createOrder,
    updateOrder,
    approveOrder,
    setStatus,
    deleteOrder,
    receiveOrder,
    reload: refresh,
  };
}
