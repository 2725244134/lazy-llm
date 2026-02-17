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

  test('queue timeline groups by dispatch round and expands latest round by default', async ({ appWindow }) => {
    await appWindow.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent('lazyllm:quick-prompt-queue', {
          detail: {
            entries: [
              {
                queueItemId: 'q-11',
                roundId: 1,
                paneIndex: 0,
                text: 'first round pane one',
                queuedAtMs: Date.now() - 4_000,
              },
              {
                queueItemId: 'q-12',
                roundId: 1,
                paneIndex: 1,
                text: 'first round pane two',
                queuedAtMs: Date.now() - 3_500,
              },
              {
                queueItemId: 'q-13',
                roundId: 2,
                paneIndex: 0,
                text: 'second round pane one',
                queuedAtMs: Date.now() - 1_000,
              },
            ],
          },
        }),
      );
    });

    await expect(appWindow.locator(selectors.queueRound)).toHaveCount(2);
    await expect(appWindow.locator(selectors.queueRoundToggle).nth(0)).toContainText('Round 1');
    await expect(appWindow.locator(selectors.queueRoundToggle).nth(1)).toContainText('Round 2');
    await expect(appWindow.locator(selectors.queueRoundExpanded)).toHaveCount(1);
    await expect(
      appWindow.locator(`${selectors.queueRoundExpanded} ${selectors.queueRoundToggle}`),
    ).toContainText('Round 2');
    await expect(appWindow.locator(selectors.queueItem)).toHaveCount(1);
    await expect(appWindow.locator(selectors.queueClearAll)).toBeVisible();
    await expect(appWindow.locator(selectors.queueRoundRemove).first()).toBeVisible();
    await expect(appWindow.locator(selectors.queueItemRemove)).toBeVisible();
  });
});
