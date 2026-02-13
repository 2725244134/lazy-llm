import { readdirSync, readFileSync, type Dirent } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

export type BoundaryDirection = 'main_services_to_renderer' | 'renderer_to_main_services';

export interface ImportSpecifierMatch {
  specifier: string;
  line: number;
  index: number;
}

export interface BoundaryViolation {
  key: string;
  boundary: BoundaryDirection;
  importerPath: string;
  importedPath: string;
  specifier: string;
  line: number;
}

export interface BaselineDiff {
  newKeys: string[];
  staleKeys: string[];
}

const SOURCE_ROOTS = ['src'] as const;
const SOURCE_FILE_SUFFIXES = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.vue'] as const;
const TEST_FILE_PATTERN = /\.(test|spec)\.[^/]+$/;
const DECLARATION_FILE_SUFFIX = '.d.ts';
const SUPPORTED_IMPORT_SUFFIXES = ['.d.ts', '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.vue', '.mjs', '.cjs'] as const;

const IMPORT_PATTERNS = [
  /\bimport\s+(?:type\s+)?(?:[\s\S]*?\sfrom\s*)?["']([^"']+)["']/g,
  /\bexport\s+(?:type\s+)?[\s\S]*?\sfrom\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

export const ALLOWED_CROSS_BOUNDARY_TARGETS = [] as const;
const MAIN_SIDE_ROOT_FILES = new Set([
  'src/main',
  'src/preload',
  'src/pane-preload',
  'src/quick-prompt-preload',
]);

function normalizePathLike(pathLike: string): string {
  return pathLike.replace(/\\/g, '/').replace(/^\.\//, '');
}

function compareAscii(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isSupportedSourceFile(relativePath: string): boolean {
  if (!relativePath.startsWith('src/')) {
    return false;
  }

  if (relativePath.endsWith(DECLARATION_FILE_SUFFIX)) {
    return false;
  }

  if (TEST_FILE_PATTERN.test(relativePath)) {
    return false;
  }

  return SOURCE_FILE_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));
}

function walkFiles(rootDir: string, relativeDir: string): string[] {
  const absoluteDir = resolve(rootDir, relativeDir);
  let entries: Dirent[];

  try {
    entries = readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  entries.sort((left, right) => compareAscii(left.name, right.name));

  const files: string[] = [];
  for (const entry of entries) {
    const nextRelativePath = normalizePathLike(`${relativeDir}/${entry.name}`);
    if (entry.isDirectory()) {
      files.push(...walkFiles(rootDir, nextRelativePath));
      continue;
    }

    if (entry.isFile() && isSupportedSourceFile(nextRelativePath)) {
      files.push(nextRelativePath);
    }
  }

  return files;
}

function buildLineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      offsets.push(index + 1);
    }
  }
  return offsets;
}

function lineAt(offsets: number[], index: number): number {
  let low = 0;
  let high = offsets.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= index) {
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return high + 1;
}

function sanitizeSpecifier(rawSpecifier: string): string {
  const trimmed = rawSpecifier.trim();
  const hashIndex = trimmed.indexOf('#');
  const queryIndex = trimmed.indexOf('?');
  let cutoff = trimmed.length;

  if (hashIndex >= 0) {
    cutoff = Math.min(cutoff, hashIndex);
  }

  if (queryIndex >= 0) {
    cutoff = Math.min(cutoff, queryIndex);
  }

  return trimmed.slice(0, cutoff);
}

function stripImportSuffix(pathLike: string): string {
  for (const suffix of SUPPORTED_IMPORT_SUFFIXES) {
    if (pathLike.endsWith(suffix)) {
      return pathLike.slice(0, pathLike.length - suffix.length);
    }
  }

  return pathLike;
}

function normalizeImportedPath(pathLike: string): string {
  const normalized = normalizePathLike(pathLike);
  const withoutSuffix = stripImportSuffix(normalized);
  if (withoutSuffix.endsWith('/index')) {
    return withoutSuffix.slice(0, withoutSuffix.length - '/index'.length);
  }
  return withoutSuffix;
}

function resolveImportPath(specifier: string, importerPath: string, rootDir: string): string | null {
  const sanitizedSpecifier = sanitizeSpecifier(specifier);
  if (sanitizedSpecifier.length === 0) {
    return null;
  }

  if (sanitizedSpecifier.startsWith('@/')) {
    return normalizeImportedPath(`src/${sanitizedSpecifier.slice(2)}`);
  }

  if (sanitizedSpecifier.startsWith('src/')) {
    return normalizeImportedPath(sanitizedSpecifier);
  }

  if (sanitizedSpecifier.startsWith('/')) {
    return normalizeImportedPath(sanitizedSpecifier.slice(1));
  }

  if (sanitizedSpecifier.startsWith('./') || sanitizedSpecifier.startsWith('../')) {
    const importerAbsolutePath = resolve(rootDir, importerPath);
    const importedAbsolutePath = resolve(dirname(importerAbsolutePath), sanitizedSpecifier);
    const importedRelativePath = normalizePathLike(relative(rootDir, importedAbsolutePath));
    if (importedRelativePath.startsWith('..') || importedRelativePath === '') {
      return null;
    }

    return normalizeImportedPath(importedRelativePath);
  }

  return null;
}

