import type { Palette } from "@/components/theme-provider";

export interface ThemePreset {
  id: Palette;
  label: string;
  description: string;
  swatches: { bg: string; card: string; primary: string; accent: string };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "wooden",
    label: "Wooden",
    description: "Warm oak & walnut. Cozy, editorial, high readability.",
    swatches: {
      bg: "oklch(0.980 0.012 82)",
      card: "oklch(0.935 0.020 78)",
      primary: "oklch(0.520 0.110 55)",
      accent: "oklch(0.700 0.120 65)",
    },
  },
  {
    id: "midnight-slate",
    label: "Midnight Slate",
    description: "Cool charcoal with steel-blue accent. Sharp and professional.",
    swatches: {
      bg: "oklch(0.975 0.005 250)",
      card: "oklch(0.935 0.008 250)",
      primary: "oklch(0.520 0.120 245)",
      accent: "oklch(0.620 0.140 235)",
    },
  },
  {
    id: "emerald-prestige",
    label: "Emerald Prestige",
    description: "Deep emerald with a gold accent. Luxury & finance feel.",
    swatches: {
      bg: "oklch(0.978 0.010 130)",
      card: "oklch(0.935 0.018 130)",
      primary: "oklch(0.470 0.120 160)",
      accent: "oklch(0.760 0.140 90)",
    },
  },
  {
    id: "navy-trust",
    label: "Navy Trust",
    description: "Deep navy with azure accent. Enterprise, legal, banking.",
    swatches: {
      bg: "oklch(0.980 0.008 240)",
      card: "oklch(0.935 0.012 240)",
      primary: "oklch(0.360 0.100 265)",
      accent: "oklch(0.650 0.130 235)",
    },
  },
];