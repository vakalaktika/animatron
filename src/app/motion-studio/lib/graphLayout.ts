/** Optional, bounded presentation data. Never consulted by the evaluator. */
export interface GraphEditor {
  motionGraph: {
    version: 1;
    positions: Record<string, { x: number; y: number }>;
    viewport?: { x: number; y: number; zoom: number };
  };
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const coordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000;
const point = (value: unknown): value is { x: number; y: number } => object(value) && coordinate(value.x) && coordinate(value.y);

export function sanitizeGraphEditor(value: unknown): GraphEditor | undefined {
  if (!object(value) || !object(value.motionGraph)) return undefined;
  const graph = value.motionGraph;
  if (graph.version !== 1 || !object(graph.positions)) return undefined;
  const positions = Object.fromEntries(Object.entries(graph.positions).slice(0, 2048).filter(([id, p]) =>
    id.length <= 1024 && !["__proto__", "prototype", "constructor"].includes(id) && point(p)
  ).map(([id, p]) => [id, { x: (p as { x: number }).x, y: (p as { y: number }).y }]));
  const viewport = graph.viewport;
  const zoom = object(viewport) ? viewport.zoom : undefined;
  return { motionGraph: { version: 1, positions, ...(point(viewport) && typeof zoom === "number" && Number.isFinite(zoom) && zoom >= 0.1 && zoom <= 4
    ? { viewport: { x: viewport.x, y: viewport.y, zoom } } : {}) } };
}
