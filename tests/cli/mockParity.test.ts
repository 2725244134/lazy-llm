import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { CliOutput, MockProviderConfigFile, ParityResult } from '../../scripts/lib/mockTypes';

const MANIFEST_PATH = 'tests/fixtures/mock-site/parity-manifest.json';
const MOCK_DIR = 'tests/fixtures/mock-site';
const CONFIG_PATH = 'tests/fixtures/mock-site/mock-provider-config.json';

describe('mockParity', () => {
  it('all providers pass parity checks', () => {
    const stdout = execSync(
      `bun scripts/lib/mockParityCli.ts --manifest ${MANIFEST_PATH} --mock-dir ${MOCK_DIR}`,
      { encoding: 'utf8', timeout: 30000 },
    );

    const result: CliOutput<ParityResult[]> = JSON.parse(stdout);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    for (const entry of result.data!) {
      expect(entry.passed, `${entry.provider} parity failed`).toBe(true);
      expect(entry.domParityPassed, `${entry.provider} DOM parity failed`).toBe(true);
      expect(entry.selectorProbePassed, `${entry.provider} selector probes failed`).toBe(true);
    }
  });

  it('parity manifest covers all providers in mock-provider-config.json', () => {
    const config: MockProviderConfigFile = JSON.parse(
      readFileSync(resolve(CONFIG_PATH), 'utf8'),
    );
    const manifest = JSON.parse(
      readFileSync(resolve(MANIFEST_PATH), 'utf8'),
    ) as { provider: string }[];

    const configKeys = Object.keys(config).sort();
    const manifestKeys = manifest.map((e) => e.provider).sort();

    expect(manifestKeys).toEqual(configKeys);
  });
});
