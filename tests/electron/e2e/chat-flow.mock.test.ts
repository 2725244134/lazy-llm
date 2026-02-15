import type { ElectronApplication, Page } from '@playwright/test';
import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';
import { getConfig, setPaneCount, updateProvider } from '../helpers/lazyllm';

type BridgeCompletionResult = {
  isComplete: boolean;
  response: string | null;
  provider: string;
};

const POLL_TIMEOUT = 15000;
const POLL_INTERVAL = 250;

async function findMockPage(
  electronApp: ElectronApplication,
  urlFragment: string,
): Promise<Page> {
  let matchedPage: Page | null = null;
  await expect.poll(async () => {
    const pages = electronApp.context().pages();
    for (const page of pages) {
      if (page.isClosed()) {
        continue;
      }

      try {
        if (page.url().includes(urlFragment)) {
          matchedPage = page;
          return true;
        }
      } catch {
        // Page may still be navigating.
      }
    }
    return false;
  }, { timeout: POLL_TIMEOUT, intervals: [POLL_INTERVAL] }).toBe(true);

  if (!matchedPage) {
    throw new Error(`Mock page containing "${urlFragment}" not found within ${POLL_TIMEOUT}ms`);
  }
  return matchedPage;
}

async function waitForBridgeProvider(page: Page, providerKey: string): Promise<void> {
  await page.waitForFunction(
    (expectedProvider: string) => {
      const bridge = (window as unknown as {
        __llmBridge?: { provider?: string };
      }).__llmBridge;
      return bridge?.provider === expectedProvider;
    },
    providerKey,
    { timeout: POLL_TIMEOUT },
  );
}

async function findPromptInjectedPage(
  electronApp: ElectronApplication,
  urlFragment: string,
  expectedPrompt: string,
): Promise<Page> {
  let matchedPage: Page | null = null;
  await expect.poll(async () => {
    const pages = electronApp.context().pages();
    for (const page of pages) {
      if (page.isClosed()) {
        continue;
      }

      try {
        if (!page.url().includes(urlFragment)) {
          continue;
        }

        const hasPrompt = await page.evaluate((expected: string) => {
          return (window as unknown as { __mockLastInput?: string }).__mockLastInput === expected;
        }, expectedPrompt);
        if (hasPrompt) {
          matchedPage = page;
          return true;
        }
      } catch {
        // Page may still be navigating or detached.
      }
    }
    return false;
  }, { timeout: POLL_TIMEOUT, intervals: [POLL_INTERVAL] }).toBe(true);

  if (!matchedPage) {
    throw new Error(
      `Unable to find injected mock page for "${urlFragment}" with prompt "${expectedPrompt}" within ${POLL_TIMEOUT}ms`,
    );
  }
  return matchedPage;
}

async function waitForCompletion(page: Page): Promise<BridgeCompletionResult> {
  const result = await page.evaluate(() => {
    const bridge = (window as unknown as {
      __llmBridge?: {
        waitForComplete: (timeoutMs: number, pollIntervalMs: number) => Promise<BridgeCompletionResult>;
      };
    }).__llmBridge;
    return bridge?.waitForComplete(15000, 300) ?? null;
  });

  expect(result).toBeTruthy();
  expect(result?.isComplete).toBe(true);
  expect(result?.response).toContain('streamed response');
  return result as BridgeCompletionResult;
}

async function sendPrompt(appWindow: Page, prompt: string): Promise<void> {
  const textarea = appWindow.locator(selectors.promptTextarea);
  const sendButton = appWindow.locator(selectors.promptSendButton);
  await textarea.fill(prompt);
  await expect(sendButton).toBeEnabled({ timeout: POLL_TIMEOUT });
  await sendButton.click();
}

async function prepareSinglePane(appWindow: Page, providerKey: string): Promise<void> {
  const paneCountResult = await setPaneCount(appWindow, { count: 1 });
  expect(paneCountResult.success).toBe(true);

  const switchResult = await updateProvider(appWindow, { paneIndex: 0, providerKey });
  expect(switchResult.success).toBe(true);
  expect(switchResult.paneIndex).toBe(0);

  const config = await getConfig(appWindow);
  expect(config.provider.pane_count).toBe(1);
  expect(config.provider.panes[0]).toBe(providerKey);
}

async function prepareThreePaneBroadcast(appWindow: Page): Promise<void> {
  const paneCountResult = await setPaneCount(appWindow, { count: 3 });
  expect(paneCountResult.success).toBe(true);

  await expect(async () => {
    const config = await getConfig(appWindow);
    expect(config.provider.pane_count).toBe(3);
  }).toPass({ timeout: POLL_TIMEOUT, intervals: [250] });

  const expectedProviders = ['chatgpt', 'grok', 'gemini'] as const;
  for (const [paneIndex, providerKey] of expectedProviders.entries()) {
    const result = await updateProvider(appWindow, { paneIndex, providerKey });
    expect(result.success).toBe(true);
  }

  const config = await getConfig(appWindow);
  expect(config.provider.panes.slice(0, 3)).toEqual(expectedProviders);
}

async function verifySingleProviderFlow(
  electronApp: ElectronApplication,
  appWindow: Page,
  providerKey: 'chatgpt' | 'grok' | 'gemini',
  urlFragment: string,
  displayName: string,
): Promise<void> {
  await prepareSinglePane(appWindow, providerKey);

  await findMockPage(electronApp, urlFragment);

  const prompt = `Hello ${displayName} [single-pane]`;
  await sendPrompt(appWindow, prompt);

  const mockPage = await findPromptInjectedPage(electronApp, urlFragment, prompt);
  await waitForBridgeProvider(mockPage, providerKey);
  const result = await waitForCompletion(mockPage);
  expect(result.provider).toBe(providerKey);
}

test.describe('E2E / Chat Flow (Mock)', () => {
  test('chatgpt: single-pane flow uses real inject selectors', async ({ electronApp, appWindow }) => {
    await verifySingleProviderFlow(electronApp, appWindow, 'chatgpt', 'chatgpt-simulation.html', 'ChatGPT');
  });

  test('grok: single-pane flow uses real inject selectors', async ({ electronApp, appWindow }) => {
    await verifySingleProviderFlow(electronApp, appWindow, 'grok', 'grok-simulation.html', 'Grok');
  });

  test('gemini: single-pane flow uses real inject selectors', async ({ electronApp, appWindow }) => {
    await verifySingleProviderFlow(electronApp, appWindow, 'gemini', 'gemini-simulation.html', 'Gemini');
  });

  test('broadcast prompt reaches all pane providers', async ({ electronApp, appWindow }) => {
    await prepareThreePaneBroadcast(appWindow);

    const prompt = 'Hello all providers [broadcast]';
    await sendPrompt(appWindow, prompt);

    const pages = {
      chatgpt: await findPromptInjectedPage(electronApp, 'chatgpt-simulation.html', prompt),
      grok: await findPromptInjectedPage(electronApp, 'grok-simulation.html', prompt),
      gemini: await findPromptInjectedPage(electronApp, 'gemini-simulation.html', prompt),
    };

    await Promise.all([
      waitForBridgeProvider(pages.chatgpt, 'chatgpt'),
      waitForBridgeProvider(pages.grok, 'grok'),
      waitForBridgeProvider(pages.gemini, 'gemini'),
    ]);

    const results = await Promise.all([
      waitForCompletion(pages.chatgpt),
      waitForCompletion(pages.grok),
      waitForCompletion(pages.gemini),
    ]);
    expect(results.map((result) => result.provider).sort()).toEqual(['chatgpt', 'gemini', 'grok']);
  });
});
