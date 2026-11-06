import { sanitizeGraphEditor } from "./graphLayout";
import { normalizeDoc } from "./migrate";
import { welcomePreset } from "../presets";

test("graph layout is bounded plain editor data, never executable motion", () => {
  expect(sanitizeGraphEditor({ motionGraph: { version: 1, positions: { good: { x: 10, y: 20 }, bad: { x: Infinity, y: 1 } }, viewport: { x: 2, y: 3, zoom: 1 }, script: "ignored" } })).toEqual({ motionGraph: { version: 1, positions: { good: { x: 10, y: 20 } }, viewport: { x: 2, y: 3, zoom: 1 } } });
  expect(sanitizeGraphEditor({ motionGraph: { version: 2, positions: {} } })).toBeUndefined();
  expect(sanitizeGraphEditor(null)).toBeUndefined();
  expect(sanitizeGraphEditor({ motionGraph: { version: 1, positions: { distant: { x: 1e20, y: 1 } }, viewport: { x: 0, y: 0, zoom: -1 } } })).toEqual({ motionGraph: { version: 1, positions: {} } });
});

test("layout survives save/reopen without changing evaluation data", () => {
  const doc = welcomePreset();
  const editor = { motionGraph: { version: 1 as const, positions: { object: { x: 10, y: 20 } } } };
  const restored = normalizeDoc(JSON.parse(JSON.stringify({ ...doc, editor }))).doc;
  expect(restored.editor).toEqual(editor);
  expect(restored.clips).toEqual(normalizeDoc(doc).doc.clips);
  expect(normalizeDoc({ ...doc, editor: { motionGraph: { version: 7, positions: {} } } } as never).doc.editor).toBeUndefined();
});

test("malicious keys and excessive layout entries are dropped", () => {
  const positions = JSON.parse('{"__proto__":{"x":1,"y":2},"constructor":{"x":1,"y":2}}');
  expect(sanitizeGraphEditor({ motionGraph: { version: 1, positions } })?.motionGraph.positions).toEqual({});
  const many = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`node-${i}`, { x: i, y: 0 }]));
  expect(Object.keys(sanitizeGraphEditor({ motionGraph: { version: 1, positions: many } })!.motionGraph.positions).length).toBeLessThanOrEqual(2048);
});
