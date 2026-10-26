// Structural check of a .mci.json against the Mid-century Ink Rig 1 contract,
// using the shared reference runtime. Usage: node docs/mci-rig/validate-rig.cjs asset.mci.json
const fs = require("node:fs");
const C = require("./mci-rig-core.cjs");
try {
  const path = process.argv[2];
  if (!path) throw Error("Usage: node validate-rig.cjs asset.mci.json");
  const bytes = fs.statSync(path).size;
  if (bytes > 4000000) throw Error("Rig exceeds 4 MB.");
  const check = C.validate(JSON.parse(fs.readFileSync(path, "utf8")));
  if (!check.ok) throw Error(check.errors.join("\n"));
  console.log("Rig 1 structural checks passed. SVG rendering and destination import still require verification.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
