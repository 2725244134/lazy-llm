import type { Page } from '@playwright/test';
import type {
  HealthResponse,
  LayoutSnapshot,
  PaneUpdateRequest,
  PaneUpdateResponse,
  QuickPromptResizeRequest,
  QuickPromptResizeResponse,
} from '../../../electron/ipc/contracts';

type CouncilApi = {
  healthCheck: () => Promise<HealthResponse>;
  getLayoutSnapshot: () => Promise<LayoutSnapshot>;
  resizeQuickPrompt: (request: QuickPromptResizeRequest) => Promise<QuickPromptResizeResponse>;
  updateProvider: (request: PaneUpdateRequest) => Promise<PaneUpdateResponse>;
};

type BrowserWindowWithCouncil = Window & {
  council: CouncilApi;
};

export type LayoutMetrics = {
  innerWidth: number;
  innerHeight: number;
  snapshot: LayoutSnapshot;
};

export type QuickPromptState = {
  visible: boolean;
  height: number;
};

export async function getHealthCheck(page: Page): Promise<HealthResponse> {
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithCouncil).council.healthCheck();
  });
}

export async function getLayoutSnapshot(page: Page): Promise<LayoutSnapshot> {
  return page.evaluate(() => {
    return (window as unknown as BrowserWindowWithCouncil).council.getLayoutSnapshot();
  });
}

export async function getLayoutMetrics(page: Page): Promise<LayoutMetrics> {
  return page.evaluate(async () => {
    const browserWindow = window as unknown as BrowserWindowWithCouncil;
    const snapshot = await browserWindow.council.getLayoutSnapshot();
    return {
      innerWidth: browserWindow.innerWidth,
      innerHeight: browserWindow.innerHeight,
      snapshot,
    };
  });
}

export async function getQuickPromptState(page: Page): Promise<QuickPromptState> {
  const snapshot = await getLayoutSnapshot(page);
  return {
    visible: snapshot.quickPromptVisible,
    height: snapshot.quickPromptBounds?.height ?? 0,
  };
}

export async function resizeQuickPrompt(
  page: Page,
  request: QuickPromptResizeRequest,
): Promise<QuickPromptResizeResponse> {
  return page.evaluate((payload: QuickPromptResizeRequest) => {
    return (window as unknown as BrowserWindowWithCouncil).council.resizeQuickPrompt(payload);
  }, request);
}

export async function updateProvider(
  page: Page,
  request: PaneUpdateRequest,
): Promise<PaneUpdateResponse> {
  return page.evaluate((payload: PaneUpdateRequest) => {
    return (window as unknown as BrowserWindowWithCouncil).council.updateProvider(payload);
  }, request);
}
