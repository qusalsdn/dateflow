import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const output = mkdtempSync(join(tmpdir(), "dateflow-tests-"));
const tests = readdirSync("tests").filter((file) => file.endsWith(".test.ts"));
try {
  const compilation = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--ignoreConfig", ...tests.map((file) => `tests/${file}`), "--outDir", output, "--module", "commonjs", "--moduleResolution", "node", "--ignoreDeprecations", "6.0", "--target", "ES2022", "--types", "node", "--strict", "--esModuleInterop", "--skipLibCheck"], { stdio: "inherit" });
  if (compilation.status !== 0) process.exitCode = compilation.status ?? 1;
  else {
    const result = spawnSync(process.execPath, ["--conditions=react-server", "--test", ...tests.map((file) => join(output, "tests", file.replace(/\.ts$/, ".js")))], { stdio: "inherit", env: { ...process.env, NODE_PATH: resolve("node_modules") } });
    process.exitCode = result.status ?? 1;
  }
} finally { rmSync(output, { recursive: true, force: true }); }
