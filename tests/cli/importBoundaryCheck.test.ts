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
      const helper = require('../../src/main-services/views/manager');
    `;

    const imports = extractImportSpecifiers(source);

    expect(imports.map((item) => item.specifier)).toEqual([
      './a',
      '../b',
      '@/config/app',
      '../../src/main-services/views/manager',
    ]);
  });

  it('flags cross-boundary imports between main-services and renderer code', () => {
    const rootDir = createTempProject({
      'src/main.ts': "import { buildAppState } from './main-services/state';\n",
      'src/main-services/state.ts': 'export const buildAppState = () => ({ ready: true });\n',
      'src/main-services/main.ts': "import { APP_CONFIG } from '../config/app';\n",
      'src/runtime/sidebar.ts': "import { createView } from '../main-services/views/manager';\n",
      'src/runtime/types.ts': "import type { ViewRect } from '../../packages/shared-contracts/ipc/contracts';\n",
      'src/config/app.ts': 'export const APP_CONFIG = { panes: 4 };\n',
      'src/main-services/views/manager.ts': 'export const createView = () => null;\n',
      'packages/shared-contracts/ipc/contracts.ts': 'export type ViewRect = { x: number };\n',
    });

    try {
      const violations = scanImportBoundaryViolations(rootDir);

      expect(summarizeViolations(violations)).toEqual([
        {
          boundary: 'main_services_to_renderer',
          importerPath: 'src/main-services/main.ts',
          importedPath: 'src/config/app',
        },
        {
          boundary: 'renderer_to_main_services',
          importerPath: 'src/runtime/sidebar.ts',
          importedPath: 'src/main-services/views/manager',
        },
      ]);
    } finally {
      cleanupTempProject(rootDir);
    }
  });

  it('computes new and stale baseline keys deterministically', () => {
    const diff = diffViolationKeys(
      ['main_services_to_renderer|src/main-services/main.ts|src/config/app', 'renderer_to_main_services|src/runtime/sidebar.ts|src/main-services/views/manager'],
      ['main_services_to_renderer|src/main-services/main.ts|src/config/app', 'renderer_to_main_services|src/runtime/old.ts|src/main-services/views/legacy'],
    );

    expect(diff.newKeys).toEqual(['renderer_to_main_services|src/runtime/sidebar.ts|src/main-services/views/manager']);
    expect(diff.staleKeys).toEqual(['renderer_to_main_services|src/runtime/old.ts|src/main-services/views/legacy']);
  });
});
