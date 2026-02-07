import { test, expect } from '../fixtures/electronApp';
import { getHealthCheck, getLayoutMetrics } from '../helpers/council';

test.describe('Smoke / Layout And IPC', () => {
  test('layout snapshot uses content-area dimensions', async ({ appWindow }) => {
    const metrics = await getLayoutMetrics(appWindow);

    expect(metrics.snapshot.windowWidth).toBeGreaterThanOrEqual(metrics.innerWidth);
    expect(metrics.snapshot.windowHeight).toBe(metrics.innerHeight);
    expect(metrics.snapshot.sidebar.width).toBe(metrics.innerWidth);
    expect(metrics.snapshot.sidebar.height).toBe(metrics.innerHeight);

    for (const pane of metrics.snapshot.panes) {
      expect(pane.bounds.height).toBe(metrics.innerHeight);
    }
  });

  test('IPC health check works', async ({ appWindow }) => {
    const health = await getHealthCheck(appWindow);

    expect(health.ok).toBe(true);
    expect(health.runtime).toBe('electron');
    expect(typeof health.version).toBe('string');
  });
});
