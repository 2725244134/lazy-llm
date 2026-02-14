import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';
import { join } from 'path';

// Set environment variable before tests run
const mockConfigPath = join(process.cwd(), 'tests/fixtures/mock-site/mock-provider-config.json');
process.env.LAZYLLM_EXTRA_PROVIDERS_FILE = mockConfigPath;

test.describe('E2E / Chat Flow (Mock)', () => {
  test('can send message and receive mock response', async ({ electronApp, appWindow }) => {
    // 1. Wait for app to be ready
    await expect(appWindow.locator(selectors.appLayout)).toBeVisible();

    // 2. Switch to mock provider via bridge
    await appWindow.evaluate(async () => {
      // @ts-ignore
      if (window.lazyllm) {
        // @ts-ignore
        await window.lazyllm.updateProvider({ paneIndex: 0, providerKey: 'mock-chatgpt' });
      } else {
        throw new Error('lazyllm bridge not found');
      }
    });

    // 3. Find the pane page
    let mockPage = null;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const pages = electronApp.context().pages();
      for (const page of pages) {
        try {
          const url = page.url();
          if (url.includes('chatgpt-simulation.html')) {
            mockPage = page;
            break;
          }
        } catch (e) {
          // Page might be closed or loading
        }
      }
      if (mockPage) break;
      await new Promise(r => setTimeout(r, 500));
    }

    expect(mockPage, 'Mock page should be found').not.toBeNull();
    if (!mockPage) return;

    // 4. Send message via App Sidebar
    // This triggers the Main Process to inject inject.js and execute the prompt
    await appWindow.locator(selectors.promptTextarea).fill('Hello Mock');
    await appWindow.locator(selectors.promptSendButton).click();

    // 5. Verify Injection in Mock Page
    // Wait for the prompt to appear in the mock page's textarea
    await mockPage.waitForFunction(() => {
      const el = document.querySelector('#prompt-textarea') as HTMLTextAreaElement;
      return el && el.value === 'Hello Mock';
    }, null, { timeout: 10000 });

    // 6. Verify Mock Page simulates response
    // The mock page script should automatically generate a response after submission
    // We wait for the assistant message
    const responseSelector = '.message-row.assistant .content';
    await mockPage.waitForSelector(responseSelector);

    // Check for streamed content
    await expect(mockPage.locator(responseSelector).last()).toContainText('This is a streamed response', { timeout: 15000 });

    // 7. Verify Bridge is present (it should have been injected by sendPromptToAll)
    const bridgeExists = await mockPage.evaluate(() => typeof window.__llmBridge !== 'undefined');
    expect(bridgeExists).toBe(true);

    const provider = await mockPage.evaluate(() => window.__llmBridge?.provider);
    expect(provider).toBe('mock-chatgpt');

    // 8. Verify Extraction via Bridge
    const completionResult = await mockPage.evaluate(() => window.__llmBridge?.waitForComplete(10000, 500));
    expect(completionResult).not.toBeNull();
    expect(completionResult?.isComplete).toBe(true);
    expect(completionResult?.response).toContain('This is a streamed response');
  });
});
