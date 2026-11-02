/**
 * PATCHLINE demo dataset.
 * All values are synthetic and labelled as demo data in the UI — no live
 * backend is attached. Replace this module with API integration later.
 *
 * Demo region: Pakhal Wildlife Sanctuary, Warangal district, Telangana, India.
 */

export type Severity = "critical" | "high" | "medium" | "low";
export type DetectionStatus = "new" | "investigating" | "resolved";

export interface Detection {
  id: string;
  date: string;
  region: string;
  areaHa: number;
  lat: number;
  lon: number;
  severity: Severity;
  status: DetectionStatus;
  evidence: boolean;
  polygon: [number, number][];
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  critical: "#c75a50",
  high: "#d6a45b",
  medium: "#789477",
  low: "#5f6b62",
};

export const REGION = {
  name: "Pakhal PS-1",
  subregion: "Pakhal Wildlife Sanctuary · Warangal, Telangana",
  center: [17.95, 79.88] as [number, number],
  monitoredKm2: 879,
  lastUpdated: "8 min ago",
};

export const DETECTIONS: Detection[] = [
  {
    id: "PL-2026-0841",
    date: "2026-10-31",
    region: "Pakhal East · Lakeshore",
    areaHa: 24.6,
    lat: 17.945,
    lon: 79.885,
    severity: "critical",
    status: "new",
    evidence: true,
    polygon: [
      [17.942, 79.881],
      [17.942, 79.89],
      [17.9455, 79.892],
      [17.948, 79.891],
      [17.948, 79.883],
      [17.945, 79.881],
    ],
  },
  {
    id: "PL-2026-0839",
    date: "2026-10-30",
    region: "Pakhal East Ridge",
    areaHa: 12.4,
    lat: 17.99,
    lon: 79.93,
    severity: "high",
    status: "new",
    evidence: true,
    polygon: [
      [17.987, 79.927],
      [17.987, 79.934],
      [17.994, 79.934],
      [17.994, 79.927],
    ],
  },
  {
    id: "PL-2026-0836",
    date: "2026-10-28",
    region: "Narsampet Range",
    areaHa: 41.8,
    lat: 17.9,
    lon: 79.84,
    severity: "high",
    status: "investigating",
    evidence: true,
    polygon: [
      [17.896, 79.836],
      [17.896, 79.846],
      [17.904, 79.846],
      [17.904, 79.836],
    ],
  },
  {
    id: "PL-2026-0830",
    date: "2026-10-24",
    region: "Pakhal West",
    areaHa: 9.2,
    lat: 17.97,
    lon: 79.81,
    severity: "medium",
    status: "investigating",
    evidence: false,
    polygon: [
      [17.967, 79.807],
      [17.967, 79.813],
      [17.974, 79.813],
      [17.974, 79.807],
    ],
  },
  {
    id: "PL-2026-0822",
    date: "2026-10-19",
    region: "Laknavaram Fringe",
    areaHa: 15.1,
    lat: 18.04,
    lon: 79.96,
    severity: "medium",
    status: "new",
    evidence: true,
    polygon: [
      [18.037, 79.957],
      [18.037, 79.963],
      [18.044, 79.963],
      [18.044, 79.957],
    ],
  },
  {
    id: "PL-2026-0818",
    date: "2026-10-15",
    region: "Tadvai Boundary",
    areaHa: 58.3,
    lat: 17.86,
    lon: 79.78,
    severity: "critical",
    status: "investigating",
    evidence: true,
    polygon: [
      [17.856, 79.776],
      [17.856, 79.785],
      [17.863, 79.785],
      [17.863, 79.776],
    ],
  },
  {
    id: "PL-2026-0812",
    date: "2026-10-11",
    region: "Mahabubabad Fringe",
    areaHa: 27.9,
    lat: 17.8,
    lon: 79.86,
    severity: "high",
    status: "new",
    evidence: false,
    polygon: [
      [17.797, 79.857],
      [17.797, 79.864],
      [17.804, 79.864],
      [17.804, 79.857],
    ],
  },
  {
    id: "PL-2026-0805",
    date: "2026-10-04",
    region: "Govindapuram Block",
    areaHa: 5.5,
    lat: 17.92,
    lon: 79.94,
    severity: "low",
    status: "resolved",
    evidence: true,
    polygon: [
      [17.918, 79.938],
      [17.918, 79.943],
      [17.923, 79.943],
      [17.923, 79.938],
    ],
  },
  {
    id: "PL-2026-0798",
    date: "2026-09-27",
    region: "Chunchupalli Block",
    areaHa: 11.7,
    lat: 18.08,
    lon: 79.9,
    severity: "medium",
    status: "resolved",
    evidence: true,
    polygon: [
      [18.077, 79.897],
      [18.077, 79.903],
      [18.084, 79.903],
      [18.084, 79.897],
    ],
  },
];

/** Sanctuary boundary drawn as a dashed overlay on the map. */
export const REGION_BOUNDARY: [number, number][] = [
  [17.78, 80.02],
  [17.78, 79.74],
  [17.92, 79.71],
  [18.08, 79.72],
  [18.14, 79.82],
  [18.12, 79.98],
  [18.02, 80.05],
  [17.9, 80.06],
];

export interface Alert {
  id: string;
  severity: Severity;
  title: string;
  region: string;
  time: string;
  read: boolean;
}

