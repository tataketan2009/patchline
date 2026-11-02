/** Accepts a GeoJSON object and returns polygon rings as [lat, lon][]. */
export function parseGeoJSON(gj: { type: string; features?: unknown[] }): [number, number][][] {
  const out: [number, number][][] = [];
  const features = gj.type === "FeatureCollection" ? (gj.features ?? []) : [gj];
  for (const f of features) {
    const g = (f as { geometry?: typeof f })?.geometry ?? f;
    if (!g) continue;
    const t = (g as { type?: string }).type;
    const shapes: unknown[] = [];
    if (t === "Polygon") shapes.push((g as { coordinates: unknown }).coordinates);
    else if (t === "MultiPolygon") shapes.push(...((g as { coordinates: unknown[] }).coordinates));
    for (const s of shapes) {
      const ring = (s as [number, number][][])[0];
      if (Array.isArray(ring)) out.push(ring.map(([lon, lat]) => [lat, lon] as [number, number]));
    }
  }
  return out;
}
