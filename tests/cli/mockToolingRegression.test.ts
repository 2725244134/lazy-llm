import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { describe, expect, it } from 'vitest';
import type { CliOutput, DriftReport } from '../../scripts/lib/mockTypes';

function runBunScript(scriptPath: string, args: string[]): string {
  return execFileSync('bun', [scriptPath, ...args], { encoding: 'utf8' });
}

describe('mock tooling regressions', () => {
  it('mockDiffCli handles selectors with spaces in attribute values and escaped class colons', () => {
    const root = mkdtempSync(join(tmpdir(), 'mock-diff-regression-'));
    const capturePath = join(root, 'capture.json');
    const manifestPath = join(root, 'manifest.json');

    writeFileSync(
      capturePath,
      JSON.stringify(
        {
          success: true,
          data: {
            provider: 'demo',
            capturedAt: '2026-02-15T00:00:00Z',
            url: 'https://example.com',
            rawHtml: '',
            normalizedDom: {
              tag: 'html',
              attrs: {},
              children: [
                {
                  tag: 'body',
                  attrs: {},
                  children: [
                    {
                      tag: 'button',
                      attrs: { 'aria-label': 'Voice mode' },
                      children: [],
                    },
                    {
                      tag: 'div',
                      attrs: { class: 'prose dark:prose-invert' },
                      children: [],
                    },
                  ],
                },
              ],
            },
          },
        },
        null,
        2,
      ),
    );

    writeFileSync(
      manifestPath,
      JSON.stringify(
        [
          {
            provider: 'demo',
            structuralSelectors: [
              "button[aria-label='Voice mode']",
              '.prose.dark\\:prose-invert',
            ],
            selectorProbes: [],
          },
        ],
        null,
        2,
      ),
    );

    const stdout = runBunScript('scripts/lib/mockDiffCli.ts', [
      '--capture',
      capturePath,
      '--manifest',
      manifestPath,
    ]);
    const result = JSON.parse(stdout) as CliOutput<DriftReport>;

    expect(result.success).toBe(true);
    expect(result.data?.selectorsMissing).toHaveLength(0);
  });

  it('mockGenerateAll preserves --output-dir containing spaces', () => {
    const root = mkdtempSync(join(tmpdir(), 'mock-generate-all-'));
    const outputDir = join(root, 'output with space');

    const stdout = runBunScript('scripts/lib/mockGenerateAll.ts', [
      '--output-dir',
      outputDir,
    ]);
    const result = JSON.parse(stdout) as CliOutput<Array<{ provider: string; success: boolean }>>;

    expect(result.success).toBe(true);
    expect(existsSync(join(outputDir, 'chatgpt-simulation.html'))).toBe(true);
    expect(existsSync(join(root, 'output'))).toBe(false);
  });

  it('mockGenerateCli writes config URL to the actual generated output path', () => {
    const root = mkdtempSync(join(tmpdir(), 'mock-generate-cli-'));
    const outputDir = join(root, 'fixtures out');

    runBunScript('scripts/lib/mockGenerateCli.ts', [
      '--provider',
      'chatgpt',
      '--output-dir',
      outputDir,
    ]);

    const configPath = join(outputDir, 'mock-provider-config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<
      string,
      { url: string; urlPattern: string }
    >;
    const htmlPath = join(outputDir, 'chatgpt-simulation.html');

    expect(config.chatgpt.url).toBe(pathToFileURL(htmlPath).toString());
    expect(config.chatgpt.urlPattern).toBe('chatgpt-simulation.html');
  });

  it('mockTransformCli runs without browser CSS globals and writes output-path URL', () => {
    const root = mkdtempSync(join(tmpdir(), 'mock-transform-cli-'));
    const outputDir = join(root, 'transform out');
    const snapshotPath = join(root, 'crawl.json');

    writeFileSync(
      snapshotPath,
      JSON.stringify(
        {
          provider: 'chatgpt',
          capturedAt: '2026-02-15T00:00:00Z',
          url: 'https://chatgpt.com',
          chatRegionDom: {
            tag: 'div',
            attrs: { class: 'chat-region' },
            children: [],
            computedStyles: { display: 'block' },
          },
          inputRegionDom: {
            tag: 'form',
            attrs: { class: 'input-region' },
            children: [
              {
                tag: 'div',
                attrs: { class: 'ProseMirror', contenteditable: 'true' },
                children: [],
                computedStyles: { display: 'block' },
              },
              {
                tag: 'button',
                attrs: { 'data-testid': 'send-button', 'aria-label': 'Send prompt' },
                children: [],
                textContent: 'Send',
                computedStyles: {},
              },
              {
                tag: 'button',
                attrs: { 'aria-label': 'Stop generating', 'data-testid': 'stop-button' },
                children: [],
                textContent: 'Stop generating',
                computedStyles: {},
              },
            ],
            computedStyles: { display: 'flex' },
          },
          cssVariables: {},
          fonts: [],
        },
        null,
        2,
      ),
    );

    const stdout = runBunScript('scripts/lib/mockTransformCli.ts', [
      '--provider',
      'chatgpt',
      '--snapshot',
      snapshotPath,
      '--output-dir',
      outputDir,
    ]);
    const result = JSON.parse(stdout) as CliOutput<{
      htmlPath: string;
      configPath: string;
      mockKey: string;
    }>;

    const htmlPath = join(outputDir, 'chatgpt-simulation.html');
    const config = JSON.parse(readFileSync(join(outputDir, 'mock-provider-config.json'), 'utf8')) as Record<
      string,
      { url: string; urlPattern: string }
    >;

    expect(result.success).toBe(true);
    expect(existsSync(htmlPath)).toBe(true);
    expect(config.chatgpt.url).toBe(pathToFileURL(htmlPath).toString());
  });
});