function classifyBoundary(importerPath: string, importedPath: string): BoundaryDirection | null {
  const normalizedImporterPath = normalizeImportedPath(importerPath);
  const normalizedImportedPath = normalizeImportedPath(importedPath);
  const importerIsMainSide = normalizedImporterPath.startsWith('src/main-services/')
    || MAIN_SIDE_ROOT_FILES.has(normalizedImporterPath);
  const importedIsMainSide = normalizedImportedPath.startsWith('src/main-services/')
    || MAIN_SIDE_ROOT_FILES.has(normalizedImportedPath);
  const importerIsRenderer = normalizedImporterPath.startsWith('src/') && !importerIsMainSide;
  const importedIsRenderer = normalizedImportedPath.startsWith('src/') && !importedIsMainSide;

  if (importerIsMainSide && importedIsRenderer) {
    return 'main_services_to_renderer';
  }

  if (importerIsRenderer && importedIsMainSide) {
    return 'renderer_to_main_services';
  }

  return null;
}

function isAllowedCrossBoundary(importedPath: string): boolean {
  return ALLOWED_CROSS_BOUNDARY_TARGETS.includes(importedPath as (typeof ALLOWED_CROSS_BOUNDARY_TARGETS)[number]);
}

function sortViolations(violations: BoundaryViolation[]): BoundaryViolation[] {
  return [...violations].sort((left, right) => compareAscii(left.key, right.key));
}

export function listBoundarySourceFiles(rootDir: string): string[] {
  const files: string[] = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    files.push(...walkFiles(rootDir, sourceRoot));
  }

  files.sort(compareAscii);
  return files;
}

export function extractImportSpecifiers(source: string): ImportSpecifierMatch[] {
  const offsets = buildLineOffsets(source);
  const matches: ImportSpecifierMatch[] = [];

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);

    while (match !== null) {
      const specifier = match[1];
      if (specifier) {
        matches.push({
          specifier,
          line: lineAt(offsets, match.index),
          index: match.index,
        });
      }
      match = pattern.exec(source);
    }
  }

  matches.sort((left, right) => {
    if (left.index !== right.index) {
      return left.index - right.index;
    }
    return compareAscii(left.specifier, right.specifier);
  });

  const uniqueMatches: ImportSpecifierMatch[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const key = `${match.index}|${match.specifier}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueMatches.push(match);
  }

  return uniqueMatches;
}

export function createViolationKey(violation: Pick<BoundaryViolation, 'boundary' | 'importerPath' | 'importedPath'>): string {
  return `${violation.boundary}|${violation.importerPath}|${violation.importedPath}`;
}

export function scanBoundaryViolationsInSource(
  source: string,
  importerPath: string,
  rootDir: string,
): BoundaryViolation[] {
  const matches = extractImportSpecifiers(source);
  const violations = new Map<string, BoundaryViolation>();

  for (const match of matches) {
    const importedPath = resolveImportPath(match.specifier, importerPath, rootDir);
    if (!importedPath) {
      continue;
    }

    const boundary = classifyBoundary(importerPath, importedPath);
    if (!boundary) {
      continue;
    }

    if (isAllowedCrossBoundary(importedPath)) {
      continue;
    }

    const key = createViolationKey({ boundary, importerPath, importedPath });
    if (violations.has(key)) {
      continue;
    }

    violations.set(key, {
      key,
      boundary,
      importerPath,
      importedPath,
      specifier: match.specifier,
      line: match.line,
    });
  }

  return sortViolations([...violations.values()]);
}

export function scanImportBoundaryViolations(rootDir: string): BoundaryViolation[] {
  const files = listBoundarySourceFiles(rootDir);
  const violations = new Map<string, BoundaryViolation>();

  for (const filePath of files) {
    const source = readFileSync(resolve(rootDir, filePath), 'utf8');
    for (const violation of scanBoundaryViolationsInSource(source, filePath, rootDir)) {
      if (!violations.has(violation.key)) {
        violations.set(violation.key, violation);
      }
    }
  }

  return sortViolations([...violations.values()]);
}

function normalizeKeyList(keys: string[]): string[] {
  const uniqueKeys = Array.from(new Set(keys));
  uniqueKeys.sort(compareAscii);
  return uniqueKeys;
}

export function diffViolationKeys(currentKeys: string[], baselineKeys: string[]): BaselineDiff {
  const current = normalizeKeyList(currentKeys);
  const baseline = normalizeKeyList(baselineKeys);
  const currentSet = new Set(current);
  const baselineSet = new Set(baseline);

  const newKeys = current.filter((key) => !baselineSet.has(key));
  const staleKeys = baseline.filter((key) => !currentSet.has(key));

  return { newKeys, staleKeys };
}
