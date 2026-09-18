import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FieldType } from "@/lib/field-types";

export interface ClientFieldDefRow {
  id: string;
  label: string;
  field_type: FieldType;
  options: string[] | null;
  required: boolean;
  sort_order: number;
}

const EVENT = "client-fields:changed";
const emit = () => window.dispatchEvent(new Event(EVENT));

export function useClientFields() {
  const [fields, setFields] = useState<ClientFieldDefRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_field_definitions" as any)
      .select("*")
      .order("sort_order");
    if (error) toast.error(`Failed to load client fields: ${error.message}`);
    else
      setFields(
        (data ?? []).map((f: any) => ({
          ...f,
          options: Array.isArray(f.options) ? f.options : f.options ?? null,
        })) as ClientFieldDefRow[],
      );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener(EVENT, handler);
    const channel = supabase
      .channel(`client-fields-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_field_definitions" },
        () => load(),
      )
      .subscribe();
    return () => {
      window.removeEventListener(EVENT, handler);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const addField = async (input: {
    label: string;
    field_type: FieldType;
    required: boolean;
    options: string[] | null;
  }) => {
    const sort_order = fields.length;
    const { error } = await supabase
      .from("client_field_definitions" as any)
      .insert({ ...input, sort_order });
    if (error) return toast.error(error.message);
    toast.success("Field added");
    emit();
  };
  const updateField = async (
    id: string,
    patch: Partial<Pick<ClientFieldDefRow, "label" | "field_type" | "required" | "options">>,
  ) => {
    const { error } = await supabase
      .from("client_field_definitions" as any)
      .update(patch)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    emit();
  };
  const deleteField = async (id: string) => {
    const { error } = await supabase
      .from("client_field_definitions" as any)
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    emit();
  };
  const moveField = async (id: string, dir: -1 | 1) => {
    const sorted = [...fields].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    const f = sorted[idx];
    await Promise.all([
      supabase
        .from("client_field_definitions" as any)
        .update({ sort_order: swap.sort_order })
        .eq("id", f.id),
      supabase
        .from("client_field_definitions" as any)
        .update({ sort_order: f.sort_order })
        .eq("id", swap.id),
    ]);
    emit();
  };

  return { fields, loading, reload: load, addField, updateField, deleteField, moveField };
}
