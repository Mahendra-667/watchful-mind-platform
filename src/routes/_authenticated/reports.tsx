import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sentinel/TopBar";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { generateIncidentReport } from "@/lib/pdf";
import type { IncidentRow } from "@/components/sentinel/IncidentStream";
import { severityClasses } from "@/lib/severity";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Sentinel AI" },
      {
        name: "description",
        content:
          "Generate and download detailed PDF incident reports including AI-recommended actions, severity scores, and resolution notes.",
      },
      { property: "og:title", content: "Reports · Sentinel AI" },
      {
        property: "og:description",
        content:
          "Generate and download detailed PDF incident reports including AI-recommended actions, severity scores, and resolution notes.",
      },
      { property: "og:url", content: "https://watchful-mind-platform.lovable.app/reports" },
    ],
    links: [
      { rel: "canonical", href: "https://watchful-mind-platform.lovable.app/reports" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
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

  const critical = incidents.filter((i) => i.severity_level === "Critical").length;

  return (
    <>
      <TopBar title="Report Generator" totalActive={incidents.length} critical={critical} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mb-6">
          <h2 className="text-lg font-semibold tracking-tight mb-1">Incident Reports</h2>
          <p className="text-sm text-muted-foreground">
            Each report contains the incident type, timestamp, severity score, AI-recommended actions,
            and resolution notes. Reports download as a PDF.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {incidents.map((i) => {
            const s = severityClasses[i.severity_level];
            return (
              <div key={i.id} className="bg-surface/40 border border-border rounded-lg p-5 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ring-1 ${s.text} ${s.bg} ${s.ring}`}>
                    {i.severity_level}
                  </span>
                  <span className="text-[10px] font-mono-tabular text-muted-foreground">
                    {format(new Date(i.detected_at), "MMM d · HH:mm")}
                  </span>
                </div>
                <h3 className="text-sm font-medium mb-1 text-balance">{i.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{i.description}</p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-[10px] font-mono-tabular text-muted-foreground">
                    {i.camera_label}
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => generateIncidentReport(i)} className="gap-2 h-7 text-[11px]">
                    <FileDown className="size-3" /> PDF
                  </Button>
                </div>
              </div>
            );
          })}
          {incidents.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full text-center py-16">
              No incidents yet. Run detection on the monitoring page or seed demo data.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
