import { test, expect } from '../fixtures/electronApp';
import { getLayoutSnapshot, updateProvider } from '../helpers/council';
import { selectors } from '../helpers/selectors';

test.describe('Smoke / Panes', () => {
  test('pane selector works', async ({ appWindow }) => {
    const paneButton3 = appWindow.locator(selectors.paneChip3);
    await paneButton3.click();
    await expect(paneButton3).toHaveClass(/active/);

    const snapshotAfterPane3 = await getLayoutSnapshot(appWindow);
    expect(snapshotAfterPane3.paneCount).toBe(3);
    expect(snapshotAfterPane3.panes.length).toBe(3);

    const paneButton1 = appWindow.locator(selectors.paneChip1);
    await paneButton1.click();
    await expect(paneButton1).toHaveClass(/active/);

    const snapshotAfterPane1 = await getLayoutSnapshot(appWindow);
    expect(snapshotAfterPane1.paneCount).toBe(1);
    expect(snapshotAfterPane1.panes.length).toBe(1);
  });

  test('provider update changes pane webview target', async ({ appWindow }) => {
    const updateResult = await updateProvider(appWindow, {
      paneIndex: 0,
      providerKey: 'grok',
    });

    expect(updateResult.success).toBe(true);

    const snapshot = await getLayoutSnapshot(appWindow);
    expect(snapshot.panes[0]?.providerKey).toBe('grok');
  });
});
