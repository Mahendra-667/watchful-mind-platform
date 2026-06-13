import { Button } from "@/components/ui/button";
import { FileDown, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function TopBar({
  title,
  totalActive,
  critical,
  uptime = "99.98%",
  onGenerateReport,
}: {
  title: string;
  totalActive: number;
  critical: number;
  uptime?: string;
  onGenerateReport?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/70 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-8">
        <h1 className="text-sm font-semibold tracking-wide uppercase text-foreground">{title}</h1>
        <div className="flex items-center gap-6">
          <Kpi label="Total Active" value={totalActive.toLocaleString()} />
          <Kpi label="Critical" value={String(critical).padStart(2, "0")} tone="critical" />
          <Kpi label="Uptime" value={uptime} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onGenerateReport && (
          <Button size="sm" onClick={onGenerateReport} className="gap-2">
            <FileDown className="size-4" /> Generate Report
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          aria-label="Sign out"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth", replace: true });
          }}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "critical" }) {
  return (
    <div className="flex flex-col">
      <span
        className={`text-[10px] uppercase font-medium leading-none mb-1 ${tone === "critical" ? "text-sev-critical" : "text-muted-foreground"}`}
      >
        {label}
      </span>
      <span className={`text-sm font-mono-tabular ${tone === "critical" ? "text-sev-critical" : ""}`}>
        {value}
      </span>
    </div>
  );
}
