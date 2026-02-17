import { mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import {
  loadInjectRuntimeScript,
  resolveInjectRuntimePath,
} from './injectRuntimeLoader';

function createTempRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

describe('injectRuntimeLoader', () => {
  it('prefers resourcesPath when runtime exists there', () => {
    const root = createTempRoot('lazy-llm-inject-loader-');
    const runtimeDir = join(root, 'runtime');
    const resourcesDir = join(root, 'resources');
    mkdirSync(runtimeDir, { recursive: true });
    mkdirSync(resourcesDir, { recursive: true });
    writeFileSync(join(resourcesDir, 'inject.js'), '// resources runtime', 'utf8');
    writeFileSync(join(runtimeDir, 'inject.js'), '// runtime dir fallback', 'utf8');

    const runtimePath = resolveInjectRuntimePath({
      runtimeDir,
      cwd: root,
      resourcesPath: resourcesDir,
    });

    expect(runtimePath).toBe(join(resourcesDir, 'inject.js'));
  });

  it('prepends parsed mock config to runtime script', () => {
    const root = createTempRoot('lazy-llm-inject-loader-');
    const distDir = join(root, 'dist-electron');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'inject.js'), 'window.__llmBridge = {};', 'utf8');
    const mockConfigPath = join(root, 'mock-provider-config.json');
    writeFileSync(
      mockConfigPath,
      JSON.stringify({ chatgpt: { url: 'file:///tmp/chatgpt.html', urlPattern: 'chatgpt' } }),
      'utf8',
    );

    const script = loadInjectRuntimeScript({
      runtimeDir: join(root, 'runtime'),
      cwd: root,
      mockProvidersFile: './mock-provider-config.json',
    });

    expect(script).toContain('window.__lazyllm_extra_config = {"chatgpt"');
    expect(script).toContain('window.__llmBridge = {};');
  });

  it('returns runtime script when mock config is invalid json', () => {
    const root = createTempRoot('lazy-llm-inject-loader-');
    const distDir = join(root, 'dist-electron');
    mkdirSync(distDir, { recursive: true });
    writeFileSync(join(distDir, 'inject.js'), 'window.__llmBridge = {};', 'utf8');
    writeFileSync(join(root, 'mock-provider-config.json'), '{invalid-json', 'utf8');
    const logger = {
      error: vi.fn(),
    };

    const script = loadInjectRuntimeScript({
      runtimeDir: join(root, 'runtime'),
      cwd: root,
      mockProvidersFile: './mock-provider-config.json',
      logger,
    });

    expect(script).toBe('window.__llmBridge = {};');
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null when runtime script cannot be found', () => {
    const logger = {
      error: vi.fn(),
    };

    const script = loadInjectRuntimeScript({
      runtimeDir: '/tmp/non-existent-runtime',
      cwd: '/tmp/non-existent-cwd',
      logger,
    });

    expect(script).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });
});
