import { useEffect, useState, useCallback, useRef } from "react";
import { readActiveCompanyId } from "./active-company";
import { supabase } from "@/integrations/supabase/client";

type Updater<T> = (prev: T) => T;

interface Entry<T> {
  data: T | undefined;
  loaded: boolean;
  inflight: Promise<T> | null;
  subs: Set<(d: T) => void>;
}

// In-memory store for client-side execution.
// In SSR (typeof window === "undefined"), a new Map is created per invocation to avoid cross-request leakage (BUG #44).
let clientStore = new Map<string, Entry<any>>();
let clientLastFetched = new Map<string, number>();

const GLOBAL_KEYS = new Set(["companies", "profile", "user_profile", "active-company"]);

export function getScopedKey(key: string): string {
  if (GLOBAL_KEYS.has(key)) return key;
  const companyId = readActiveCompanyId();
  return companyId ? `${companyId}:${key}` : key;
}

function getStore(): { store: Map<string, Entry<any>>; lastFetched: Map<string, number> } {
  if (typeof window === "undefined") {
    return { store: new Map(), lastFetched: new Map() };
  }
  return { store: clientStore, lastFetched: clientLastFetched };
}

function getEntry<T>(rawKey: string): Entry<T> {
  const key = getScopedKey(rawKey);
  const { store } = getStore();
  let e = store.get(key);
  if (!e) {
    e = { data: undefined, loaded: false, inflight: null, subs: new Set() };
    store.set(key, e);
  }
  return e as Entry<T>;
}

export function clearAllCache() {
  const { store, lastFetched } = getStore();
  store.clear();
  lastFetched.clear();
}

if (typeof window !== "undefined") {
  // Clear cache only on explicit auth logout to prevent session bleed across users
  window.addEventListener("swf:auth-changed", () => clearAllCache());
  try {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        clearAllCache();
      }
    });
  } catch {
    /* ignore during early initialization */
  }
}

export function mutateCache<T>(key: string, updater: Updater<T>) {
  const e = getEntry<T>(key);
  if (!e.loaded || e.data === undefined) return;
  e.data = updater(e.data);
  e.subs.forEach((cb) => cb(e.data as T));
}

export function setCache<T>(key: string, data: T) {
  const e = getEntry<T>(key);
  e.data = data;
  e.loaded = true;
  e.subs.forEach((cb) => cb(data));
}

export function invalidateCache(rawKey: string) {
  const key = getScopedKey(rawKey);
  const { store } = getStore();
  const e = store.get(key);
  if (e) {
    e.loaded = false;
    e.inflight = null;
  }
}

/**
 * Shared list cache hook. Returns cached data instantly across mounts,
 * dedupes concurrent fetches, and refetches in the background on remount
 * if data is stale (older than `staleMs`).
 */
export function useSharedResource<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: { staleMs?: number; eventName?: string } = {},
) {
  const { staleMs = 30_000, eventName } = options;
  const [activeCompanyId, setActiveCompanyId] = useState(() => readActiveCompanyId());

  useEffect(() => {
    const handleCompanyChange = () => {
      setActiveCompanyId(readActiveCompanyId());
    };
    window.addEventListener("swf:active-company-changed", handleCompanyChange);
    return () => {
      window.removeEventListener("swf:active-company-changed", handleCompanyChange);
    };
  }, []);

  const scopedKey = getScopedKey(key);
  const entry = getEntry<T>(key);
  const [data, setData] = useState<T | undefined>(entry.data);
  const [loading, setLoading] = useState<boolean>(!entry.loaded);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(
    (force: boolean) => {
      const e = getEntry<T>(key);
      const now = Date.now();
      const { lastFetched } = getStore();
      const fresh = (lastFetched.get(scopedKey) ?? 0) + staleMs > now;
      if (!force && e.loaded && fresh) return Promise.resolve(e.data as T);
      if (e.inflight) return e.inflight;
      const p = fetcherRef
        .current()
        .then((d) => {
          e.data = d;
          e.loaded = true;
          getStore().lastFetched.set(scopedKey, Date.now());
          e.subs.forEach((cb) => cb(d));
          return d;
        })
        .finally(() => {
          e.inflight = null;
        });
      e.inflight = p;
      return p;
    },
    [key, scopedKey, staleMs],
  );

  useEffect(() => {
    const e = getEntry<T>(key);
    const sub = (d: T) => {
      setData(d);
      setLoading(false);
    };
    e.subs.add(sub);
    if (e.loaded) {
      setData(e.data);
      setLoading(false);
      // background revalidate if stale
      const { lastFetched } = getStore();
      const fresh = (lastFetched.get(scopedKey) ?? 0) + staleMs > Date.now();
      if (!fresh) doFetch(false);
    } else {
      doFetch(false).catch(() => setLoading(false));
    }
    let evHandler: (() => void) | null = null;
    if (eventName) {
      evHandler = () => doFetch(true);
      window.addEventListener(eventName, evHandler);
    }
    return () => {
      e.subs.delete(sub);
      if (eventName && evHandler) window.removeEventListener(eventName, evHandler);
    };
  }, [key, scopedKey, doFetch, eventName, staleMs]);

  const reload = useCallback(() => doFetch(true), [doFetch]);

  return { data, loading, reload };
}
