/**
 * Import boundary guardrails with baseline tolerance.
 *
 * Policy:
 * - `electron/**` must not import `src/**` implementation paths.
 * - `src/**` must not import `electron/**` implementation paths.
 *
 * Existing violations are tolerated through a committed baseline file.
 * New violations fail with non-zero exit status.
 *
 * Usage:
 * - `bun scripts/check_import_boundaries.ts`
 * - `bun scripts/check_import_boundaries.ts --baseline scripts/baselines/import-boundary-baseline.json`
 * - `bun scripts/check_import_boundaries.ts --write-baseline`
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  ALLOWED_CROSS_BOUNDARY_TARGETS,
  diffViolationKeys,
  listBoundarySourceFiles,
  scanImportBoundaryViolations,
  type BoundaryViolation,
} from './lib/importBoundaryCheck.js';

const DEFAULT_BASELINE_PATH = 'scripts/baselines/import-boundary-baseline.json';
const BASELINE_VERSION = 1;

type CliArgs = {
  baselinePath: string;
  writeBaseline: boolean;
};

type BaselineDocument = {
  version: number;
  policy: {
    electronMustNotImportSrc: true;
    srcMustNotImportElectron: true;
    allowedCrossBoundaryTargets: readonly string[];
  };
  violations: string[];
};

function parseArgs(argv: string[]): CliArgs {
  let baselinePath = DEFAULT_BASELINE_PATH;
  let writeBaseline = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--baseline') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --baseline');
      }
      baselinePath = value;
      index += 1;
      continue;
    }

    if (token === '--write-baseline') {
      writeBaseline = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return { baselinePath, writeBaseline };
}

function normalizeKeys(keys: string[]): string[] {
  const uniqueKeys = Array.from(new Set(keys));
  uniqueKeys.sort();
  return uniqueKeys;
}

function readBaselineKeys(absoluteBaselinePath: string): string[] {
  if (!existsSync(absoluteBaselinePath)) {
    throw new Error(
      `Baseline file not found: ${absoluteBaselinePath}\nRun "bun scripts/check_import_boundaries.ts --write-baseline" to create it.`,
    );
  }

  const content = readFileSync(absoluteBaselinePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Baseline file is not valid JSON: ${absoluteBaselinePath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Baseline file must contain an object: ${absoluteBaselinePath}`);
  }

  const violations = (parsed as Record<string, unknown>).violations;
  if (!Array.isArray(violations) || !violations.every((entry) => typeof entry === 'string')) {
    throw new Error(`Baseline file "violations" must be a string array: ${absoluteBaselinePath}`);
  }

  return normalizeKeys(violations);
}

function writeBaseline(absoluteBaselinePath: string, violations: BoundaryViolation[]): void {
  const keys = normalizeKeys(violations.map((violation) => violation.key));
  const baselineDocument: BaselineDocument = {
    version: BASELINE_VERSION,
    policy: {
      electronMustNotImportSrc: true,
      srcMustNotImportElectron: true,
      allowedCrossBoundaryTargets: ALLOWED_CROSS_BOUNDARY_TARGETS,
    },
    violations: keys,
  };

  mkdirSync(dirname(absoluteBaselinePath), { recursive: true });
  writeFileSync(`${absoluteBaselinePath}`, `${JSON.stringify(baselineDocument, null, 2)}\n`, 'utf8');
}

function formatViolation(violation: BoundaryViolation): string {
  const direction = violation.boundary === 'electron_to_src' ? 'electron -> src' : 'src -> electron';
  return `${direction} | ${violation.importerPath}:${violation.line} | "${violation.specifier}" -> ${violation.importedPath}`;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const absoluteBaselinePath = resolve(rootDir, args.baselinePath);

  const scannedFiles = listBoundarySourceFiles(rootDir);
  const violations = scanImportBoundaryViolations(rootDir);
  const currentKeys = violations.map((violation) => violation.key);

  if (args.writeBaseline) {
    writeBaseline(absoluteBaselinePath, violations);
    console.log(`ok: baseline written to ${args.baselinePath}`);
    console.log(`info: scanned ${scannedFiles.length} files, recorded ${violations.length} violation key(s)`);
    return;
  }

  const baselineKeys = readBaselineKeys(absoluteBaselinePath);
  const diff = diffViolationKeys(currentKeys, baselineKeys);
  const newKeySet = new Set(diff.newKeys);
  const newViolations = violations.filter((violation) => newKeySet.has(violation.key));

  console.log(`info: scanned ${scannedFiles.length} files`);
  console.log(`info: current violations ${violations.length}, baseline keys ${baselineKeys.length}`);

  if (newViolations.length > 0) {
    console.error(`error: found ${newViolations.length} new import-boundary violation(s):`);
    for (const violation of newViolations) {
      console.error(` - ${formatViolation(violation)}`);
    }
    console.error(`hint: if intentional, refresh baseline with --write-baseline and commit the baseline update`);
    process.exitCode = 1;
    return;
  }

  console.log('ok: no new import-boundary violations');
  if (diff.staleKeys.length > 0) {
    console.log(`info: ${diff.staleKeys.length} stale baseline key(s) can be removed with --write-baseline`);
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`error: ${message}`);
  process.exitCode = 1;
}
