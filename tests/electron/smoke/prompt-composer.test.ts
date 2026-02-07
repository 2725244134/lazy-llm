import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

test.describe('Smoke / Prompt Composer', () => {
  test('prompt composer is visible and functional', async ({ appWindow }) => {
    const textarea = appWindow.locator(selectors.promptTextarea);
    const sendButton = appWindow.locator(selectors.promptSendButton);

    await expect(textarea).toBeVisible();
    await expect(textarea).toBeFocused();

    await expect(sendButton).toBeVisible();
    await expect(sendButton).toBeDisabled();

    await textarea.fill('Hello, world!');
    await expect(sendButton).toBeEnabled();
  });
});
