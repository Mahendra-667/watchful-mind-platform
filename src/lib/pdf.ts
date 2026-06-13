import { jsPDF } from "jspdf";
import { format } from "date-fns";
import type { IncidentRow } from "@/components/sentinel/IncidentStream";

export function generateIncidentReport(incident: IncidentRow) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  // Header band
  doc.setFillColor(20, 20, 22);
  doc.rect(0, 0, W, 72, "F");
  doc.setTextColor(110, 231, 183);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("SENTINEL AI · INCIDENT REPORT", M, 32);
  doc.setTextColor(170, 170, 175);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Report generated ${format(new Date(), "PPpp")}`, M, 50);

  y = 110;
  doc.setTextColor(20, 20, 22);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(incident.title, M, y, { maxWidth: W - M * 2 });
  y += 28;

  // Meta grid
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 115);
  const meta: Array<[string, string]> = [
    ["Incident ID", incident.id.slice(0, 8).toUpperCase()],
    ["Category", incident.category],
    ["Camera", incident.camera_label],
    ["Detected", format(new Date(incident.detected_at), "PPpp")],
    ["Severity", `${incident.severity_level} (${incident.severity_score}/100)`],
    ["Confidence", `${incident.confidence.toFixed(1)}%`],
    ["Status", incident.status.toUpperCase()],
  ];
  meta.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * ((W - M * 2) / 2);
    const ry = y + row * 30;
    doc.setTextColor(140, 140, 145);
    doc.setFontSize(8);
    doc.text(k.toUpperCase(), x, ry);
    doc.setTextColor(20, 20, 22);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(v, x, ry + 14);
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(meta.length / 2) * 30 + 16;

  // Description
  sectionHeading(doc, "Description", M, y);
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 45);
  const desc = doc.splitTextToSize(incident.description, W - M * 2);
  doc.text(desc, M, y);
  y += desc.length * 14 + 18;

  // Recommended actions
  sectionHeading(doc, "Recommended Actions", M, y);
  y += 18;
  doc.setFontSize(10);
  (incident.recommended_actions || []).forEach((a, i) => {
    doc.setTextColor(16, 185, 129);
    doc.text(`${i + 1}.`, M, y);
    doc.setTextColor(40, 40, 45);
    const lines = doc.splitTextToSize(a, W - M * 2 - 18);
    doc.text(lines, M + 18, y);
    y += lines.length * 14 + 4;
  });
  y += 12;

  // Resolution notes
  sectionHeading(doc, "Resolution Notes", M, y);
  y += 18;
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 45);
  const notes =
    incident.status === "resolved"
      ? "Incident marked resolved by operator. No further action required."
      : incident.status === "acknowledged"
        ? "Acknowledged by operator. Pending field verification and closeout."
        : "Active — automated response in progress. Awaiting operator confirmation.";
  const nl = doc.splitTextToSize(notes, W - M * 2);
  doc.text(nl, M, y);

  // Footer
  const H = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 145);
  doc.text("Sentinel AI · Autonomous Anomaly Detection Platform", M, H - 24);
  doc.text("Confidential", W - M, H - 24, { align: "right" });

  doc.save(`sentinel-incident-${incident.id.slice(0, 8)}.pdf`);
}

function sectionHeading(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129);
  doc.setFont("helvetica", "bold");
  doc.text(text.toUpperCase(), x, y);
  doc.setDrawColor(220, 220, 225);
  doc.line(x, y + 4, x + 60, y + 4);
  doc.setFont("helvetica", "normal");
}
