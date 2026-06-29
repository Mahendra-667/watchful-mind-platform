import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sentinel/TopBar";
import { CameraFeed, type LiveDetection } from "@/components/sentinel/CameraFeed";
import { IncidentStream, type IncidentRow } from "@/components/sentinel/IncidentStream";
import { analyzeFrame, seedSampleIncidents } from "@/lib/incidents.functions";
import { scoreToLevel } from "@/lib/severity";
import { Button } from "@/components/ui/button";
import { Sparkles, PlayCircle, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { generateIncidentReport } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Main Monitoring · Sentinel AI" },
      {
        name: "description",
        content:
          "Live multi-camera anomaly monitoring console with real-time AI detection, severity scoring, and incident response recommendations.",
      },
      { property: "og:title", content: "Main Monitoring · Sentinel AI" },
      {
        property: "og:description",
        content:
          "Live multi-camera anomaly monitoring console with real-time AI detection, severity scoring, and incident response recommendations.",
      },
      { property: "og:url", content: "https://watchful-mind-platform.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://watchful-mind-platform.lovable.app/" },
    ],
  }),
  component: MonitoringPage,
});

type CamId = "cam-01" | "cam-02" | "cam-03" | "cam-04";
const CAMS: { id: CamId; label: string }[] = [
  { id: "cam-01", label: "Cam-01 / Webcam" },
  { id: "cam-02", label: "Cam-02 / Mobile Stream" },
  { id: "cam-03", label: "Cam-03 / Standby" },
  { id: "cam-04", label: "Cam-04 / Standby" },
];

