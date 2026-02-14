#!/usr/bin/env bun
/**
 * mockCaptureCli.ts
 *
 * Captures a DOM snapshot from a real LLM provider site.
 *
 * Usage:
 *   bun scripts/lib/mockCaptureCli.ts --provider chatgpt [--storage-state path]
 *
 * Output: JSON CliOutput<CaptureSnapshot> to stdout.
 */

import { chromium } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { MOCK_PROFILES } from './mockProfiles';
import type { CaptureSnapshot, CliOutput, NormalizedDomNode } from './mockTypes';

function parseArgs(): { provider: string; storageState?: string } {
  const args = process.argv.slice(2);
  let provider = '';
  let storageState: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      provider = args[++i];
    } else if (args[i] === '--storage-state' && args[i + 1]) {
      storageState = args[++i];
    }
  }

  return { provider, storageState };
}

function output<T>(result: CliOutput<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

async function normalizeDom(page: import('@playwright/test').Page): Promise<NormalizedDomNode> {
  return page.evaluate(() => {
    function walk(el: Element): {
      tag: string;
      attrs: Record<string, string>;
      children: ReturnType<typeof walk>[];
      textContent?: string;
    } {
      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) {
        // Skip volatile attributes
        if (['style', 'data-reactid', 'data-reactroot'].includes(attr.name)) continue;
        if (attr.name.startsWith('data-') && attr.name !== 'data-testid' && attr.name !== 'data-message-author-role') continue;
        attrs[attr.name] = attr.value;
      }

      const children: ReturnType<typeof walk>[] = [];
      for (const child of el.children) {
        if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'SVG'].includes(child.tagName)) continue;
        children.push(walk(child));
      }

      const node: ReturnType<typeof walk> = {
        tag: el.tagName.toLowerCase(),
        attrs,
        children,
      };

      // Only include textContent for leaf nodes
      if (children.length === 0 && el.textContent?.trim()) {
        node.textContent = el.textContent.trim().slice(0, 200);
      }

      return node;
    }

    return walk(document.body);
  });
}

async function main(): Promise<void> {
  const { provider, storageState } = parseArgs();

  if (!provider) {
    output({ success: false, error: 'Missing --provider argument' });
  }

  const profile = MOCK_PROFILES[provider];
  if (!profile) {
    output({
      success: false,
      error: `Unknown provider: ${provider}. Supported: ${Object.keys(MOCK_PROFILES).join(', ')}`,
    });
  }

  const useHeaded = !storageState;
  const contextOptions: Record<string, unknown> = {};

  if (storageState) {
    const stateFile = resolve(storageState);
    if (!existsSync(stateFile)) {
      output({ success: false, error: `Storage state file not found: ${stateFile}` });
    }
    contextOptions.storageState = stateFile;
  }

  const browser = await chromium.launch({ headless: !useHeaded });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto(profile.realUrl, { waitUntil: 'networkidle', timeout: 60000 });

    if (useHeaded) {
      // Manual login mode: wait for user to press Enter
      process.stderr.write(
        `\n[mock-capture] Browser opened at ${profile.realUrl}\n` +
        `[mock-capture] Log in and navigate to the chat interface.\n` +
        `[mock-capture] Press ENTER in this console when ready to capture.\n\n`
      );
      await new Promise<void>((r) => process.stdin.once('data', () => r()));
    }

    // Wait a moment for DOM to stabilize
    await page.waitForTimeout(2000);

    const rawHtml = await page.content();
    const normalizedDom = await normalizeDom(page);

    const snapshot: CaptureSnapshot = {
      provider: profile.key,
      capturedAt: new Date().toISOString(),
      url: page.url(),
      rawHtml,
      normalizedDom,
    };

    output({ success: true, data: snapshot });
  } catch (err) {
    output({
      success: false,
      error: `Capture failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    await browser.close();
  }
}

main();
