import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$slug/_app/invoicing/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/invoicing/invoices", params: { slug: (params as any).slug } });
  },
});
