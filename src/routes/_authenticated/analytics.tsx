import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sentinel/TopBar";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { format, subDays, startOfDay } from "date-fns";
import type { IncidentRow } from "@/components/sentinel/IncidentStream";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics · Sentinel AI" },
      { name: "description", content: "Detection trends, risk distribution, and KPIs." },
    ],
  }),
  component: AnalyticsPage,
});

const SEV_COLORS: Record<string, string> = {
  Low: "oklch(0.7 0.01 286)",
  Medium: "oklch(0.78 0.16 85)",
  High: "oklch(0.72 0.18 50)",
  Critical: "oklch(0.65 0.22 25)",
};

function AnalyticsPage() {
  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", "all"],
    queryFn: async (): Promise<IncidentRow[]> => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as IncidentRow[];
    },
  });

  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter((i) => i.severity_level === "Critical").length;
    const active = incidents.filter((i) => i.status === "active").length;
    const resolved = incidents.filter((i) => i.status === "resolved").length;
    return { total, critical, active, resolved };
  }, [incidents]);

  const trendData = useMemo(() => {
    const days = 7;
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      map.set(d, 0);
    }
    incidents.forEach((inc) => {
      const d = format(startOfDay(new Date(inc.detected_at)), "MMM d");
      if (map.has(d)) map.set(d, (map.get(d) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([day, count]) => ({ day, count }));
  }, [incidents]);

  const sevData = useMemo(() => {
    const counts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Critical: 0 };
    incidents.forEach((i) => (counts[i.severity_level] = (counts[i.severity_level] ?? 0) + 1));
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [incidents]);

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    incidents.forEach((i) => counts.set(i.category, (counts.get(i.category) ?? 0) + 1));
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [incidents]);

  return (
    <>
      <TopBar title="Risk Analytics" totalActive={stats.total} critical={stats.critical} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Total Incidents" value={stats.total} />
          <Stat label="Critical" value={stats.critical} tone="critical" />
          <Stat label="Active" value={stats.active} tone="active" />
          <Stat label="Resolved" value={stats.resolved} tone="resolved" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-surface/40 border border-border rounded-lg p-5">
            <h3 className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-4">
              Detection Trend · 7 days
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.17 162)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="oklch(0.72 0.17 162)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.27 0.006 285)" />
                <XAxis dataKey="day" stroke="oklch(0.55 0.01 286)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.55 0.01 286)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "oklch(0.18 0.005 285)", border: "1px solid oklch(0.27 0.006 285)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "oklch(0.97 0.003 286)" }}
                />
                <Area type="monotone" dataKey="count" stroke="oklch(0.72 0.17 162)" strokeWidth={2} fill="url(#ag)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-surface/40 border border-border rounded-lg p-5">
            <h3 className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-4">
              Severity Distribution
            </h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sevData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {sevData.map((d) => (
                    <Cell key={d.name} fill={SEV_COLORS[d.name]} stroke="oklch(0.145 0.005 285)" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "oklch(0.18 0.005 285)", border: "1px solid oklch(0.27 0.006 285)", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
              {sevData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="size-2 rounded-sm" style={{ background: SEV_COLORS[d.name] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-mono-tabular ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface/40 border border-border rounded-lg p-5">
          <h3 className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-4">
            Top Detection Categories
          </h3>
          <div className="space-y-3">
            {categoryData.length === 0 && (
              <p className="text-sm text-muted-foreground">No detections yet.</p>
            )}
            {categoryData.map((c) => {
              const max = categoryData[0].count;
              return (
                <div key={c.category}>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <span>{c.category}</span>
                    <span className="font-mono-tabular text-muted-foreground">{c.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                    <div className="h-full bg-brand" style={{ width: `${(c.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "critical" | "active" | "resolved";
}) {
  const color =
    tone === "critical"
      ? "text-sev-critical"
      : tone === "active"
        ? "text-sev-medium"
        : tone === "resolved"
          ? "text-brand"
          : "";
  return (
    <div className="bg-surface/40 border border-border rounded-lg p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className={`text-3xl font-mono-tabular ${color}`}>{value.toLocaleString()}</div>
    </div>
  );
}
