import { CLink as Link } from "@/lib/nav";
import { ArrowLeft } from "lucide-react";
import { Topbar } from "@/components/app/Topbar";

export function ReportShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Topbar title={title} subtitle={subtitle} />
      <div className="p-6 space-y-5">
        <Link to="/c/$slug/reports" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="w-3.5 h-3.5" /> All reports
        </Link>
        {children}
      </div>
    </>
  );
}
