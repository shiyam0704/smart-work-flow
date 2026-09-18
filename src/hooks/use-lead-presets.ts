import { useEffect, useState, useCallback } from "react";

export interface LeadPresetConfig {
  query?: string;
  employeeFilter?: string;
  age?: string;
  rangeFrom?: string | null;
  rangeTo?: string | null;
  view?: "kanban" | "list" | "calendar";
  calendarMode?: "month" | "week" | "agenda";
}

export interface LeadPreset {
  id: string;
  name: string;
  config: LeadPresetConfig;
  is_default: boolean;
  created_at: string;
}

const KEY = "swf-lead-presets-v1";

function read(): LeadPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LeadPreset[]) : [];
  } catch {
    return [];
  }
}

function write(items: LeadPreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("lead-presets:changed"));
}

export function useLeadPresets() {
  const [presets, setPresets] = useState<LeadPreset[]>(() => read());

  useEffect(() => {
    const h = () => setPresets(read());
    window.addEventListener("lead-presets:changed", h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener("lead-presets:changed", h);
      window.removeEventListener("storage", h);
    };
  }, []);

  const save = useCallback((name: string, config: LeadPresetConfig) => {
    const item: LeadPreset = {
      id: `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      name: name.trim(),
      config,
      is_default: false,
      created_at: new Date().toISOString(),
    };
    write([...read(), item]);
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((p) => p.id !== id));
  }, []);

  const rename = useCallback((id: string, name: string) => {
    write(read().map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
  }, []);

  const setDefault = useCallback((id: string | null) => {
    write(read().map((p) => ({ ...p, is_default: p.id === id })));
  }, []);

  return { presets, save, remove, rename, setDefault };
}