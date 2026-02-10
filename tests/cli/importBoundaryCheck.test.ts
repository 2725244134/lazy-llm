import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  diffViolationKeys,
  extractImportSpecifiers,
  scanImportBoundaryViolations,
  type BoundaryViolation,
} from '../../scripts/lib/importBoundaryCheck';

function createTempProject(files: Record<string, string>): string {
  const rootDir = mkdtempSync(join(tmpdir(), 'lazy-llm-import-boundary-'));

  for (const [relativePath, source] of Object.entries(files)) {
    const absolutePath = join(rootDir, relativePath);
    const absoluteDir = dirname(absolutePath);
    mkdirSync(absoluteDir, { recursive: true });
    writeFileSync(absolutePath, source, 'utf8');
  }

  return rootDir;
}

function cleanupTempProject(rootDir: string): void {
  rmSync(rootDir, { recursive: true, force: true });
}

function summarizeViolations(violations: BoundaryViolation[]): Array<{
  boundary: BoundaryViolation['boundary'];
  importerPath: string;
  importedPath: string;
}> {
  return violations.map((violation) => ({
    boundary: violation.boundary,
    importerPath: violation.importerPath,
    importedPath: violation.importedPath,
  }));
}

describe('importBoundaryCheck', () => {
  it('extracts static, export-from, dynamic, and require imports', () => {
    const source = `
      import thing from './a';
      export { value } from "../b";
      const lazy = import('@/config/app');
      const helper = require('../../electron/views/manager');
    `;

    const imports = extractImportSpecifiers(source);

    expect(imports.map((item) => item.specifier)).toEqual([
      './a',
      '../b',
      '@/config/app',
      '../../electron/views/manager',
    ]);
  });

  it('flags cross-boundary imports while allowing electron IPC contracts', () => {
    const rootDir = createTempProject({
      'electron/main.ts': "import { APP_CONFIG } from '../src/config/app';\n",
      'src/runtime/sidebar.ts': "import { createView } from '../../electron/views/manager';\n",
      'src/runtime/types.ts': "import type { ViewRect } from '../../electron/ipc/contracts';\n",
      'src/config/app.ts': 'export const APP_CONFIG = { panes: 4 };\n',
      'electron/views/manager.ts': 'export const createView = () => null;\n',
      'electron/ipc/contracts.ts': 'export type ViewRect = { x: number };\n',
    });

    try {
      const violations = scanImportBoundaryViolations(rootDir);

      expect(summarizeViolations(violations)).toEqual([
        {
          boundary: 'electron_to_src',
          importerPath: 'electron/main.ts',
          importedPath: 'src/config/app',
        },
        {
          boundary: 'src_to_electron',
          importerPath: 'src/runtime/sidebar.ts',
          importedPath: 'electron/views/manager',
        },
      ]);
    } finally {
      cleanupTempProject(rootDir);
    }
  });

  it('computes new and stale baseline keys deterministically', () => {
    const diff = diffViolationKeys(
      ['electron_to_src|electron/main.ts|src/config/app', 'src_to_electron|src/runtime/sidebar.ts|electron/views/manager'],
      ['electron_to_src|electron/main.ts|src/config/app', 'src_to_electron|src/runtime/old.ts|electron/views/legacy'],
    );

    expect(diff.newKeys).toEqual(['src_to_electron|src/runtime/sidebar.ts|electron/views/manager']);
    expect(diff.staleKeys).toEqual(['src_to_electron|src/runtime/old.ts|electron/views/legacy']);
  });
});
