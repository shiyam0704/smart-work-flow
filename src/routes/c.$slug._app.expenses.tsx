import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — Expenses now lives under Accounts. */
export const Route = createFileRoute("/c/$slug/_app/expenses")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/c/$slug/accounts/expenses",
      params: { slug: (params as any).slug },
    });
  },
});
