import { join } from 'path';
import { createMockTest, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';
import { updateProvider } from '../helpers/lazyllm';

const mockConfigPath = join(process.cwd(), 'tests/fixtures/mock-site/mock-provider-config.json');
const test = createMockTest({ mockProvidersFile: mockConfigPath });

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
 */
async function verifyChatFlow(
  electronApp: import('@playwright/test').ElectronApplication,
  appWindow: import('@playwright/test').Page,
  mockKey: string,
  urlFragment: string,
  expectedProvider: string,
): Promise<void> {
  // 1. Switch pane 0 to the mock provider
  await updateProvider(appWindow, { paneIndex: 0, providerKey: mockKey });

  // 2. Find the mock pane page
  const mockPage = await findMockPage(electronApp, urlFragment);

  // 3. Send a prompt via the sidebar composer
  const textarea = appWindow.locator(selectors.promptTextarea);
  const sendButton = appWindow.locator(selectors.promptSendButton);

  await textarea.fill(`Hello ${expectedProvider}`);
  await sendButton.click();

  // 4. Verify the prompt was injected into the mock page
  await mockPage.waitForFunction(
    (expected: string) => {
      const el = document.querySelector('#prompt-textarea') as HTMLTextAreaElement;
      return el && el.value === expected;
    },
    `Hello ${expectedProvider}`,
    { timeout: POLL_TIMEOUT },
  );

  // 5. Wait for assistant response to appear
  await expect(
    mockPage.locator('.message-row.assistant .content').last(),
  ).toContainText('streamed response', { timeout: POLL_TIMEOUT });

  // 6. Verify __llmBridge is present and detected correctly
  const bridgeInfo = await mockPage.evaluate(() => {
    const bridge = (window as unknown as { __llmBridge?: { provider: string } }).__llmBridge;
    return bridge ? { exists: true, provider: bridge.provider } : { exists: false, provider: '' };
  });
  expect(bridgeInfo.exists).toBe(true);
  expect(bridgeInfo.provider).toBe(mockKey);

  // 7. Wait for completion and verify extraction
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
  test('mock-chatgpt: full inject bridge flow', async ({ electronApp, appWindow }) => {
    await verifyChatFlow(
      electronApp, appWindow,
      'mock-chatgpt', 'chatgpt-simulation.html', 'ChatGPT',
    );
  });

  test('mock-grok: full inject bridge flow', async ({ electronApp, appWindow }) => {
    await verifyChatFlow(
      electronApp, appWindow,
      'mock-grok', 'grok-simulation.html', 'Grok',
    );
  });

  test('mock-gemini: full inject bridge flow', async ({ electronApp, appWindow }) => {
    await verifyChatFlow(
      electronApp, appWindow,
      'mock-gemini', 'gemini-simulation.html', 'Gemini',
    );
  });
});
