#!/usr/bin/env bun
/**
 * mockParityCli.ts
 *
 * Verifies DOM parity and selector probe contracts between
 * mock pages and the parity manifest.
 *
 * Uses Playwright to load mock HTML and run selector checks in
 * a real browser context (no extra dependencies needed).
 *
 * Usage:
 *   bun scripts/lib/mockParityCli.ts --manifest tests/fixtures/mock-site/parity-manifest.json \
 *       --mock-dir tests/fixtures/mock-site
 *
 * Output: JSON CliOutput<ParityResult[]> to stdout.
 */

import { chromium } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import type { CliOutput, ParityManifestEntry, ParityResult, ParityFailure } from './mockTypes';

function parseArgs(): { manifest: string; mockDir: string } {
  const args = process.argv.slice(2);
  let manifest = '';
  let mockDir = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--manifest' && args[i + 1]) {
      manifest = args[++i];
    } else if (args[i] === '--mock-dir' && args[i + 1]) {
      mockDir = args[++i];
    }
  }

  return { manifest, mockDir };
}

function output<T>(result: CliOutput<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

async function verifyProvider(
  entry: ParityManifestEntry,
  mockDir: string,
  page: import('@playwright/test').Page,
): Promise<ParityResult> {
  const htmlFile = join(mockDir, `${entry.provider}-simulation.html`);
  const failures: ParityFailure[] = [];

  if (!existsSync(htmlFile)) {
    return {
      provider: entry.provider,
      passed: false,
      domParityPassed: false,
      selectorProbePassed: false,
      failures: [{
        type: 'dom-parity',
        message: `Mock HTML file not found: ${htmlFile}`,
      }],
    };
  }

  await page.goto(`file://${htmlFile}`, { waitUntil: 'load' });

  // DOM parity: check structural selectors
  const structuralFailures: ParityFailure[] = [];
  for (const selector of entry.structuralSelectors) {
    const found = await page.evaluate(
      (sel) => document.querySelector(sel) !== null,
      selector,
    );
    if (!found) {
      structuralFailures.push({
        type: 'dom-parity',
        selector,
        message: `Structural selector not found in mock: ${selector}`,
      });
    }
  }
  failures.push(...structuralFailures);
  const domParityPassed = structuralFailures.length === 0;

  // Selector probes
  let requiredProbesFailed = 0;
  for (const probe of entry.selectorProbes) {
    const found = await page.evaluate(
      (sel) => document.querySelector(sel) !== null,
      probe.selector,
    );
    if (!found) {
      failures.push({
        type: 'selector-probe',
        category: probe.category,
        selector: probe.selector,
        message: `Selector probe failed: ${probe.selector} (category: ${probe.category})`,
      });
      if (probe.required) {
        requiredProbesFailed++;
      }
    }
  }
  const selectorProbePassed = requiredProbesFailed === 0;

  return {
    provider: entry.provider,
    passed: domParityPassed && selectorProbePassed,
    domParityPassed,
    selectorProbePassed,
    failures,
  };
}

async function main(): Promise<void> {
  const { manifest, mockDir } = parseArgs();

  if (!manifest) {
    return output({ success: false, error: 'Missing --manifest argument' });
  }
  if (!mockDir) {
    return output({ success: false, error: 'Missing --mock-dir argument' });
  }

  const manifestPath = resolve(manifest);
  if (!existsSync(manifestPath)) {
    return output({ success: false, error: `Manifest file not found: ${manifestPath}` });
  }

  const mockDirPath = resolve(mockDir);
  if (!existsSync(mockDirPath)) {
    return output({ success: false, error: `Mock directory not found: ${mockDirPath}` });
  }

  let entries: ParityManifestEntry[];
  try {
    entries = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    return output({
      success: false,
      error: `Failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  if (!Array.isArray(entries)) {
    return output({ success: false, error: 'Manifest must be a JSON array of ParityManifestEntry' });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const results: ParityResult[] = [];
    for (const entry of entries) {
      results.push(await verifyProvider(entry, mockDirPath, page));
    }

    const allPassed = results.every((r) => r.passed);

    output({
      success: allPassed,
      data: results,
      error: allPassed ? undefined : `${results.filter(r => !r.passed).length} provider(s) failed parity check`,
    });
  } finally {
    await browser.close();
  }
}

main();
