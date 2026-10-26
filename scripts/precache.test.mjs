import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fillWorker, listFiles } from "./precache.mjs";

describe("precache", () => {
  test("lists nested build files with forward slashes, sorted", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "precache-"));
    await mkdir(path.join(dir, "chunks"));
    await writeFile(path.join(dir, "chunks", "b.js"), "");
    await writeFile(path.join(dir, "a.css"), "");
    expect(await listFiles(dir)).toEqual(["a.css", "chunks/b.js"]);
  });

  test("fills the version and the file list into the worker", () => {
    const source = 'const VERSION = "animatron-dev";\nconst PRECACHE = [];\n';
    expect(fillWorker(source, { version: "animatron-abc", files: ["/x/_next/static/a.js"] })).toBe(
      'const VERSION = "animatron-abc";\nconst PRECACHE = ["/x/_next/static/a.js"];\n',
    );
  });

  test("refuses a worker without its placeholders", () => {
    expect(() => fillWorker("self.x = 1;", { version: "v", files: [] })).toThrow("placeholder");
  });
});
