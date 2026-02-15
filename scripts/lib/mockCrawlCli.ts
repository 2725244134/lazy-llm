#!/usr/bin/env bun
/**
 * mockCrawlCli.ts
 *
 * Style-aware DOM crawl: captures DOM structure + computed styles for
 * chat and input regions of a real LLM provider site.
 *
 * Usage:
 *   bun scripts/lib/mockCrawlCli.ts --provider chatgpt [--storage-state auth.json] \
 *     [--chat-selector 'main ...'] [--input-selector 'form ...']
 *
 * Output: JSON CliOutput<CrawlSnapshot> to stdout.
 */

import { chromium } from '@playwright/test';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { MOCK_PROFILES } from './mockProfiles';
import { CRAWL_CSS_PROPERTIES } from './mockTypes';
import type { CliOutput, CrawlSnapshot, StyledDomNode } from './mockTypes';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CrawlArgs {
  provider: string;
  storageState?: string;
  chatSelector?: string;
  inputSelector?: string;
}

function parseArgs(): CrawlArgs {
  const args = process.argv.slice(2);
  const result: CrawlArgs = { provider: '' };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--provider' && args[i + 1]) {
      result.provider = args[++i];
    } else if (args[i] === '--storage-state' && args[i + 1]) {
      result.storageState = args[++i];
    } else if (args[i] === '--chat-selector' && args[i + 1]) {
      result.chatSelector = args[++i];
    } else if (args[i] === '--input-selector' && args[i + 1]) {
      result.inputSelector = args[++i];
    }
  }

  return result;
}

