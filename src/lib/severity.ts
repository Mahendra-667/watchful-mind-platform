export type SeverityLevel = "Low" | "Medium" | "High" | "Critical";

export function scoreToLevel(score: number): SeverityLevel {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export const severityClasses: Record<
  SeverityLevel,
  { text: string; bg: string; ring: string; border: string }
> = {
  Low: {
    text: "text-sev-low",
    bg: "bg-sev-low/10",
    ring: "ring-sev-low/20",
    border: "border-sev-low",
  },
  Medium: {
    text: "text-sev-medium",
    bg: "bg-sev-medium/10",
    ring: "ring-sev-medium/20",
    border: "border-sev-medium",
  },
  High: {
    text: "text-sev-high",
    bg: "bg-sev-high/10",
    ring: "ring-sev-high/20",
    border: "border-sev-high",
  },
  Critical: {
    text: "text-sev-critical",
    bg: "bg-sev-critical/10",
    ring: "ring-sev-critical/20",
    border: "border-sev-critical",
  },
};

export const DETECTION_CATEGORIES = [
  "Fire",
  "Smoke",
  "Flood",
  "Road Accident",
  "Fallen Person",
  "Crowd Congestion",
  "Unauthorized Intrusion",
  "Suspicious Activity",
] as const;

export type DetectionCategory = (typeof DETECTION_CATEGORIES)[number];
