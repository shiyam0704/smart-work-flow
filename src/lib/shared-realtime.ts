import { supabase } from "@/integrations/supabase/client";

type Cleanup = () => void;

interface ChannelEntry {
  channel: ReturnType<typeof supabase.channel>;
  refCount: number;
}

const channels = new Map<string, ChannelEntry>();

/**
 * Subscribe to a singleton supabase realtime channel for one or more tables.
 * Multiple callers share the same channel; the channel is only torn down
 * after the last subscriber unsubscribes.
 */
export function subscribeTables(
  key: string,
  tables: string[],
  onChange: () => void,
): Cleanup {
  let entry = channels.get(key);
  if (!entry) {
    const ch = supabase.channel(`shared-${key}`);
    const callbacks = new Set<() => void>();
    (ch as any).__callbacks = callbacks;
    for (const table of tables) {
      ch.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table } as any,
        () => callbacks.forEach((cb) => cb()),
      );
    }
    ch.subscribe();
    entry = { channel: ch, refCount: 0 };
    channels.set(key, entry);
  }
  const callbacks: Set<() => void> = (entry.channel as any).__callbacks;
  callbacks.add(onChange);
  entry.refCount++;
  return () => {
    callbacks.delete(onChange);
    entry!.refCount--;
    if (entry!.refCount <= 0) {
      supabase.removeChannel(entry!.channel);
      channels.delete(key);
    }
  };
}
