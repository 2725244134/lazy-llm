import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

export interface InjectRuntimeLoaderOptions {
  runtimeDir: string;
  cwd: string;
  resourcesPath?: string;
  mockProvidersFile?: string;
  logger?: Pick<Console, 'error'>;
}

function buildInjectRuntimeCandidates(options: InjectRuntimeLoaderOptions): string[] {
  const { runtimeDir, cwd, resourcesPath } = options;
  const candidates = [
    ...(typeof resourcesPath === 'string' && resourcesPath.length > 0
      ? [join(resourcesPath, 'inject.js')]
      : []),
    join(cwd, 'dist-electron', 'inject.js'),
    join(cwd, '.vite', 'build', 'inject.js'),
    join(runtimeDir, 'inject.js'),
    join(runtimeDir, '..', 'inject.js'),
    join(runtimeDir, '..', '..', 'inject.js'),
    join(runtimeDir, '..', '..', 'dist-electron', 'inject.js'),
  ];

  return Array.from(new Set(candidates));
}

export function resolveInjectRuntimePath(options: InjectRuntimeLoaderOptions): string | null {
  const candidates = buildInjectRuntimeCandidates(options);
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function buildMockProviderPrefix(options: InjectRuntimeLoaderOptions): string {
  const logger = options.logger ?? console;
  const mockProvidersFile = options.mockProvidersFile;
  if (!mockProvidersFile || mockProvidersFile.trim().length === 0) {
    return '';
  }

  const mockConfigPath = resolve(options.cwd, mockProvidersFile);
  if (!existsSync(mockConfigPath)) {
    return '';
  }

  try {
    const mockConfigRaw = readFileSync(mockConfigPath, 'utf8');
    const parsed = JSON.parse(mockConfigRaw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      logger.error(`[ViewManager] Mock providers config must be an object: ${mockConfigPath}`);
      return '';
    }
    return `window.__lazyllm_extra_config = ${JSON.stringify(parsed)};\n`;
  } catch (error) {
    logger.error(`[ViewManager] Failed to parse mock providers config: ${mockConfigPath}`, error);
    return '';
  }
}

export function loadInjectRuntimeScript(options: InjectRuntimeLoaderOptions): string | null {
  const logger = options.logger ?? console;
  const runtimePath = resolveInjectRuntimePath(options);
  if (!runtimePath) {
    logger.error('[ViewManager] Inject runtime not found in configured runtime paths');
    return null;
  }

  try {
    const runtimeScript = readFileSync(runtimePath, 'utf8');
    const mockPrefix = buildMockProviderPrefix(options);
    return `${mockPrefix}${runtimeScript}`;
  } catch (error) {
    logger.error('[ViewManager] Failed to read inject runtime:', error);
    return null;
  }
}
