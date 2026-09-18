import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSharedResource, mutateCache } from "@/lib/shared-cache";

export interface ClientRow {
  id: string;
  name: string;
  logo: string;
  logo_url?: string | null;
  status: "active" | "paused" | "churned";
  client_group: string;
  address: string;
  city: string;
  contact_person: string;
  contact_number: string;
  note: string;
  custom_fields: Record<string, unknown>;
}


export type ClientInput = Omit<ClientRow, "id" | "logo"> & {
  id?: string;
  logo?: string;
};

function makeLogo(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export const CLIENT_GROUPS = ["Enterprise", "SMB", "Startup", "Agency", "Non-profit"];

const CACHE_KEY = "clients";

async function fetchClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase.from("clients").select("*").order("name");
  if (error) {
    toast.error(`Failed to load clients: ${error.message}`);
    return [];
  }
  return (data ?? []).map((c: any) => ({
    ...c,
    address: c.address ?? "",
    city: c.city ?? "",
    contact_person: c.contact_person ?? "",
    contact_number: c.contact_number ?? "",
    note: c.note ?? "",
    custom_fields: c.custom_fields ?? {},
    logo_url: c.logo_url ?? null,
  })) as ClientRow[];
}

export function useClientsData() {
  const { data, loading, reload } = useSharedResource<ClientRow[]>(
    CACHE_KEY,
    fetchClients,
    { eventName: "clients:changed" },
  );
  const clients = data ?? [];

  const buildPayload = (input: ClientInput) => ({
    name: input.name,
    logo: input.logo || makeLogo(input.name),
    logo_url: input.logo_url ?? null,
    status: input.status,
    client_group: input.client_group,
    address: input.address ?? "",
    city: input.city ?? "",
    contact_person: input.contact_person ?? "",
    contact_number: input.contact_number ?? "",
    note: input.note ?? "",
    custom_fields: input.custom_fields ?? {},
  });


  const addClient = async (input: ClientInput) => {
    const { data, error } = await supabase.from("clients").insert(buildPayload(input) as any).select().single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    await reload();
    toast.success("Client added");
    return data.id as string;
  };

  const updateClient = async (id: string, input: ClientInput) => {
    const { error } = await supabase.from("clients").update(buildPayload(input) as any).eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await reload();
    toast.success("Client updated");
    return true;
  };

  const getClient = (id: string) => clients.find((c) => c.id === id);

  const deleteClient = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    mutateCache<ClientRow[]>(CACHE_KEY, (list) => list.filter((c) => c.id !== id));
    window.dispatchEvent(new Event("clients:changed"));
    toast.success("Client deleted");
    return true;
  };

  const bulkAddClients = async (inputs: ClientInput[]) => {
    if (inputs.length === 0) return { inserted: 0, failed: 0 };
    const payloads = inputs.map(buildPayload);
    let inserted = 0;
    let failed = 0;
    const chunkSize = 100;
    for (let i = 0; i < payloads.length; i += chunkSize) {
      const chunk = payloads.slice(i, i + chunkSize);
      const { data, error } = await supabase.from("clients").insert(chunk as any).select();
      if (error) {
        failed += chunk.length;
      } else {
        inserted += data?.length ?? chunk.length;
      }
    }
    await reload();
    if (inserted > 0) toast.success(`${inserted} client${inserted === 1 ? "" : "s"} imported`);
    if (failed > 0) toast.error(`${failed} row${failed === 1 ? "" : "s"} failed to import`);
    return { inserted, failed };
  };

  return { clients, loading, addClient, updateClient, deleteClient, getClient, reload, bulkAddClients };
}
