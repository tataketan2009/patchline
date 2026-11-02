import { motion } from "framer-motion";
import { FileSearch, Layers, MapPin } from "lucide-react";
import { downloadEvidenceReport } from "../lib/report";
import {
  SEVERITY_COLOR,
  SEVERITY_LABEL,
  type Detection,
} from "../lib/data";
import { Modal, SeverityBadge, StatusBadge } from "./ui";

/** Detailed inspection dialog shared by the map panel, dashboard and table. */
export default function DetectionDetail({
  detection,
  onClose,
}: {
  detection: Detection | null;
  onClose: () => void;
}) {
  return (
    <Modal open={detection !== null} onClose={onClose} title="Detection detail" size="lg">
      {detection && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: SEVERITY_COLOR[detection.severity] }}
              aria-hidden
            />
            <span className="font-mono text-sm font-medium text-ink">{detection.id}</span>
            <span className="text-[12px] text-muted">·</span>
            <SeverityBadge severity={detection.severity} />
            <StatusBadge status={detection.status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Affected area", value: `${detection.areaHa.toFixed(1)} ha` },
              { label: "Detected", value: detection.date },
              { label: "Latitude", value: `${detection.lat.toFixed(4)}°` },
              { label: "Longitude", value: `${detection.lon.toFixed(4)}°` },
            ].map((f) => (
              <div key={f.label} className="rounded-md border border-line bg-canvas px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">{f.label}</p>
                <p className="mt-0.5 font-mono text-[13px] text-ink">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-line bg-canvas p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <MapPin size={12} aria-hidden /> Region
              </p>
              <p className="mt-1 text-[13px] text-ink">{detection.region}</p>
            </div>
            <div className="rounded-md border border-line bg-canvas p-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <FileSearch size={12} aria-hidden /> Evidence
              </p>
              <p className="mt-1 text-[13px] text-ink">
                {detection.evidence ? "Bundle available — 3 items" : "Pending capture — next pass"}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-line bg-canvas p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Layers size={12} aria-hidden /> Polygon geometry
            </p>
            <p className="mt-1 max-h-20 overflow-y-auto font-mono text-[11px] leading-relaxed text-muted">
              {detection.polygon.map((p) => `[${p[0]}, ${p[1]}]`).join(" · ")}
            </p>
          </div>

          {detection.severity === "critical" || detection.severity === "high" ? (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
              <strong className="font-semibold">Priority:</strong> escalate within 48 h — loss velocity exceeds
              {SEVERITY_LABEL[detection.severity] === "Critical" ? " 5 ha/day in this cell." : " 2 ha/day in this cell."}
            </p>
          ) : (
            <p className="mt-3 rounded-md border border-line bg-canvas px-3 py-2 text-[12px] text-muted">
              Routine review — scheduled analyst pass.
            </p>
          )}

          <button
            onClick={() => downloadEvidenceReport(detection)}
            className="mt-3 w-full rounded-md border border-line-strong px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-raised"
          >
            Download evidence report
          </button>
        </motion.div>
      )}
    </Modal>
  );
}
