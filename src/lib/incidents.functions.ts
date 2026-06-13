import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scoreToLevel, DETECTION_CATEGORIES } from "./severity";

const AnalyzeInput = z.object({
  imageDataUrl: z.string().min(20).max(8_000_000),
  cameraLabel: z.string().min(1).max(80),
});

type AnalysisResult = {
  detected: boolean;
  title: string;
  description: string;
  category: string;
  severity_score: number;
  confidence: number;
  recommended_actions: string[];
};

function fallbackSimulated(cameraLabel: string): AnalysisResult {
  // ~35% chance of detection, weighted toward lower severities
  if (Math.random() > 0.35) {
    return {
      detected: false,
      title: "",
      description: "",
      category: "",
      severity_score: 0,
      confidence: 0,
      recommended_actions: [],
    };
  }
  const cat =
    DETECTION_CATEGORIES[Math.floor(Math.random() * DETECTION_CATEGORIES.length)];
  const score = Math.floor(20 + Math.random() * 75);
  const conf = +(60 + Math.random() * 39).toFixed(1);
  const templates: Record<string, { title: string; desc: string; actions: string[] }> = {
    Fire: {
      title: "Active Fire Detected",
      desc: `Visible flames identified on feed ${cameraLabel}. Heat signature consistent with combustion.`,
      actions: ["Trigger fire suppression system", "Notify fire department", "Evacuate adjacent zones"],
    },
    Smoke: {
      title: "Smoke Plume Detected",
      desc: `Dense smoke pattern observed on ${cameraLabel}. Possible early-stage fire or equipment failure.`,
      actions: ["Investigate source", "Pre-alert fire response team", "Increase ventilation"],
    },
    Flood: {
      title: "Water Accumulation Detected",
      desc: `Standing water observed on ${cameraLabel} consistent with leak or flooding event.`,
      actions: ["Shut off main water supply", "Dispatch maintenance", "Isolate electrical panels"],
    },
    "Road Accident": {
      title: "Vehicle Collision Identified",
      desc: `Collision pattern detected on ${cameraLabel}. Vehicles in atypical orientation.`,
      actions: ["Dispatch emergency medical services", "Reroute traffic", "Notify highway authority"],
    },
    "Fallen Person": {
      title: "Fallen Person Detected",
      desc: `Individual in horizontal position on ${cameraLabel} with no recovery motion in 4s.`,
      actions: ["Dispatch first-aid responder", "Notify on-site medic", "Begin incident audio log"],
    },
    "Crowd Congestion": {
      title: "Crowd Density Threshold Breached",
      desc: `Pedestrian density on ${cameraLabel} exceeded 4 persons/m² for sustained interval.`,
      actions: ["Open additional egress", "Halt new entries", "Deploy crowd marshals"],
    },
    "Unauthorized Intrusion": {
      title: "Unauthorized Entry Detected",
      desc: `Human presence detected on ${cameraLabel} in restricted zone outside permitted hours.`,
      actions: ["Lock perimeter access", "Notify on-site security", "Begin video evidence capture"],
    },
    "Suspicious Activity": {
      title: "Behavioral Anomaly Detected",
      desc: `Loitering / abnormal movement pattern on ${cameraLabel} flagged by behavior model.`,
      actions: ["Tag for human review", "Increase camera sample rate", "Alert nearest patrol"],
    },
  };
  const t = templates[cat];
  return {
    detected: true,
    title: t.title,
    description: t.desc,
    category: cat,
    severity_score: score,
    confidence: conf,
    recommended_actions: t.actions,
  };
}

export const analyzeFrame = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      const sim = fallbackSimulated(data.cameraLabel);
      return { ...sim, severity_level: sim.detected ? scoreToLevel(sim.severity_score) : "Low", source: "simulated" as const };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content:
                "You are Sentinel AI, an autonomous safety vision agent. Analyze the camera frame for any of: Fire, Smoke, Flood, Road Accident, Fallen Person, Crowd Congestion, Unauthorized Intrusion, Suspicious Activity. Respond ONLY with a single compact JSON object. No prose, no markdown fences.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Camera: "${data.cameraLabel}". Return JSON: {"detected": boolean, "title": string, "description": string (1-2 sentences), "category": one of [Fire,Smoke,Flood,"Road Accident","Fallen Person","Crowd Congestion","Unauthorized Intrusion","Suspicious Activity"] or "", "severity_score": integer 1-100, "confidence": number 0-100, "recommended_actions": string[] (3 short imperative actions)}. If nothing notable, return {"detected": false, ...empty fields...}.`,
                },
                { type: "image_url", image_url: { url: data.imageDataUrl } },
              ],
            },
          ],
          temperature: 0.2,
        }),
      });

      if (res.status === 429 || res.status === 402) {
        const sim = fallbackSimulated(data.cameraLabel);
        return { ...sim, severity_level: sim.detected ? scoreToLevel(sim.severity_score) : "Low", source: "simulated" as const };
      }
      if (!res.ok) throw new Error(`AI gateway ${res.status}`);
      const json = await res.json();
      const raw: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as AnalysisResult;
      const score = Math.max(0, Math.min(100, Math.round(parsed.severity_score ?? 0)));
      return {
        detected: !!parsed.detected,
        title: parsed.title ?? "",
        description: parsed.description ?? "",
        category: parsed.category ?? "",
        severity_score: score,
        confidence: +(parsed.confidence ?? 0),
        recommended_actions: Array.isArray(parsed.recommended_actions)
          ? parsed.recommended_actions.slice(0, 5)
          : [],
        severity_level: scoreToLevel(score),
        source: "gemini" as const,
      };
    } catch (e) {
      console.error("[analyzeFrame] AI failed, using simulation:", e);
      const sim = fallbackSimulated(data.cameraLabel);
      return { ...sim, severity_level: sim.detected ? scoreToLevel(sim.severity_score) : "Low", source: "simulated" as const };
    }
  });

const SeedInput = z.object({ count: z.number().int().min(1).max(40) });

export const seedSampleIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SeedInput.parse(input))
  .handler(async ({ data, context }) => {
    const rows = Array.from({ length: data.count }).map((_, i) => {
      const sim = fallbackSimulated(`Cam-0${(i % 4) + 1}`);
      const detected = sim.detected || i === 0;
      const cat = detected ? sim.category : "Suspicious Activity";
      const score = detected ? sim.severity_score : 20 + Math.floor(Math.random() * 60);
      const level = scoreToLevel(score);
      const hoursAgo = Math.random() * 72;
      const detected_at = new Date(Date.now() - hoursAgo * 3600_000).toISOString();
      const status: "active" | "acknowledged" | "resolved" =
        hoursAgo > 24 ? "resolved" : hoursAgo > 6 ? "acknowledged" : "active";
      return {
        user_id: context.userId,
        title: sim.title || `${cat} Detected`,
        description: sim.description || `Anomaly detected on Cam-0${(i % 4) + 1}.`,
        category: cat,
        severity_score: score,
        severity_level: level,
        camera_label: `Cam-0${(i % 4) + 1}`,
        confidence: +(70 + Math.random() * 29).toFixed(1),
        recommended_actions: sim.recommended_actions.length
          ? sim.recommended_actions
          : ["Tag for human review", "Notify on-call operator"],
        status,
        detected_at,
        resolved_at: status === "resolved" ? new Date().toISOString() : null,
      };
    });
    const { error } = await context.supabase.from("incidents").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
