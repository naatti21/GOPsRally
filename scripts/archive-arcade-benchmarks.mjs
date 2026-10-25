// Usage: node scripts/archive-arcade-benchmarks.mjs before|after
// Set RALLY_VEHICLE_MODULE to an archived baseline vehicle.js for before.
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { benchmarkSteerOnly } from "./steer-only-drift-benchmark.mjs";
import { benchmarkArcade } from "./arcade-dynamics-benchmark.mjs";
const name = process.argv[2];
if (!["before", "after"].includes(name)) throw Error("Choose before or after");
if (name === "before" && !process.env.RALLY_VEHICLE_MODULE)
  throw Error("Before requires an explicitly archived baseline");
const dir = new URL("../docs/metrics/arcade-v045/", import.meta.url);
mkdirSync(dir, { recursive: true });
const save = (suffix, data) =>
  writeFileSync(
    new URL(`${name}-${suffix}.json`, dir),
    JSON.stringify(data, null, 2) + "\n",
  );
for (const [suffix, script] of [
  ["line", "physics-line-lab.mjs"],
  ["corner", "corner-line-benchmark.mjs"],
]) {
  const result = execFileSync(
    process.execPath,
    [new URL(script, import.meta.url).pathname],
    { encoding: "utf8" },
  );
  save(suffix, JSON.parse(result));
}
save("drift", benchmarkSteerOnly());
const contact = benchmarkArcade(),
  traces = [];
for (const s of contact.scenarios) {
  if (
    s.settings.speedKmh === 100 &&
    ["release", "short-catch", "overcorrect"].includes(s.name)
  )
    for (const row of s.trace10Hz)
      traces.push(JSON.stringify({ scenario: s.name, ...row }));
  delete s.trace10Hz;
}
delete contact.braking.trace10Hz;
save("contact", contact);
writeFileSync(new URL(`${name}-traces.ndjson`, dir), traces.join("\n") + "\n");
