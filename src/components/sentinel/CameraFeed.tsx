import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CameraOff, Loader2 } from "lucide-react";

export type LiveDetection = {
  category: string;
  confidence: number;
  severity: "Low" | "Medium" | "High" | "Critical";
} | null;

export function CameraFeed({
  label,
  active,
  onStart,
  onStop,
  videoRef,
  detection,
  analyzing,
}: {
  label: string;
  active: boolean;
  onStart: () => void;
  onStop: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detection: LiveDetection;
  analyzing: boolean;
}) {
  const sevColor =
    detection?.severity === "Critical"
      ? "border-sev-critical bg-sev-critical text-foreground"
      : detection?.severity === "High"
        ? "border-sev-high bg-sev-high text-background"
        : detection?.severity === "Medium"
          ? "border-sev-medium bg-sev-medium text-background"
          : "border-brand bg-brand text-background";

  return (
    <div className="relative aspect-video bg-surface rounded-lg overflow-hidden ring-1 ring-border group">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-cover ${active ? "opacity-100" : "opacity-0"}`}
      />

      {!active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="size-10 rounded-full bg-surface-elevated flex items-center justify-center ring-1 ring-border">
            <CameraOff className="size-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground max-w-[28ch]">
            Camera offline. Connect a webcam or mobile stream to begin monitoring.
          </p>
          <Button size="sm" variant="secondary" onClick={onStart} className="gap-2">
            <Camera className="size-3.5" /> Connect Camera
          </Button>
        </div>
      )}

      {/* HUD label */}
      <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-md border border-border rounded px-2 py-1 text-[10px] font-mono-tabular uppercase tracking-wide flex items-center gap-1.5">
        {active && <span className="size-1.5 rounded-full bg-brand animate-pulse" />}
        {label}
      </div>

      {active && (
        <div className="absolute top-3 right-3 bg-background/80 backdrop-blur-md border border-border rounded px-2 py-1 text-[10px] font-mono-tabular uppercase tracking-wide flex items-center gap-1.5">
          {analyzing ? (
            <>
              <Loader2 className="size-3 animate-spin text-brand" /> Analyzing
            </>
          ) : (
            <>
              <span className="size-1.5 rounded-full bg-brand" /> Live
            </>
          )}
        </div>
      )}

      {/* Detection overlay */}
      {active && detection && (
        <div className="absolute inset-x-6 top-1/3 bottom-1/4 border-2 rounded-sm pointer-events-none animate-slide-in"
             style={{ borderColor: `var(--sev-${detection.severity.toLowerCase()})` }}>
          <div
            className={`absolute -top-6 left-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-sm uppercase tracking-wide border ${sevColor}`}
          >
            {detection.category} / {detection.confidence.toFixed(0)}%
          </div>
        </div>
      )}

      {active && (
        <button
          onClick={onStop}
          className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-md border border-border rounded px-2 py-1 text-[10px] uppercase tracking-wide hover:bg-surface-elevated"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
