import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$slug/_app/purchase/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/purchase/orders", params: { slug: (params as any).slug } });
  },
});
