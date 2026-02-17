import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

test.describe('E2E / Sidebar Queue', () => {
  test('queue panel replaces sidebar prompt composer', async ({ appWindow }) => {
    const queueList = appWindow.locator(selectors.queueList);
    const queueEmpty = appWindow.locator(selectors.queueEmpty);

    await expect(queueList).toBeVisible();
    await expect(queueEmpty).toBeVisible();
    await expect(queueEmpty).toContainText('No pending quick prompt');

    await expect(appWindow.locator('textarea.composer-textarea')).toHaveCount(0);
    await expect(appWindow.locator('button.composer-send-btn')).toHaveCount(0);
  });
});
