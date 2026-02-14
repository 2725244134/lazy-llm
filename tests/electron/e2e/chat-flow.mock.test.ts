import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';
import { updateProvider } from '../helpers/lazyllm';

/** Timeout for polling operations inside tests. */
const POLL_TIMEOUT = 15000;
const POLL_INTERVAL = 500;

/**
 * Finds a pane page whose URL contains the given substring.
 * Polls electronApp.context().pages() until found or timeout.
 */
async function findMockPage(
  electronApp: import('@playwright/test').ElectronApplication,
  urlFragment: string,
): Promise<import('@playwright/test').Page> {
  const deadline = Date.now() + POLL_TIMEOUT;
  while (Date.now() < deadline) {
    const pages = electronApp.context().pages();
    for (const page of pages) {
      try {
        if (page.url().includes(urlFragment)) {
          return page;
        }
      } catch {
        // Page might be closed or loading
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
  throw new Error(`Mock page containing "${urlFragment}" not found within ${POLL_TIMEOUT}ms`);
}

/**
 * Runs the full mock chat-flow verification for one provider:
 * updateProvider -> injectPrompt -> streaming -> waitForComplete -> extractResponse
 *
 * Mock pages replicate real site DOM structures so the inject runtime
 * exercises the exact same selector paths as with live provider sites.
 */
async function verifyChatFlow(
  electronApp: import('@playwright/test').ElectronApplication,
  appWindow: import('@playwright/test').Page,
  providerKey: string,
  urlFragment: string,
  displayName: string,
): Promise<void> {
  // 1. Switch pane 0 to this provider (URL is already mock via config)
  await updateProvider(appWindow, { paneIndex: 0, providerKey });

  // 2. Find the mock pane page
  const mockPage = await findMockPage(electronApp, urlFragment);

  // 3. Verify __llmBridge is present and detected correctly
  //    The inject runtime should detect the provider via urlPattern matching
  //    and use REAL selectors from providers/*/inject.ts (not mock overrides).
  const bridgeInfo = await mockPage.evaluate(() => {
    const bridge = (window as unknown as { __llmBridge?: { provider: string } }).__llmBridge;
    return bridge ? { exists: true, provider: bridge.provider } : { exists: false, provider: '' };
  });
  expect(bridgeInfo.exists).toBe(true);
  expect(bridgeInfo.provider).toBe(providerKey);

  // 4. Send a prompt via the sidebar composer
  const textarea = appWindow.locator(selectors.promptTextarea);
  const sendButton = appWindow.locator(selectors.promptSendButton);

  await textarea.fill(`Hello ${displayName}`);
  await sendButton.click();

  // 5. Verify the prompt was injected into the mock page.
  //    The mock page tracks the last submitted input in window.__mockLastInput.
  //    This confirms the full chain: sidebar -> IPC -> injectPrompt -> mock DOM.
  await mockPage.waitForFunction(
    (expected: string) => {
      return (window as unknown as { __mockLastInput?: string }).__mockLastInput === expected;
    },
    `Hello ${displayName}`,
    { timeout: POLL_TIMEOUT },
  );

  // 6. Wait for completion via the inject bridge's own API.
  //    This exercises the real streaming-status.ts detection logic:
  //    isStreaming() checks for streaming indicator selectors,
  //    isComplete() checks streaming is gone + complete indicators present.
  const result = await mockPage.evaluate(() => {
    const bridge = (window as unknown as {
      __llmBridge?: { waitForComplete: (t: number, p: number) => Promise<{
        isComplete: boolean;
        response: string | null;
      }> };
    }).__llmBridge;
    return bridge?.waitForComplete(15000, 300);
  });

  expect(result).toBeDefined();
  expect(result?.isComplete).toBe(true);
  expect(result?.response).toContain('streamed response');
}

test.describe('E2E / Chat Flow (Mock)', () => {
  test('chatgpt: full inject bridge flow', async ({ electronApp, appWindow }) => {
    await verifyChatFlow(
      electronApp, appWindow,
      'chatgpt', 'chatgpt-simulation.html', 'ChatGPT',
    );
  });

  test('grok: full inject bridge flow', async ({ electronApp, appWindow }) => {
    await verifyChatFlow(
      electronApp, appWindow,
      'grok', 'grok-simulation.html', 'Grok',
    );
  });

  test('gemini: full inject bridge flow', async ({ electronApp, appWindow }) => {
    await verifyChatFlow(
      electronApp, appWindow,
      'gemini', 'gemini-simulation.html', 'Gemini',
    );
  });
});
