import { expect, type Page } from '@playwright/test';
import type {
  HealthResponse,
  PaneResetAllResponse,
  PaneUpdateRequest,
  PaneUpdateResponse,
  QuickPromptHideResponse,
  QuickPromptResizeRequest,
  QuickPromptResizeResponse,
  QuickPromptToggleResponse,
} from '../../../electron/ipc/contracts';

type CouncilApi = {
  healthCheck: () => Promise<HealthResponse>;
  resetAllPanes: () => Promise<PaneResetAllResponse>;
  toggleQuickPrompt: () => Promise<QuickPromptToggleResponse>;
  hideQuickPrompt: () => Promise<QuickPromptHideResponse>;
  resizeQuickPrompt: (request: QuickPromptResizeRequest) => Promise<QuickPromptResizeResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
};

type BrowserWindowWithCouncil = Window & {
  council: CouncilApi;
};

async function ensureCouncilReady(page: Page): Promise<void> {
  await expect.poll(
    async () => {
      return page.evaluate(() => {
        const bridge = globalThis as unknown as {
          council?: { healthCheck?: unknown };
        };
        return typeof bridge.council?.healthCheck === 'function';
      });
    },
    { timeout: 15000 },
  ).toBe(true);
}

export async function getHealthCheck(page: Page): Promise<HealthResponse> {
  await ensureCouncilReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithCouncil).council.healthCheck();
  });
}

export async function resetAllPanes(page: Page): Promise<PaneResetAllResponse> {
  await ensureCouncilReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithCouncil).council.resetAllPanes();
  });
}

export async function resizeQuickPrompt(
  page: Page,
  request: QuickPromptResizeRequest,
): Promise<QuickPromptResizeResponse> {
  await ensureCouncilReady(page);
  return page.evaluate((payload: QuickPromptResizeRequest) => {
    return (window as unknown as BrowserWindowWithCouncil).council.resizeQuickPrompt(payload);
  }, request);
}

export async function toggleQuickPrompt(page: Page): Promise<QuickPromptToggleResponse> {
  await ensureCouncilReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithCouncil).council.toggleQuickPrompt();
  });
}

export async function hideQuickPrompt(page: Page): Promise<QuickPromptHideResponse> {
  await ensureCouncilReady(page);
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithCouncil).council.hideQuickPrompt();
  });
}

export async function updateProvider(
  page: Page,
  request: PaneUpdateRequest,
): Promise<PaneUpdateResponse> {
  await ensureCouncilReady(page);
  return page.evaluate((payload: PaneUpdateRequest) => {
    return (window as unknown as BrowserWindowWithCouncil).council.updateProvider(payload);
  }, request);
}
