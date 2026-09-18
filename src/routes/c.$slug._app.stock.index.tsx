import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$slug/_app/stock/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/stock/balance", params: { slug: (params as any).slug } as any });
  },
});
