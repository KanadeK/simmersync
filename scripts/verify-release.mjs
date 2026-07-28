import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = join(root, "release");
const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const version = packageJson.version;
const expected = [
  "SHA256SUMS",
  `simmersync-${version}.tgz`,
  `simmersync-demo-v${version}.zip`,
  `simmersync-v${version}-release-notes.md`,
].sort();
const actual = (await readdir(release)).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  throw new Error(`Unexpected release files.\nExpected: ${expected}\nActual: ${actual}`);
}

const checksumText = await readFile(join(release, "SHA256SUMS"), "utf8");
for (const line of checksumText.trim().split("\n")) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
  if (!match) {
    throw new Error(`Invalid checksum line: ${line}`);
  }
  const [, expectedDigest, filename] = match;
  const actualDigest = createHash("sha256")
    .update(await readFile(join(release, filename)))
    .digest("hex");
  if (actualDigest !== expectedDigest) {
    throw new Error(`Checksum mismatch for ${filename}`);
  }
}

const archive = unzipSync(await readFile(join(release, `simmersync-demo-v${version}.zip`)));
for (const required of [
  "examples/sunday-roast.yaml",
  "examples/weeknight-bowls.yaml",
  "examples/simmersync.schema.json",
  "generated/schedule.json",
  "generated/schedule.csv",
  "generated/schedule.ics",
  "generated/cook-mode.html",
  "generated/summary.txt",
]) {
  if (!archive[required]) {
    throw new Error(`Demo archive is missing ${required}`);
  }
}

const temporary = await mkdtemp(join(tmpdir(), "simmersync-release-"));
try {
  await writeFile(join(temporary, "package.json"), '{"private":true,"type":"module"}\n');
  execFileSync(
    "npm",
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      join(temporary, ".npm-cache"),
      join(release, `simmersync-${version}.tgz`),
    ],
    { cwd: temporary, stdio: "pipe" },
  );
  const executable =
    process.platform === "win32"
      ? join(temporary, "node_modules", ".bin", "simmersync.cmd")
      : join(temporary, "node_modules", ".bin", "simmersync");
  const reportedVersion = execFileSync(executable, ["--version"], {
    cwd: temporary,
    encoding: "utf8",
  }).trim();
  if (reportedVersion !== version) {
    throw new Error(`Installed CLI reported ${reportedVersion}, expected ${version}`);
  }
  const sample = join(temporary, "sunday-roast.yaml");
  await writeFile(sample, archive["examples/sunday-roast.yaml"]);
  execFileSync(executable, ["validate", sample], { cwd: temporary, stdio: "pipe" });
  execFileSync(
    executable,
    ["plan", sample, "--serve-at", "2026-07-28T19:00:00+01:00", "--no-write", "--quiet"],
    { cwd: temporary, stdio: "pipe" },
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

console.log(
  `Release verified: ${expected.length} files, checksums valid, ${basename(
    join(release, `simmersync-${version}.tgz`),
  )} installs and runs.`,
);
