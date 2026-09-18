import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Palette as PaletteIcon,
  Sun,
  Moon,
  Monitor,
  Circle,
  CircleDashed,
  Contrast,
} from "lucide-react";
import { useTheme, type Palette, type ColorMode } from "@/components/theme-provider";
import { THEME_PRESETS } from "@/lib/themes";
import { RoleGuard } from "@/components/app/RoleGuard";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/c/$slug/_app/settings/appearance")({
  component: AppearancePage,
  head: () => ({ meta: [{ title: "Appearance — Smart Work Flow" }] }),
});

function AppearancePage() {
  return (
    <RoleGuard permission="settings.appearance">
      <AppearanceInner />
    </RoleGuard>
  );
}

function AppearanceInner() {
  const {
    palette,
    setPalette,
    theme,
    setTheme,
    colorMode,
    setColorMode,
    highContrast,
    setHighContrast,
  } = useTheme();

  function choose(p: Palette) {
    setPalette(p);
    toast.success(`Theme switched to ${THEME_PRESETS.find((t) => t.id === p)?.label}`);
  }

  function chooseMode(m: ColorMode) {
    setColorMode(m);
    toast.success(`Color system set to ${m === "single" ? "Single" : "Dual"}`);
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <header className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-gradient-primary text-primary-foreground grid place-items-center shadow-glow">
          <PaletteIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-semibold">Appearance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a premium theme for the whole workspace. Choose light, dark, or match the system.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Mode</h2>
        <div className="inline-flex rounded-xl glass p-1">
          {[
            { id: "light", label: "Light", Icon: Sun },
            { id: "dark", label: "Dark", Icon: Moon },
            { id: "system", label: "System", Icon: Monitor },
          ].map(({ id, label, Icon }) => {
            const active = theme === id;
            return (
              <button
                key={id}
                onClick={() => setTheme(id as "light" | "dark" | "system")}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Color system
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Solid tones only — no gradients. Single uses one color; Dual pairs primary with an accent.
          </p>
        </div>
        <div className="inline-flex rounded-xl glass p-1">
          {[
            { id: "single" as ColorMode, label: "Single", Icon: Circle },
            { id: "dual" as ColorMode, label: "Dual", Icon: CircleDashed },
          ].map(({ id, label, Icon }) => {
            const active = colorMode === id;
            return (
              <button
                key={id}
                onClick={() => chooseMode(id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-start justify-between gap-6 rounded-2xl glass p-4 max-w-2xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
              <Contrast className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold">High contrast</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                Tightens text and borders for maximum readability. Applies to the current theme in both light and dark modes.
              </p>
            </div>
          </div>
          <Switch
            checked={highContrast}
            onCheckedChange={(v) => {
              setHighContrast(v);
              toast.success(`High contrast ${v ? "on" : "off"}`);
            }}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Premium themes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Your selection is saved to your profile and reapplied when you sign in on any device.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {THEME_PRESETS.map((preset) => {
            const active = palette === preset.id;
            const isSingle = active && colorMode === "single";
            return (
              <button
                key={preset.id}
                onClick={() => choose(preset.id)}
                className={`text-left rounded-2xl p-4 border transition-all glass shadow-card hover:-translate-y-0.5 hover:shadow-glow ${
                  active ? "ring-2 ring-primary border-primary/40" : "border-transparent"
                }`}
              >
                <div
                  className="h-24 w-full rounded-xl overflow-hidden mb-3 relative"
                  style={{ background: preset.swatches.bg }}
                >
                  <div
                    className="absolute inset-3 rounded-lg shadow-md"
                    style={{ background: preset.swatches.card }}
                  />
                  <div
                    className="absolute bottom-4 left-5 h-6 w-16 rounded-md"
                    style={{ background: preset.swatches.primary }}
                  />
                  {!isSingle && (
                    <div
                      className="absolute bottom-4 left-24 h-6 w-6 rounded-full"
                      style={{ background: preset.swatches.accent }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold">{preset.label}</h3>
                  {active && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Check className="w-3.5 h-3.5" /> Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}