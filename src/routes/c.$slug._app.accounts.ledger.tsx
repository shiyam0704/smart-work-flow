import { createFileRoute, redirect } from "@tanstack/react-router";

/** Ledger was replaced by the Accounts book (cash & bank accounts). */
export const Route = createFileRoute("/c/$slug/_app/accounts/ledger")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/accounts/book", params: { slug: (params as any).slug } });
  },
});
