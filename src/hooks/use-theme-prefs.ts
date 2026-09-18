import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  useTheme,
  type Theme,
  type Palette,
  type ColorMode,
} from "@/components/theme-provider";

interface ThemePrefs {
  theme?: Theme;
  palette?: Palette;
  colorMode?: ColorMode;
  highContrast?: boolean;
}

/**
 * Load the signed-in user's appearance from `profiles.theme_prefs` after login,
 * and persist any change back to their profile. localStorage still stores the
 * last-known values so the pre-hydration script in __root.tsx can apply them
 * before React mounts, avoiding a flash.
 */
export function useThemePrefs() {
  const { user } = useAuth();
  const {
    theme,
    setTheme,
    palette,
    setPalette,
    colorMode,
    setColorMode,
    highContrast,
    setHighContrast,
  } = useTheme();

  const hydratedFor = useRef<string | null>(null);
  const hydratingRef = useRef(false);

  // Load from profile once per signed-in user.
  useEffect(() => {
    if (!user?.id) {
      hydratedFor.current = null;
      return;
    }
    if (hydratedFor.current === user.id) return;
    hydratedFor.current = user.id;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("theme_prefs")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || error) return;
        const prefs = (data as any)?.theme_prefs as ThemePrefs | null | undefined;
        if (!prefs) return;
        hydratingRef.current = true;
        if (prefs.theme) setTheme(prefs.theme);
        if (prefs.palette) setPalette(prefs.palette);
        if (prefs.colorMode) setColorMode(prefs.colorMode);
        if (typeof prefs.highContrast === "boolean") setHighContrast(prefs.highContrast);
        // Release the guard on the next tick so the resulting state changes
        // don't immediately write back to the profile.
        setTimeout(() => {
          hydratingRef.current = false;
        }, 0);
      } catch {
        // Silently ignore if profiles table/column is not yet configured
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, setTheme, setPalette, setColorMode, setHighContrast]);

  // Persist to profile whenever appearance changes (skips the initial hydration).
  useEffect(() => {
    if (!user?.id) return;
    if (hydratingRef.current) return;
    if (hydratedFor.current !== user.id) return;
    const t = window.setTimeout(async () => {
      try {
        await supabase
          .from("profiles")
          .update({ theme_prefs: { theme, palette, colorMode, highContrast } } as any)
          .eq("id", user.id);
      } catch {
        // Silently ignore
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [user?.id, theme, palette, colorMode, highContrast]);
}