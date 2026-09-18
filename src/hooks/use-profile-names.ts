import { supabase } from "@/integrations/supabase/client";
import { useSharedResource } from "@/lib/shared-cache";

export interface ProfileNameRow {
  id: string;
  full_name: string | null;
}

async function fetchProfileNames(): Promise<ProfileNameRow[]> {
  const { data, error } = await supabase.from("profiles").select("id, full_name");
  if (error) return [];
  return (data ?? []) as ProfileNameRow[];
}

export function useProfileNames() {
  const { data } = useSharedResource<ProfileNameRow[]>("profile-names", fetchProfileNames, {
    staleMs: 60_000,
  });
  const profiles = data ?? [];
  const nameByUserId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    const p = profiles.find((x) => x.id === id);
    return p?.full_name?.trim() || null;
  };
  return { profiles, nameByUserId };
}
