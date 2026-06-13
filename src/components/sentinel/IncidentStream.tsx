import { severityClasses, type SeverityLevel } from "@/lib/severity";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export type IncidentRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity_score: number;
  severity_level: SeverityLevel;
  camera_label: string;
  confidence: number;
  recommended_actions: string[];
  status: "active" | "acknowledged" | "resolved";
  detected_at: string;
};

export function IncidentStream({
  incidents,
  onAcknowledge,
  emptyHint,
}: {
  incidents: IncidentRow[];
  onAcknowledge?: (id: string) => void;
  emptyHint?: string;
}) {
  return (
    <aside className="w-80 border-l border-border flex flex-col bg-background overflow-hidden shrink-0">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Live Incidents
        </h2>
        <span className="text-[10px] font-mono-tabular text-muted-foreground">
          {incidents.length} feed
        </span>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {incidents.length === 0 && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {emptyHint ?? "No incidents detected. Sentinel is watching."}
          </div>
        )}
        {incidents.map((i) => {
          const s = severityClasses[i.severity_level];
          const isCritical = i.severity_level === "Critical";
          return (
            <div
              key={i.id}
              className={`p-4 border-l-2 ${s.border} ${isCritical ? "bg-sev-critical/5" : ""} animate-slide-in`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ring-1 ${s.text} ${s.bg} ${s.ring}`}
                >
                  {i.severity_level}
                </span>
                <span className="text-[10px] font-mono-tabular text-muted-foreground">
                  {format(new Date(i.detected_at), "HH:mm:ss")}
                </span>
              </div>
              <h4 className="text-sm font-medium text-foreground mb-1 text-balance">
                {i.title}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed text-pretty mb-1">
                {i.description}
              </p>
              <p className="text-[10px] font-mono-tabular text-muted-foreground/70 mb-3">
                {i.camera_label} · score {i.severity_score} · {i.confidence.toFixed(0)}% conf
              </p>
              {i.recommended_actions?.length > 0 && (
                <div className="bg-surface rounded p-3 ring-1 ring-border">
                  <span className="text-[10px] text-brand font-semibold uppercase block mb-2">
                    Agent Recommendation
                  </span>
                  <ul className="text-[11px] text-foreground/85 leading-snug mb-2 space-y-1 list-disc list-inside marker:text-brand/60">
                    {i.recommended_actions.slice(0, 3).map((a, idx) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                  {i.status === "active" && onAcknowledge && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full h-7 text-[10px] uppercase tracking-wide"
                      onClick={() => onAcknowledge(i.id)}
                    >
                      Acknowledge Response
                    </Button>
                  )}
                  {i.status !== "active" && (
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground text-center">
                      {i.status}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
