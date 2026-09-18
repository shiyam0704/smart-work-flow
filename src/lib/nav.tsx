import {
  Link as TLink,
  useNavigate as tUseNavigate,
  useParams,
  Navigate as TNavigate,
} from "@tanstack/react-router";

function currentSlug(): string | undefined {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const p = useParams({ strict: false }) as any;
  return p?.slug;
}

function injectSlug(opts: any, slug: string | undefined): any {
  if (!opts) return opts;
  const to = opts.to;
  if (typeof to !== "string" || !to.includes("$slug") || !slug) return opts;
  const existing = opts.params;
  const params =
    typeof existing === "function"
      ? (prev: any) => ({ slug, ...existing(prev) })
      : { slug, ...(existing || {}) };
  return { ...opts, params };
}

/**
 * Company-aware <Link>. Automatically injects the active `slug` path param
 * whenever the target route path contains `$slug`, so callers can write
 *   <CLink to="/c/$slug/dashboard" />
 * without having to spread the current slug themselves.
 */
export function CLink(props: any) {
  const slug = currentSlug();
  return <TLink {...injectSlug(props, slug)} />;
}

export function CNavigate(props: any) {
  const slug = currentSlug();
  return <TNavigate {...injectSlug(props, slug)} />;
}

export function useCNavigate(opts?: any) {
  const nav = tUseNavigate(opts);
  const slug = currentSlug();
  return (opts: any) => nav(injectSlug(opts, slug));
}

/** Helper for use in loaders / server contexts where params.slug is known. */
export function withSlug(slug: string, opts: any): any {
  return injectSlug(opts, slug);
}