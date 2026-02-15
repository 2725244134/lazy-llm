import { expect, type Page } from '@playwright/test';
import type {
  AppConfig,
  HealthResponse,
  PaneCountRequest,
  PaneCountResponse,
  PaneResetAllResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  QuickPromptHideResponse,
  QuickPromptResizeRequest,
  QuickPromptResizeResponse,
  QuickPromptToggleResponse,
} from '../../../packages/shared-contracts/ipc/contracts';

type LazyllmApi = {
  healthCheck: () => Promise<HealthResponse>;
  getConfig: () => Promise<AppConfig>;
  setPaneCount: (request: PaneCountRequest) => Promise<PaneCountResponse>;
  resetAllPanes: () => Promise<PaneResetAllResponse>;
  toggleQuickPrompt: () => Promise<QuickPromptToggleResponse>;
  hideQuickPrompt: () => Promise<QuickPromptHideResponse>;
  resizeQuickPrompt: (request: QuickPromptResizeRequest) => Promise<QuickPromptResizeResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
};

type BrowserWindowWithLazyllm = Window & {
  lazyllm: LazyllmApi;
};

async function ensureLazyllmReady(page: Page): Promise<void> {
  await expect.poll(
    async () => {
      return page.evaluate(() => {
        const bridge = globalThis as unknown as {
          lazyllm?: { healthCheck?: unknown };
        };
        return typeof bridge.lazyllm?.healthCheck === 'function';
      });
    },
    { timeout: 15000 },
  ).toBe(true);
}

export async function getHealthCheck(page: Page): Promise<HealthResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.healthCheck();
  });
}

export async function getConfig(page: Page): Promise<AppConfig> {
  await ensureLazyllmReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.getConfig();
  });
}

export async function setPaneCount(
  page: Page,
  request: PaneCountRequest,
): Promise<PaneCountResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate((payload: PaneCountRequest) => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.setPaneCount(payload);
  }, request);
}

export async function resetAllPanes(page: Page): Promise<PaneResetAllResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.resetAllPanes();
  });
}

export async function resizeQuickPrompt(
  page: Page,
  request: QuickPromptResizeRequest,
): Promise<QuickPromptResizeResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate((payload: QuickPromptResizeRequest) => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.resizeQuickPrompt(payload);
  }, request);
}

export async function toggleQuickPrompt(page: Page): Promise<QuickPromptToggleResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.toggleQuickPrompt();
  });
}

export async function hideQuickPrompt(page: Page): Promise<QuickPromptHideResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.hideQuickPrompt();
  });
}

export async function updateProvider(
  page: Page,
  request: PaneUpdateRequest,
): Promise<PaneUpdateResponse> {
  await ensureLazyllmReady(page);
  return page.evaluate((payload: PaneUpdateRequest) => {
    return (window as unknown as BrowserWindowWithLazyllm).lazyllm.updateProvider(payload);
  }, request);
}
