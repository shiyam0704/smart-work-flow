import { useState } from "react";
import { Search, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { GlobalSearch } from "./GlobalSearch";
import { useActiveCompany } from "@/hooks/use-company";
import { getRouteApi, useLocation, useMatches } from "@tanstack/react-router";

const slugRoute = getRouteApi("/c/$slug");

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const matches = useMatches();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const { company } = useActiveCompany();
  const branding = slugRoute.useLoaderData();
  const brandLogo = branding?.logoUrl ?? company?.logo_url ?? null;
  const brandName = branding?.name ?? company?.name ?? "";

  const pathname = (location.pathname || "").replace(/\/+$/, "");

  const isDashboard =
    matches.some((m) => m.routeId === "/c/$slug/_app/dashboard") ||
    /^\/c\/[^/]+\/dashboard$/.test(pathname);

  return (
    <header className="sticky top-0 z-30 bg-background border-b border-glass-border">
      <div className="flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4">
        <div className="md:hidden flex items-center min-w-0">
          <div className="w-8 h-8 rounded-lg overflow-hidden ring-1 ring-glass-border bg-white grid place-items-center shrink-0">
            {brandLogo
              ? <img key={brandLogo} src={brandLogo} alt={brandName} className="w-full h-full object-cover" />
              : <Building2 className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-base sm:text-xl truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>

        {/* Dashboard page: Global Search + Theme toggle */}
        {isDashboard && (
          <>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden lg:flex items-center gap-2 px-3 py-2 bg-muted border border-glass-border rounded-lg w-72 text-left hover:bg-accent/40 transition-colors"
              aria-label="Open search"
            >
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm flex-1 text-muted-foreground truncate">
                Search clients, tasks, employees…
              </span>
              <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                ⌘K
              </kbd>
            </button>
            <Button
              onClick={() => setSearchOpen(true)}
              size="icon"
              variant="ghost"
              className="lg:hidden"
              aria-label="Open search"
            >
              <Search className="w-4 h-4" />
            </Button>
            <ThemeToggle />
          </>
        )}
      </div>

      {/* GlobalSearch dialog is only mounted on Dashboard */}
      {isDashboard && <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />}
    </header>
  );
}
