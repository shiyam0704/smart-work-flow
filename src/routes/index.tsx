import { createFileRoute, redirect } from "@tanstack/react-router";

// The generic /auth page resolves the signed-in user's role and routes
// them to /admin (super admin) or /c/{slug}/dashboard (company admin).
// For everyone else it just shows the sign-in form.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
