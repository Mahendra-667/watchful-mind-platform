import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, BarChart3, FileText, LayoutDashboard, ScanEye, ShieldAlert } from "lucide-react";

const items = [
  { to: "/", label: "Monitoring", icon: LayoutDashboard },
  { to: "/vision", label: "AI Vision", icon: ScanEye },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
] as const;

export function SidebarNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="w-16 flex flex-col items-center py-5 border-r border-border bg-background shrink-0">
      <Link
        to="/"
        className="size-9 bg-brand/10 rounded-lg flex items-center justify-center mb-8 ring-1 ring-brand/30"
        aria-label="Sentinel AI home"
      >
        <Activity className="size-4 text-brand" strokeWidth={2.5} />
      </Link>
      <div className="flex flex-col gap-2">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={[
                "size-10 rounded-lg flex items-center justify-center transition-colors ring-1",
                active
                  ? "bg-surface-elevated text-brand ring-brand/20"
                  : "bg-transparent text-muted-foreground ring-transparent hover:bg-surface hover:text-foreground",
              ].join(" ")}
              title={it.label}
            >
              <Icon className="size-4" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