function output<T>(result: CliOutput<T>): never {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.success ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { provider, storageState, chatSelector, inputSelector } = parseArgs();

  if (!provider) {
    return output({ success: false, error: 'Missing --provider argument' });
  }

  const profile = MOCK_PROFILES[provider];
  if (!profile) {
    return output({
      success: false,
      error: `Unknown provider: ${provider}. Supported: ${Object.keys(MOCK_PROFILES).join(', ')}`,
    });
  }

  const chatSel = chatSelector ?? profile.chatRegionSelector;
  const inputSel = inputSelector ?? profile.inputRegionSelector;

  if (!chatSel) {
    return output({ success: false, error: `No chat region selector for ${provider}. Use --chat-selector.` });
  }
  if (!inputSel) {
    return output({ success: false, error: `No input region selector for ${provider}. Use --input-selector.` });
  }

  const useHeaded = !storageState;
  const contextOptions: Record<string, unknown> = {};

  if (storageState) {
    const stateFile = resolve(storageState);
    if (!existsSync(stateFile)) {
      return output({ success: false, error: `Storage state file not found: ${stateFile}` });
    }
    contextOptions.storageState = stateFile;
  }

  const browser = await chromium.launch({ headless: !useHeaded });
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto(profile.realUrl, { waitUntil: 'networkidle', timeout: 60000 });

    if (useHeaded) {
      process.stderr.write(
        `\n[mock-crawl] Browser opened at ${profile.realUrl}\n` +
        `[mock-crawl] Log in and navigate to the chat interface.\n` +
        `[mock-crawl] Press ENTER in this console when ready to crawl.\n\n`,
      );
      await new Promise<void>((r) => process.stdin.once('data', () => r()));
    }

    // Wait for DOM to stabilize
    await page.waitForTimeout(2000);

    // Pass the CSS property list into the browser context
    const cssProps: readonly string[] = CRAWL_CSS_PROPERTIES;

    const result = await page.evaluate(
      ({ chatSel, inputSel, cssProps }) => {
        // --- Kept attributes ---
        const KEEP_ATTRS = new Set([
          'class', 'id', 'role', 'contenteditable', 'type',
          'data-testid', 'data-lexical-editor', 'data-placeholder',
          'data-message-author-role', 'data-turn-role',
          'aria-label', 'aria-expanded', 'aria-hidden',
          'placeholder', 'formcontrolname', 'mattooltip',
        ]);
        function shouldKeepAttr(name: string): boolean {
          if (KEEP_ATTRS.has(name)) return true;
          if (name.startsWith('aria-')) return true;
          if (name === 'data-testid') return true;
          return false;
        }

        // --- Baseline cache: default computed styles per tag ---
        const baselineCache = new Map<string, Map<string, string>>();
        function getBaseline(tag: string): Map<string, string> {
          let cached = baselineCache.get(tag);
          if (cached) return cached;
          const temp = document.createElement(tag);
          // Attach off-screen to get proper defaults
          temp.style.position = 'absolute';
          temp.style.visibility = 'hidden';
          temp.style.pointerEvents = 'none';
          document.body.appendChild(temp);
          const cs = getComputedStyle(temp);
          cached = new Map<string, string>();
          for (const prop of cssProps) {
            cached.set(prop, cs.getPropertyValue(prop));
          }
          document.body.removeChild(temp);
          baselineCache.set(tag, cached);
          return cached;
        }

        // --- Recursive walk ---
        function walkStyled(el: Element): {
          tag: string;
          attrs: Record<string, string>;
          children: ReturnType<typeof walkStyled>[];
          textContent?: string;
          computedStyles: Record<string, string>;
        } {
          const tag = el.tagName.toLowerCase();

          // Collect kept attributes
          const attrs: Record<string, string> = {};
          for (const attr of el.attributes) {
            if (shouldKeepAttr(attr.name)) {
              attrs[attr.name] = attr.value;
            }
          }

          // Recurse children (skip SCRIPT/NOSCRIPT)
          const children: ReturnType<typeof walkStyled>[] = [];
          for (const child of el.children) {
            if (['SCRIPT', 'NOSCRIPT'].includes(child.tagName)) continue;
            children.push(walkStyled(child));
          }

          // Compute style diffs
          const cs = getComputedStyle(el);
          const baseline = getBaseline(tag);
          const computedStyles: Record<string, string> = {};
          for (const prop of cssProps) {
            const val = cs.getPropertyValue(prop);
            if (val && val !== baseline.get(prop)) {
              computedStyles[prop] = val;
            }
          }

          const node: ReturnType<typeof walkStyled> = {
            tag,
            attrs,
            children,
            computedStyles,
          };

          // Leaf text content (truncated)
          if (children.length === 0 && el.textContent?.trim()) {
            node.textContent = el.textContent.trim().slice(0, 500);
          }

          return node;
        }

        // --- Locate regions ---
        const chatEl = document.querySelector(chatSel);
        const inputEl = document.querySelector(inputSel);

        if (!chatEl) {
          return { error: `Chat region not found: ${chatSel}` };
        }
        if (!inputEl) {
          return { error: `Input region not found: ${inputSel}` };
        }

        const chatRegionDom = walkStyled(chatEl);
        const inputRegionDom = walkStyled(inputEl);

        // --- CSS variables from :root ---
        const cssVariables: Record<string, string> = {};
        try {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (
                  rule instanceof CSSStyleRule &&
                  rule.selectorText === ':root'
                ) {
                  for (let i = 0; i < rule.style.length; i++) {
                    const name = rule.style[i];
                    if (name.startsWith('--')) {
                      cssVariables[name] = rule.style.getPropertyValue(name).trim();
                    }
                  }
                }
              }
            } catch {
              // Cross-origin stylesheet — skip
            }
          }
        } catch {
          // styleSheets access may fail
        }

        // --- Font URLs ---
        const fonts: string[] = [];
        try {
          for (const sheet of document.styleSheets) {
            try {
              for (const rule of sheet.cssRules) {
                if (rule instanceof CSSFontFaceRule) {
                  const src = rule.style.getPropertyValue('src');
                  if (src) {
                    const urlMatch = src.match(/url\(["']?([^"')]+)/);
                    if (urlMatch) fonts.push(urlMatch[1]);
                  }
                }
                if (rule instanceof CSSImportRule && rule.href) {
                  fonts.push(rule.href);
                }
              }
            } catch {
              // Cross-origin — skip
            }
          }
        } catch {
          // Ignore
        }

        return { chatRegionDom, inputRegionDom, cssVariables, fonts };
      },
      { chatSel, inputSel, cssProps: cssProps as string[] },
    );

    if ('error' in result && typeof result.error === 'string') {
      return output({ success: false, error: result.error });
    }

    const snapshot: CrawlSnapshot = {
      provider: profile.key,
      capturedAt: new Date().toISOString(),
      url: page.url(),
      chatRegionDom: result.chatRegionDom as StyledDomNode,
      inputRegionDom: result.inputRegionDom as StyledDomNode,
      cssVariables: (result.cssVariables ?? {}) as Record<string, string>,
      fonts: (result.fonts ?? []) as string[],
    };

    output({ success: true, data: snapshot });
  } catch (err) {
    output({
      success: false,
      error: `Crawl failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  } finally {
    await browser.close();
  }
}

main();
