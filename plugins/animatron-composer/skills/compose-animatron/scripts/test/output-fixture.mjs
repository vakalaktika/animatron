// Deliberately exceeds spawnSync's default 1 MiB output buffer.
import { writeFileSync } from "node:fs";
const result = { ok: true, payload: "x".repeat(5 * 1024 * 1024) };
writeFileSync(1, `RESULT ${JSON.stringify(result)}\n`);
process.exitCode = Number(process.argv[2] ?? 0);
