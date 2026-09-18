import { supabase } from "@/integrations/supabase/client";

/**
 * Safely removes files from Supabase storage by using the server-side deletion API route
 * (which uses service role with authenticated user verification), falling back to client storage.
 */
export async function removeStorageFiles(bucket: string, paths: string[]): Promise<boolean> {
  if (!paths || paths.length === 0) return true;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/storage/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ bucket, paths }),
    });

    if (res.ok) {
      return true;
    }
  } catch {
    // Continue to fallback
  }

  // Fallback to client storage remove
  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    return !error;
  } catch {
    return false;
  }
}
