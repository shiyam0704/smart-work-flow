import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type Palette = "wooden" | "midnight-slate" | "emerald-prestige" | "navy-trust";
export type ColorMode = "single" | "dual";
const STORAGE_KEY = "sm-theme";
const PALETTE_KEY = "sm-palette";
const COLOR_MODE_KEY = "sm-color-mode";
const CONTRAST_KEY = "sm-contrast";
const DEFAULT_PALETTE: Palette = "wooden";
const DEFAULT_COLOR_MODE: ColorMode = "dual";

type Ctx = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
  palette: Palette;
  setPalette: (p: Palette) => void;
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
};

const ThemeContext = createContext<Ctx | undefined>(undefined);

function getSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? getSystem() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

function applyPalette(p: Palette) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = p;
}

function applyColorMode(m: ColorMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.colorMode = m;
}

function applyContrast(v: boolean) {
  if (typeof document === "undefined") return;
  if (v) document.documentElement.dataset.contrast = "high";
  else delete document.documentElement.dataset.contrast;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
  });
  const [palette, setPaletteState] = useState<Palette>(() => {
    if (typeof window === "undefined") return DEFAULT_PALETTE;
    return (localStorage.getItem(PALETTE_KEY) as Palette | null) ?? DEFAULT_PALETTE;
  });
  const [colorMode, setColorModeState] = useState<ColorMode>(() => {
    if (typeof window === "undefined") return DEFAULT_COLOR_MODE;
    return (localStorage.getItem(COLOR_MODE_KEY) as ColorMode | null) ?? DEFAULT_COLOR_MODE;
  });
  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(CONTRAST_KEY) === "1";
  });
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() =>
    theme === "system" ? getSystem() : theme,
  );

  useEffect(() => {
    applyTheme(theme);
    setResolvedTheme(theme === "system" ? getSystem() : theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyTheme("system");
      setResolvedTheme(getSystem());
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    applyPalette(palette);
  }, [palette]);

  useEffect(() => {
    applyColorMode(colorMode);
  }, [colorMode]);

  useEffect(() => {
    applyContrast(highContrast);
  }, [highContrast]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  const setPalette = (p: Palette) => {
    localStorage.setItem(PALETTE_KEY, p);
    setPaletteState(p);
  };

  const setColorMode = (m: ColorMode) => {
    localStorage.setItem(COLOR_MODE_KEY, m);
    setColorModeState(m);
  };

  const setHighContrast = (v: boolean) => {
    localStorage.setItem(CONTRAST_KEY, v ? "1" : "0");
    setHighContrastState(v);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        palette,
        setPalette,
        colorMode,
        setColorMode,
        highContrast,
        setHighContrast,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
