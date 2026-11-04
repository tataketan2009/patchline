import type { Detection } from "./data";

/**
 * Builds a self-contained HTML evidence report for one detection.
 * No backend required — safe for demo environments.
 */
function evidenceHtml(d: Detection): string {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PATCHLINE Evidence Report — ${d.id}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#1c211c;max-width:720px;margin:32px auto;padding:0 16px}
  h1{font-size:20px;border-bottom:2px solid #466049;padding-bottom:8px}
  h2{font-size:14px;margin-top:24px;color:#466049}
  table{border-collapse:collapse;width:100%;font-size:13px}
  td,th{border:1px solid #ccc;padding:6px 10px;text-align:left}
  th{background:#f1efe8}
  .mono{font-family:"Courier New",monospace}
  .badge{display:inline-block;padding:2px 10px;border-radius:999px;background:#abe0cf;color:#1c211c;font-size:12px}
  .footer{margin-top:32px;font-size:11px;color:#68705f;border-top:1px solid #ccc;padding-top:8px}
</style>
</head>
<body>
<h1>PATCHLINE Evidence Report <span class="badge">DEMO DATA</span></h1>
<p>Generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</p>

<h2>Detection summary</h2>
<table>
  <tr><th>Detection ID</th><td class="mono">${d.id}</td></tr>
  <tr><th>Detected date</th><td class="mono">${d.date}</td></tr>
  <tr><th>Region</th><td>${d.region} (Pakhal Wildlife Sanctuary, Warangal, Telangana)</td></tr>
  <tr><th>Severity</th><td>${d.severity}</td></tr>
  <tr><th>Status</th><td>${d.status}</td></tr>
  <tr><th>Estimated affected area</th><td>${d.areaHa.toFixed(1)} ha</td></tr>
  <tr><th>Centroid coordinates</th><td class="mono">${d.lat.toFixed(4)}°, ${d.lon.toFixed(4)}°</td></tr>
  <tr><th>Evidence bundle</th><td>${d.evidence ? "Available — imagery chips, shapefile, activity trail" : "Pending capture — next pass"}</td></tr>
</table>

<h2>Polygon geometry (WGS84)</h2>
<p class="mono" style="font-size:12px;white-space:pre-wrap">${d.polygon.map((p) => `[${p[0].toFixed(4)}, ${p[1].toFixed(4)}]`).join("\n")}</p>

<h2>Chain of activity</h2>
<table>
  <tr><th>Time</th><th>Event</th><th>Actor</th></tr>
  <tr><td>Detection pass</td><td>Change flagged by change-detection model</td><td>PATCHLINE AI</td></tr>
  <tr><td>Review</td><td>Polygon inspected, area confirmed</td><td>Analyst</td></tr>
  <tr><td>Export</td><td>Evidence report generated</td><td>Operator session</td></tr>
</table>

<div class="footer">
PATCHLINE — Forest Intelligence Platform · Synthetic demo dataset for interface evaluation. Not an official enforcement record.
</div>
</body>
</html>`;
  return html;
}

/** HTML evidence report as an instant download. */
export function downloadEvidenceReport(d: Detection) {
  const html = evidenceHtml(d);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `patchline-evidence-${d.id}.html`;
  // Some engines only allow downloads from anchors attached to the DOM.
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** PDF export: opens the evidence report and triggers the browser print
 *  dialog ("Save as PDF"). No dependency needed; honest and universal. */
export function printEvidenceReport(d: Detection) {
  const html = evidenceHtml(d);
  const w = window.open("", "_blank", "width=720,height=880");
  if (!w) {
    // Popup blocked — fall back to the HTML download.
    downloadEvidenceReport(d);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  window.setTimeout(() => {
    try {
      w.print();
    } catch {
      /* some engines require manual Ctrl+P; document is already open */
    }
  }, 250);
}

/** CSV export (Excel/GIS-friendly). Backend mirror: GET /api/export/detections.csv */
export function downloadDetectionsCsv(rows: Detection[]) {
  const esc = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["detection_id", "date", "region", "area_ha", "lat", "lon", "severity", "status", "evidence"];
  const lines = rows.map((d) =>
    [d.id, d.date, d.region, d.areaHa.toFixed(2), d.lat, d.lon, d.severity, d.status, d.evidence].map(esc).join(","),
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "patchline-detections.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

