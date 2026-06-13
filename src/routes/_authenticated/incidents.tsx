import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sentinel/TopBar";
import { severityClasses, type SeverityLevel } from "@/lib/severity";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { generateIncidentReport } from "@/lib/pdf";
import type { IncidentRow } from "@/components/sentinel/IncidentStream";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/incidents")({
  head: () => ({
    meta: [
      { title: "Incidents · Sentinel AI" },
      { name: "description", content: "Complete incident history and timeline." },
    ],
  }),
  component: IncidentsPage,
});

function IncidentsPage() {
  const [filter, setFilter] = useState<"all" | SeverityLevel>("all");
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

  const filtered = filter === "all" ? incidents : incidents.filter((i) => i.severity_level === filter);
  const critical = incidents.filter((i) => i.severity_level === "Critical" && i.status !== "resolved").length;

  return (
    <>
      <TopBar title="Incident Center" totalActive={incidents.length} critical={critical} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          {(["all", "Critical", "High", "Medium", "Low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "text-[11px] uppercase tracking-wider px-3 py-1 rounded-full ring-1 transition-colors",
                filter === f
                  ? "bg-brand text-brand-foreground ring-brand"
                  : "bg-surface text-muted-foreground ring-border hover:text-foreground",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="border border-border rounded-lg overflow-hidden bg-surface/30">
          <table className="w-full text-sm">
            <thead className="bg-surface text-muted-foreground text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left p-3 font-medium">Severity</th>
                <th className="text-left p-3 font-medium">Incident</th>
                <th className="text-left p-3 font-medium">Camera</th>
                <th className="text-left p-3 font-medium">Detected</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="p-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((i) => {
                const s = severityClasses[i.severity_level];
                return (
                  <tr key={i.id} className="hover:bg-surface/60">
                    <td className="p-3">
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ring-1 ${s.text} ${s.bg} ${s.ring}`}>
                        {i.severity_level}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{i.title}</div>
                      <div className="text-xs text-muted-foreground max-w-md truncate">{i.description}</div>
                    </td>
                    <td className="p-3 font-mono-tabular text-xs text-muted-foreground">{i.camera_label}</td>
                    <td className="p-3 font-mono-tabular text-xs text-muted-foreground">
                      {format(new Date(i.detected_at), "MMM d, HH:mm")}
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{i.status}</span>
                    </td>
                    <td className="p-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => generateIncidentReport(i)}
                        aria-label="Download report"
                      >
                        <FileDown className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-sm text-muted-foreground">
                    No incidents match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