export const ALERTS: Alert[] = [
  {
    id: "AL-0431",
    severity: "critical",
    title: "Rapid canopy loss — 18 ha in 48 h",
    region: "Pakhal East · Lakeshore",
    time: "42 min ago",
    read: false,
  },
  {
    id: "AL-0430",
    severity: "high",
    title: "New approach-road intrusion detected",
    region: "Pakhal East Ridge",
    time: "2 h ago",
    read: false,
  },
  {
    id: "AL-0429",
    severity: "high",
    title: "Thermal signature near Tadvai boundary",
    region: "Tadvai Boundary",
    time: "5 h ago",
    read: false,
  },
  {
    id: "AL-0428",
    severity: "medium",
    title: "Sensor coverage in Narsampet dropped to 4/5",
    region: "Narsampet Range",
    time: "Yesterday, 21:40",
    read: true,
  },
  {
    id: "AL-0427",
    severity: "low",
    title: "Model retraining finished — v4.2 deployed",
    region: "System",
    time: "Yesterday, 14:05",
    read: true,
  },
];

export interface RegionStatus {
  name: string;
  status: "nominal" | "degraded" | "critical";
  coverage: number;
  sensorsOnline: string;
}

export const REGION_STATUSES: RegionStatus[] = [
  { name: "Pakhal East", status: "critical", coverage: 96, sensorsOnline: "5/5 sensors" },
  { name: "Narsampet Range", status: "degraded", coverage: 74, sensorsOnline: "4/5 sensors" },
  { name: "Pakhal West", status: "nominal", coverage: 100, sensorsOnline: "5/5 sensors" },
  { name: "Tadvai Boundary", status: "degraded", coverage: 82, sensorsOnline: "3/5 sensors" },
];

export interface Activity {
  type: "detection" | "alert" | "report" | "sync";
  text: string;
  time: string;
  user: string;
}

export const ACTIVITY: Activity[] = [
  { type: "alert", text: "Critical alert raised for PL-2026-0841", time: "08:42", user: "PATCHLINE AI" },
  { type: "detection", text: "Polygon area corrected (+1.2 ha) for PL-2026-0836", time: "08:15", user: "M. Okafor" },
  { type: "report", text: "Monthly evidence bundle exported — 14 reports", time: "07:50", user: "L. Ferreira" },
  { type: "sync", text: "Sentinel-2 pass ingested — 3 tiles, QC passed", time: "07:12", user: "System" },
  { type: "detection", text: "PL-2026-0812 escalated to priority queue", time: "06:58", user: "R. Santos" },
  { type: "report", text: "Field photos attached to PL-2026-0798", time: "Yesterday", user: "J. Watanabe" },
];

/** Weekly detection counts, Monday = week start. */
export const WEEKLY_HISTORY: { label: string; count: number }[] = [
  { label: "W27", count: 9 },
  { label: "W28", count: 6 },
  { label: "W29", count: 11 },
  { label: "W30", count: 14 },
  { label: "W31", count: 7 },
  { label: "W32", count: 12 },
  { label: "W33", count: 8 },
  { label: "W34", count: 10 },
];

/** Forest-loss hectares per month (rolling 12 months). */
export const MONTHLY_TREND: { label: string; value: number }[] = [
  { label: "Nov", value: 118 },
  { label: "Dec", value: 102 },
  { label: "Jan", value: 96 },
  { label: "Feb", value: 84 },
  { label: "Mar", value: 91 },
  { label: "Apr", value: 134 },
  { label: "May", value: 158 },
  { label: "Jun", value: 171 },
  { label: "Jul", value: 149 },
  { label: "Aug", value: 176 },
  { label: "Sep", value: 163 },
  { label: "Oct", value: 182 },
];

export interface Investigation {
  id: string;
  detectionId: string;
  officer: string;
  stage: "triage" | "field-verification" | "evidence-review" | "enforcement";
  progress: number;
  due: string;
}

export const INVESTIGATIONS: Investigation[] = [
  { id: "INV-118", detectionId: "PL-2026-0836", officer: "M. Okafor", stage: "evidence-review", progress: 72, due: "Nov 6" },
  { id: "INV-117", detectionId: "PL-2026-0830", officer: "R. Santos", stage: "field-verification", progress: 40, due: "Nov 4" },
  { id: "INV-116", detectionId: "PL-2026-0818", officer: "L. Ferreira", stage: "enforcement", progress: 94, due: "Nov 2" },
  { id: "INV-115", detectionId: "PL-2026-0812", officer: "Unassigned", stage: "triage", progress: 8, due: "Nov 9" },
];

export const STATS = {
  monitoredKm2: REGION.monitoredKm2,
  changes: 1146,
  highPriority: 23,
  pendingInvestigations: 11,
};

export const FAQ: { q: string; a: string }[] = [
  {
    q: "What does PATCHLINE monitor?",
    a: "PATCHLINE continuously ingests satellite passes (Sentinel-2, and commercial imagery where available) together with in-field sensor telemetry, then runs change-detection models to flag canopy loss, approach-road creation and burn signatures across the monitored reserve.",
  },
  {
    q: "How fresh is the detection data?",
    a: "Demonstration data in this deployment is static. In production, detections appear within 20 minutes of a satellite pass being ingested, and map tiles are refreshed on every revisit of the active region.",
  },
  {
    q: "What determines investigation priority?",
    a: "Priority blends severity (affected hectares and loss velocity), proximity to sanctuary boundaries, trend history in the same cell, and evidence availability. Critical detections enter the queue automatically.",
  },
  {
    q: "Who can export evidence bundles?",
    a: "Field-verified investigations can be exported as signed PDF bundles — imagery chips, polygon geometry, coordinates and the full activity trail — by team leads and enforcement officers.",
  },
  {
    q: "Is this interface connected to a live backend?",
    a: "No. This build renders a clearly labelled demo dataset for the Pakhal sector so the interface, map and workflows can be reviewed end-to-end without credentials.",
  },
];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const STATUS_LABEL: Record<DetectionStatus, string> = {
  new: "New",
  investigating: "Investigating",
  resolved: "Resolved",
};
