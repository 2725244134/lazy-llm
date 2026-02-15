#!/usr/bin/env bun
/**
 * mockGenerateAll.ts
 *
 * Regenerates all mock HTML pages by invoking mockGenerateCli.ts
 * for every provider in MOCK_PROFILES.
 *
 * Usage:
 *   bun scripts/lib/mockGenerateAll.ts [--output-dir tests/fixtures/mock-site]
 */

import { spawnSync } from 'child_process';
import { SUPPORTED_PROVIDER_KEYS } from './mockProfiles';
import type { CliOutput } from './mockTypes';

function parseArgs(): { outputDir: string } {
  const args = process.argv.slice(2);
  let outputDir = 'tests/fixtures/mock-site';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      outputDir = args[++i];
    }
  }

  return { outputDir };
}

function main(): void {
  const { outputDir } = parseArgs();
  const results: { provider: string; success: boolean; error?: string }[] = [];

  for (const provider of SUPPORTED_PROVIDER_KEYS) {
    const child = spawnSync(
      'bun',
      ['scripts/lib/mockGenerateCli.ts', '--provider', provider, '--output-dir', outputDir],
      { encoding: 'utf8' },
    );

    if (child.error) {
      results.push({
        provider,
        success: false,
        error: child.error.message,
      });
      continue;
    }

    const stdout = (child.stdout ?? '').trim();
    if (child.status === 0) {
      try {
        const parsed: CliOutput = JSON.parse(stdout);
        results.push({ provider, success: parsed.success, error: parsed.error });
      } catch (err) {
        results.push({
          provider,
          success: false,
          error: `Invalid JSON from mockGenerateCli: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      continue;
    }

    try {
      const parsed: CliOutput = JSON.parse(stdout);
      results.push({
        provider,
        success: false,
        error: parsed.error ?? `mockGenerateCli exited with code ${child.status}`,
      });
    } catch (err) {
      results.push({
        provider,
        success: false,
        error:
          (child.stderr ?? '').trim() ||
          `mockGenerateCli exited with code ${child.status}: ${
            err instanceof Error ? err.message : String(err)
          }`,
      });
    }
  }

  const allPassed = results.every((r) => r.success);
  const output: CliOutput<typeof results> = {
    success: allPassed,
    data: results,
    error: allPassed ? undefined : `${results.filter((r) => !r.success).length} provider(s) failed generation`,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  process.exit(allPassed ? 0 : 1);
}

main();
