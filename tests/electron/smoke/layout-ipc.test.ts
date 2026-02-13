import { test, expect } from '../fixtures/electronApp';
import { getHealthCheck, resetAllPanes } from '../helpers/lazyllm';

test.describe('Smoke / IPC', () => {
  test('IPC health check works', async ({ appWindow }) => {
    const health = await getHealthCheck(appWindow);

    expect(health.ok).toBe(true);
    expect(health.runtime).toBe('electron');
    expect(typeof health.version).toBe('string');
  });

  test('layout update IPC accepts pane count and sidebar width', async ({ appWindow }) => {
    const result = await appWindow.evaluate(() => {
      return window.lazyllm.updateLayout({ paneCount: 3, sidebarWidth: 320 });
    });

    expect(result.success).toBe(true);
  });

  test('reset-all IPC succeeds', async ({ appWindow }) => {
    const result = await resetAllPanes(appWindow);
    expect(result.success).toBe(true);
  });
});
