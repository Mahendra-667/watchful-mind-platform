import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { analyzeFrame } from "@/lib/incidents.functions";
import { severityClasses, scoreToLevel } from "@/lib/severity";
import { TopBar } from "@/components/sentinel/TopBar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Upload,
  Image as ImageIcon,
  Film,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/vision")({
  head: () => ({
    meta: [
      { title: "AI Vision · Sentinel AI" },
      {
        name: "description",
        content:
          "Upload an image or extract a video frame and analyze it with Gemini Vision for safety anomalies, risk scoring, and emergency recommendations.",
      },
      { property: "og:title", content: "AI Vision · Sentinel AI" },
      {
        property: "og:description",
        content:
          "Upload an image or extract a video frame and analyze it with Gemini Vision for safety anomalies, risk scoring, and emergency recommendations.",
      },
      { property: "og:url", content: "https://watchful-mind-platform.lovable.app/vision" },
    ],
    links: [
      { rel: "canonical", href: "https://watchful-mind-platform.lovable.app/vision" },
    ],
  }),
  component: VisionPage,
});

type Analysis = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof analyzeFrame>>>>;

const MAX_BYTES = 6 * 1024 * 1024;

function VisionPage() {
  const analyze = useServerFn(analyzeFrame);
  const qc = useQueryClient();
  const imgInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Analysis | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function fileToCompressedDataUrl(file: File, maxDim = 1280, quality = 0.85): Promise<string> {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  }

  async function handleImage(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("Image too large", { description: "Max 6 MB." });
      return;
    }
    try {
      const url = await fileToCompressedDataUrl(file);
      setImageDataUrl(url);
      setSourceName(file.name);
      setResult(null);
      setSavedId(null);
      setVideoUrl(null);
    } catch (e) {
      toast.error("Could not read image", { description: String(e) });
    }
  }

  function handleVideo(file: File) {
    if (file.size > 40 * 1024 * 1024) {
      toast.error("Video too large", { description: "Max 40 MB." });
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setSourceName(file.name);
    setImageDataUrl(null);
    setResult(null);
    setSavedId(null);
  }

  function captureFrame() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) {
      toast.error("Video not ready");
      return;
    }
    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.85);
    setImageDataUrl(url);
    setResult(null);
    setSavedId(null);
    toast.success("Frame captured", { description: `At ${v.currentTime.toFixed(1)}s` });
  }

  async function runAnalysis() {
    if (!imageDataUrl) return;
    setAnalyzing(true);
    setResult(null);
    setSavedId(null);
    try {
      const r = await analyze({
        data: { imageDataUrl, cameraLabel: sourceName || "Vision Upload" },
      });
      setResult(r);
      if (r.detected) {
        toast.success("Anomaly detected", { description: r.title });
      } else {
        toast("No anomaly detected", { description: "The scene looks normal." });
      }
    } catch (e) {
      toast.error("Analysis failed", { description: String(e) });
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveIncident() {
    if (!result || !result.detected) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("incidents")
        .insert({
          user_id: u.user.id,
          title: result.title,
          description: result.description,
          category: result.category,
          severity_score: result.severity_score,
          severity_level: result.severity_level,
          camera_label: sourceName || "Vision Upload",
          confidence: result.confidence,
          recommended_actions: result.recommended_actions,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      setSavedId(data.id);
      qc.invalidateQueries({ queryKey: ["incidents"] });
      toast.success("Incident saved");
    } catch (e) {
      toast.error("Save failed", { description: String(e) });
    } finally {
      setSaving(false);
    }
  }

  const sev = result?.detected ? severityClasses[scoreToLevel(result.severity_score)] : null;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopBar title="AI Vision" totalActive={0} critical={0} />
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-6">
          {/* Upload panel */}
          <section className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Source</h2>
                <p className="text-xs text-muted-foreground">Image or video — a single frame is sent to Gemini Vision.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => imgInput.current?.click()}>
                  <ImageIcon className="size-4 mr-1.5" /> Image
                </Button>
                <Button size="sm" variant="outline" onClick={() => videoInput.current?.click()}>
                  <Film className="size-4 mr-1.5" /> Video
                </Button>
              </div>
            </header>

            <input
              ref={imgInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])}
            />
            <input
              ref={videoInput}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleVideo(e.target.files[0])}
            />

            <div className="rounded-lg border border-dashed border-border bg-background aspect-video flex items-center justify-center overflow-hidden">
              {videoUrl ? (
                <video ref={videoRef} src={videoUrl} controls className="w-full h-full object-contain bg-black" />
              ) : imageDataUrl ? (
                <img src={imageDataUrl} alt="Upload preview" className="w-full h-full object-contain bg-black" />
              ) : (
                <div className="text-center text-muted-foreground px-6">
                  <Upload className="size-8 mx-auto mb-2 opacity-70" />
                  <p className="text-sm">Drop an image or video, or use the buttons above.</p>
                  <p className="text-xs mt-1">Images ≤ 6 MB · Videos ≤ 40 MB</p>
                </div>
              )}
            </div>

            {videoUrl && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Scrub to the moment you want analyzed, then capture.</p>
                <Button size="sm" variant="secondary" onClick={captureFrame}>
                  <Sparkles className="size-4 mr-1.5" /> Capture frame
                </Button>
              </div>
            )}

            {imageDataUrl && videoUrl && (
              <div className="rounded-md border border-border bg-background p-2 flex items-center gap-3">
                <img src={imageDataUrl} alt="Captured frame" className="h-16 w-24 object-cover rounded" />
                <p className="text-xs text-muted-foreground">Frame ready for analysis.</p>
              </div>
            )}

            <Button
              onClick={runAnalysis}
              disabled={!imageDataUrl || analyzing}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {analyzing ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Sparkles className="size-4 mr-1.5" />}
              {analyzing ? "Analyzing with Gemini Vision…" : "Analyze with Gemini Vision"}
            </Button>

            <canvas ref={canvasRef} className="hidden" />
          </section>

          {/* Result panel */}
          <section className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-4 min-h-[420px]">
            <header className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">AI Vision Report</h2>
                <p className="text-xs text-muted-foreground">
                  {result?.source === "gemini"
                    ? "Generated by Gemini Vision"
                    : result?.source === "simulated"
                    ? "Simulated (AI unavailable)"
                    : "Waiting for analysis"}
                </p>
              </div>
              {result?.detected && (
                <span
                  className={[
                    "text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded ring-1",
                    sev!.bg,
                    sev!.text,
                    sev!.ring,
                  ].join(" ")}
                >
                  {result.severity_level} risk
                </span>
              )}
            </header>

            {!result && (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-sm">
                <ShieldAlert className="size-10 mb-3 opacity-50" />
                Run an analysis to see results here.
              </div>
            )}

            {result && !result.detected && (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <CheckCircle2 className="size-10 text-sev-low mb-3" />
                <p className="text-sm font-medium">No anomaly detected</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  The scene appears normal. Confidence reflects Gemini's certainty that nothing
                  requires response.
                </p>
              </div>
            )}

            {result?.detected && (
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Detected anomaly</p>
                  <p className="text-base font-semibold mt-0.5">{result.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Category: {result.category}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Confidence" value={`${result.confidence.toFixed(1)}%`} />
                  <Metric label="Severity score" value={`${result.severity_score}/100`} />
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Incident summary
                  </p>
                  <p className="text-sm leading-relaxed">{result.description}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Emergency recommendations
                  </p>
                  <ul className="space-y-1.5">
                    {result.recommended_actions.map((a, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-brand mt-0.5">›</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto pt-2 flex items-center gap-2">
                  <Button
                    onClick={saveIncident}
                    disabled={saving || !!savedId}
                    className="bg-brand text-brand-foreground hover:bg-brand/90"
                  >
                    {saving ? (
                      <Loader2 className="size-4 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="size-4 mr-1.5" />
                    )}
                    {savedId ? "Saved to incidents" : "Save to incidents"}
                  </Button>
                  {savedId && (
                    <span className="text-xs text-muted-foreground">ID: {savedId.slice(0, 8)}…</span>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}