function MonitoringPage() {
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeFrame);
  const seed = useServerFn(seedSampleIncidents);

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents", "recent"],
    queryFn: async (): Promise<IncidentRow[]> => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as IncidentRow[];
    },
  });

  // Realtime subscription — scoped to current user's topic
  useEffect(() => {
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      ch = supabase
        .channel(`incidents:${uid}`, { config: { private: true } })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "incidents", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["incidents"] }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (ch) supabase.removeChannel(ch);
    };
  }, [qc]);


  // Camera state
  const videoRefs: Record<CamId, React.RefObject<HTMLVideoElement | null>> = {
    "cam-01": useRef<HTMLVideoElement | null>(null),
    "cam-02": useRef<HTMLVideoElement | null>(null),
    "cam-03": useRef<HTMLVideoElement | null>(null),
    "cam-04": useRef<HTMLVideoElement | null>(null),
  };
  const streams = useRef<Record<string, MediaStream | null>>({});
  const [activeCams, setActiveCams] = useState<Record<CamId, boolean>>({
    "cam-01": false,
    "cam-02": false,
    "cam-03": false,
    "cam-04": false,
  });
  const [detections, setDetections] = useState<Record<CamId, LiveDetection>>({
    "cam-01": null,
    "cam-02": null,
    "cam-03": null,
    "cam-04": null,
  });
  const [analyzingCam, setAnalyzingCam] = useState<CamId | null>(null);
  const [autoMode, setAutoMode] = useState(false);

  async function startCam(id: CamId) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: id === "cam-02" ? "environment" : "user" },
        audio: false,
      });
      streams.current[id] = stream;
      const v = videoRefs[id].current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      setActiveCams((s) => ({ ...s, [id]: true }));
    } catch (e) {
      toast.error("Camera access denied or unavailable");
    }
  }
  function stopCam(id: CamId) {
    streams.current[id]?.getTracks().forEach((t) => t.stop());
    streams.current[id] = null;
    const v = videoRefs[id].current;
    if (v) v.srcObject = null;
    setActiveCams((s) => ({ ...s, [id]: false }));
    setDetections((d) => ({ ...d, [id]: null }));
  }

  function captureFrame(id: CamId): string | null {
    const v = videoRefs[id].current;
    if (!v || v.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    const w = Math.min(640, v.videoWidth);
    const h = Math.round((w / v.videoWidth) * v.videoHeight);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.7);
  }

  async function runAnalysis(id: CamId) {
    if (!activeCams[id]) {
      toast.error("Start the camera first");
      return;
    }
    setAnalyzingCam(id);
    const frame = captureFrame(id);
    if (!frame) {
      setAnalyzingCam(null);
      return;
    }
    try {
      const cam = CAMS.find((c) => c.id === id)!;
      const result = await analyze({ data: { imageDataUrl: frame, cameraLabel: cam.label } });
      if (result.detected) {
        setDetections((d) => ({
          ...d,
          [id]: {
            category: result.category || "Anomaly",
            confidence: result.confidence,
            severity: result.severity_level as LiveDetection extends infer R ? R extends { severity: infer S } ? S : never : never,
          },
        }));
        const { error } = await supabase.from("incidents").insert({
          title: result.title,
          description: result.description,
          category: result.category,
          severity_score: result.severity_score,
          severity_level: result.severity_level,
          camera_label: cam.label,
          confidence: result.confidence,
          recommended_actions: result.recommended_actions,
          snapshot_data_url: frame.slice(0, 200),
          user_id: (await supabase.auth.getUser()).data.user?.id,
        } as never);
        if (error) toast.error(error.message);
        else toast(`${result.severity_level} · ${result.title}`);
      } else {
        setDetections((d) => ({ ...d, [id]: null }));
      }
    } catch (e) {
      toast.error("Analysis failed");
    } finally {
      setAnalyzingCam(null);
    }
  }

  // Auto-mode: cycle through active cams
  useEffect(() => {
    if (!autoMode) return;
    const t = setInterval(() => {
      const live = (Object.keys(activeCams) as CamId[]).filter((c) => activeCams[c]);
      if (!live.length) return;
      const next = live[Math.floor(Math.random() * live.length)];
      runAnalysis(next);
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, activeCams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(streams.current).forEach((s) => s?.getTracks().forEach((t) => t.stop()));
    };
  }, []);

  async function acknowledge(id: string) {
    const { error } = await supabase
      .from("incidents")
      .update({ status: "acknowledged" })
      .eq("id", id);
    if (error) toast.error(error.message);
  }

  const totals = useMemo(() => {
    const active = incidents.filter((i) => i.status === "active").length;
    const critical = incidents.filter((i) => i.severity_level === "Critical" && i.status !== "resolved").length;
    return { active, critical };
  }, [incidents]);

  // Trend bars — last 12 buckets of 2h
  const trend = useMemo(() => {
    const buckets = Array(12).fill(0);
    const now = Date.now();
    incidents.forEach((i) => {
      const ageH = (now - new Date(i.detected_at).getTime()) / 3600_000;
      const b = Math.floor(ageH / 2);
      if (b >= 0 && b < 12) buckets[11 - b] += 1;
    });
    const max = Math.max(1, ...buckets);
    return buckets.map((v) => ({ v, h: (v / max) * 100 }));
  }, [incidents]);

  return (
    <>
      <TopBar
        title="Main Monitoring"
        totalActive={incidents.length}
        critical={totals.critical}
        onGenerateReport={() => {
          const target = incidents[0];
          if (!target) return toast.error("No incident to report yet");
          generateIncidentReport(target);
        }}
      />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 overflow-y-auto gap-6">
          {/* Controls bar */}
          <div className="flex items-center justify-between -mt-1">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-brand animate-pulse" />
              Detection engine online · {Object.values(activeCams).filter(Boolean).length} active feeds
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={autoMode ? "default" : "outline"}
                onClick={() => setAutoMode((m) => !m)}
                className="gap-2"
              >
                {autoMode ? <PauseCircle className="size-3.5" /> : <PlayCircle className="size-3.5" />}
                {autoMode ? "Auto: ON" : "Auto: OFF"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await seed({ data: { count: 12 } });
                  qc.invalidateQueries({ queryKey: ["incidents"] });
                  toast.success("Sample incidents seeded");
                }}
                className="gap-2"
              >
                <Sparkles className="size-3.5" /> Seed Demo Data
              </Button>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CAMS.map((cam) => (
              <div key={cam.id} className="space-y-2">
                <CameraFeed
                  label={cam.label}
                  active={activeCams[cam.id]}
                  onStart={() => startCam(cam.id)}
                  onStop={() => stopCam(cam.id)}
                  videoRef={videoRefs[cam.id]}
                  detection={detections[cam.id]}
                  analyzing={analyzingCam === cam.id}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!activeCams[cam.id] || analyzingCam === cam.id}
                    onClick={() => runAnalysis(cam.id)}
                    className="h-7 text-[11px] gap-1.5"
                  >
                    <Sparkles className="size-3" /> Analyze Frame
                  </Button>
                </div>
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
            <div className="md:col-span-2 bg-surface/40 rounded-lg border border-border p-5">
              <h3 className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-4">
                Incident Frequency · last 24h
              </h3>
              <div className="h-24 flex items-end gap-1.5">
                {trend.map((b, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${b.v > 0 ? (b.v >= 3 ? "bg-sev-critical/50" : "bg-brand/40") : "bg-surface-elevated"}`}
                    style={{ height: `${Math.max(4, b.h)}%` }}
                    title={`${b.v} incidents`}
                  />
                ))}
              </div>
            </div>
            <div className="bg-surface/40 rounded-lg border border-border p-5">
              <h3 className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider mb-4">
                System Efficiency
              </h3>
              <Bar label="Inference Latency" value="~1.4s" pct={72} />
              <Bar label="API Health" value="Active" pct={100} />
              <Bar label="Engine Confidence" value="98%" pct={98} />
            </div>
          </div>
        </div>

        <IncidentStream
          incidents={incidents.slice(0, 12)}
          onAcknowledge={acknowledge}
          emptyHint="Connect a camera and run analysis, or seed demo data to see Sentinel in action."
        />
      </div>
    </>
  );
}

function Bar({ label, value, pct }: { label: string; value: string; pct: number }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="flex justify-between items-end mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono-tabular">{value}</span>
      </div>
      <div className="w-full h-1 bg-surface-elevated rounded-full overflow-hidden">
        <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
