import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/c/$slug/_app/accounts/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/c/$slug/accounts/income", params: { slug: (params as any).slug } });
  },
});
