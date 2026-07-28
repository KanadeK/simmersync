import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = packageJson.version;
const release = join(root, "release");
const demo = join(release, ".demo");

await rm(release, { recursive: true, force: true });
await mkdir(demo, { recursive: true });

execFileSync(
  process.execPath,
  [
    join(root, "dist", "cli.js"),
    "plan",
    join(root, "examples", "sunday-roast.yaml"),
    "--serve-at",
    "2026-07-28T19:00:00+01:00",
    "--out",
    demo,
    "--quiet",
  ],
  { cwd: root, stdio: "inherit" },
);

const packResult = JSON.parse(
  execFileSync(
    "npm",
    [
      "pack",
      "--ignore-scripts",
      "--json",
      "--pack-destination",
      release,
      "--cache",
      join(root, ".npm-cache"),
    ],
    { cwd: root, encoding: "utf8" },
  ),
);
if (!Array.isArray(packResult) || !packResult[0]?.filename) {
  throw new Error("npm pack did not return an artifact filename.");
}

const zipEntries = {};
for (const source of [
  join(root, "examples", "sunday-roast.yaml"),
  join(root, "examples", "weeknight-bowls.yaml"),
  join(root, "schema", "simmersync.schema.json"),
]) {
  zipEntries[`examples/${relative(join(root, "examples"), source).replace("../schema/", "")}`] =
    new Uint8Array(await readFile(source));
}
for (const filename of await readdir(demo)) {
  zipEntries[`generated/${filename}`] = new Uint8Array(await readFile(join(demo, filename)));
}
zipEntries["README.txt"] = strToU8(
  [
    `SimmerSync ${version} demo bundle`,
    "",
    "1. Install the .tgz package from the GitHub Release:",
    "   npm install --global ./simmersync-0.1.0.tgz",
    "2. Validate the sample:",
    "   simmersync validate examples/sunday-roast.yaml",
    "3. Generate a fresh plan:",
    '   simmersync plan examples/sunday-roast.yaml --serve-at "2026-07-28T19:00:00+01:00"',
    "",
    "The generated folder contains a verified JSON/CSV/ICS schedule and offline Cook Mode HTML.",
    "",
  ].join("\n"),
);
const demoZip = `simmersync-demo-v${version}.zip`;
await writeFile(join(release, demoZip), zipSync(zipEntries, { level: 9 }));

const notesName = `simmersync-v${version}-release-notes.md`;
await writeFile(
  join(release, notesName),
  `# SimmerSync v${version}

First public release of the resource-aware backward scheduler for multi-dish meals.

## Highlights

- Deterministic backward scheduling from a target serve time
- Capacity-aware cook, oven, burner, counter, and custom resources
- Cross-dish dependencies and active/passive work
- JSON, CSV, ICS, terminal, and offline Cook Mode HTML outputs
- Actionable validation and infeasible-plan diagnostics
- English and Simplified Chinese documentation

## Install

\`\`\`bash
npm install --global ./simmersync-${version}.tgz
simmersync validate examples/sunday-roast.yaml
\`\`\`

Verify downloads with \`SHA256SUMS\`.
`,
  "utf8",
);

await rm(demo, { recursive: true, force: true });
const assetNames = (await readdir(release))
  .filter((name) => name !== "SHA256SUMS")
  .sort((left, right) => left.localeCompare(right));
const sums = [];
for (const name of assetNames) {
  const digest = createHash("sha256")
    .update(await readFile(join(release, name)))
    .digest("hex");
  sums.push(`${digest}  ${name}`);
}
await writeFile(join(release, "SHA256SUMS"), `${sums.join("\n")}\n`, "utf8");
console.log(`Built ${assetNames.length} release assets plus SHA256SUMS in ${release}`);
