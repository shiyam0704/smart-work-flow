import type { Session, User } from "@supabase/supabase-js";

export type LocalSession = Session;
export type LocalUser = User;

const KEY = "swf:active-company-id";

export function readActiveCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeActiveCompanyId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(KEY);
    if (current === id) return; // Prevent infinite re-render / cache clear loops
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("swf:active-company-changed"));
  } catch {
    /* ignore */
  }
}