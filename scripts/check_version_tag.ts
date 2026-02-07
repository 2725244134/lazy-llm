import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Args = {
  expectedVersion: string;
};

function parseArgs(argv: string[]): Args {
  const args: Partial<Args> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--expected-version") {
      const value = argv[i + 1];
      if (!value) throw new Error("Missing value for --expected-version");
      args.expectedVersion = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.expectedVersion) throw new Error("Missing required --expected-version");
  return args as Args;
}

function normalizeTagVersion(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

function readPackageVersion(path: string): string {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw) as Record<string, unknown>;
  const value = data.version;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing version in ${path}`);
  }
  return value;
}

function main() {
  const { expectedVersion } = parseArgs(process.argv.slice(2));
  const expected = normalizeTagVersion(expectedVersion);

  const packageJsonPath = resolve("package.json");
  const packageVersion = readPackageVersion(packageJsonPath);

  if (packageVersion !== expected) {
    throw new Error(
      `Version mismatch: expected ${expected} (from tag ${expectedVersion}), got package.json=${packageVersion}`,
    );
  }

  console.log(`ok: version matches ${expected} (tag=${expectedVersion})`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`error: ${message}`);
  process.exitCode = 1;
}
