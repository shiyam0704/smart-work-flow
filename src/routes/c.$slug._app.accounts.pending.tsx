import { createFileRoute, redirect } from "@tanstack/react-router";

/** Customer pending now lives under Invoicing. */
export const Route = createFileRoute("/c/$slug/_app/accounts/pending")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/invoicing/pending", params: { slug: (params as any).slug } });
  },
});
