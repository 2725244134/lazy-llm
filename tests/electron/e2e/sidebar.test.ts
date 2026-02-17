import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

const SIDEBAR_WIDTH_CAPTURE_DURATION_MS = 520;

async function captureSidebarWidthSamples(appWindow: Page): Promise<number[]> {
  return appWindow.evaluate(
    ({ durationMs }) => {
      const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
      if (!sidebar) {
        throw new Error('Sidebar element not found');
      }

      return new Promise<number[]>((resolve) => {
        const samples: number[] = [];
        const readWidth = () => Math.round(sidebar.getBoundingClientRect().width);
        const startAt = performance.now();

        const capture = () => {
          samples.push(readWidth());
          if (performance.now() - startAt >= durationMs) {
            resolve(samples);
            return;
          }
          window.requestAnimationFrame(capture);
        };

        capture();
      });
    },
    { durationMs: SIDEBAR_WIDTH_CAPTURE_DURATION_MS },
  );
}

function hasIntermediateWidthSample(samples: number[], fromWidth: number, toWidth: number): boolean {
  const lowerBound = Math.min(fromWidth, toWidth);
  const upperBound = Math.max(fromWidth, toWidth);
  return samples.some((width) => width > lowerBound && width < upperBound);
}

test.describe('E2E / Sidebar', () => {
  test('sidebar toggle works', async ({ appWindow }) => {
    const sidebar = appWindow.locator(selectors.sidebar);
    const toggleButton = appWindow.locator(selectors.sidebarCollapse);

    await expect(sidebar).not.toHaveClass(/collapsed/);

    await toggleButton.click();
    await expect(sidebar).toHaveClass(/collapsed/);

    await toggleButton.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('sidebar toggle shortcut works', async ({ appWindow }) => {
    const sidebar = appWindow.locator(selectors.sidebar);

    await expect(sidebar).not.toHaveClass(/collapsed/);

    await appWindow.evaluate(() => {
      window.dispatchEvent(new Event('lazyllm:shortcut-toggle-sidebar'));
    });
    await expect(sidebar).toHaveClass(/collapsed/);

    await appWindow.evaluate(() => {
      window.dispatchEvent(new Event('lazyllm:shortcut-toggle-sidebar'));
    });
    await expect(sidebar).not.toHaveClass(/collapsed/);
  });

  test('sidebar width transition includes intermediate frames', async ({ appWindow }) => {
    const sidebar = appWindow.locator(selectors.sidebar);
    const toggleButton = appWindow.locator(selectors.sidebarCollapse);
    const readSidebarWidth = async () => {
      return sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width));
    };

    const expandedWidthBefore = await readSidebarWidth();
    const collapseSamplesPromise = captureSidebarWidthSamples(appWindow);
    await toggleButton.click();
    await expect(sidebar).toHaveClass(/collapsed/);
    const collapseSamples = await collapseSamplesPromise;
    const collapsedWidth = await readSidebarWidth();

    expect(collapsedWidth).toBeLessThan(expandedWidthBefore);
    expect(hasIntermediateWidthSample(collapseSamples, expandedWidthBefore, collapsedWidth)).toBe(true);

    const expandSamplesPromise = captureSidebarWidthSamples(appWindow);
    await toggleButton.click();
    await expect(sidebar).not.toHaveClass(/collapsed/);
    const expandSamples = await expandSamplesPromise;
    const expandedWidthAfter = await readSidebarWidth();

    expect(expandedWidthAfter).toBeGreaterThan(collapsedWidth);
    expect(hasIntermediateWidthSample(expandSamples, collapsedWidth, expandedWidthAfter)).toBe(true);
  });
});
