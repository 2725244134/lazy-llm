import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures/electronApp';
import { selectors } from '../helpers/selectors';

const SIDEBAR_WIDTH_SAMPLE_COUNT = 8;
const SIDEBAR_WIDTH_SAMPLE_INTERVAL_MS = 35;

async function collectSidebarWidthSamples(appWindow: Page): Promise<number[]> {
  return appWindow.evaluate(
    async ({ sampleCount, intervalMs }) => {
      const sidebar = document.querySelector<HTMLElement>('aside.sidebar');
      if (!sidebar) {
        throw new Error('Sidebar element not found');
      }

      const readWidth = () => Math.round(sidebar.getBoundingClientRect().width);
      const samples: number[] = [readWidth()];
      for (let index = 0; index < sampleCount; index += 1) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, intervalMs);
        });
        samples.push(readWidth());
      }
      return samples;
    },
    { sampleCount: SIDEBAR_WIDTH_SAMPLE_COUNT, intervalMs: SIDEBAR_WIDTH_SAMPLE_INTERVAL_MS },
  );
}

function hasIntermediateWidthSample(samples: number[], fromWidth: number, toWidth: number): boolean {
  const lowerBound = Math.min(fromWidth, toWidth);
  const upperBound = Math.max(fromWidth, toWidth);
  return samples.some((width) => width > lowerBound && width < upperBound);
}

test.describe('Smoke / Sidebar', () => {
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
    await expect.poll(async () => {
      return appWindow.evaluate(() => {
        return document.activeElement?.classList.contains('composer-textarea') ?? false;
      });
    }).toBe(true);
  });

  test('sidebar width transition includes intermediate frames', async ({ appWindow }) => {
    const sidebar = appWindow.locator(selectors.sidebar);
    const toggleButton = appWindow.locator(selectors.sidebarCollapse);
    const readSidebarWidth = async () => {
      return sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width));
    };

    const expandedWidthBefore = await readSidebarWidth();
    await toggleButton.click();
    const collapseSamples = await collectSidebarWidthSamples(appWindow);
    await expect(sidebar).toHaveClass(/collapsed/);
    const collapsedWidth = await readSidebarWidth();

    expect(collapsedWidth).toBeLessThan(expandedWidthBefore);
    expect(hasIntermediateWidthSample(collapseSamples, expandedWidthBefore, collapsedWidth)).toBe(true);

    await toggleButton.click();
    const expandSamples = await collectSidebarWidthSamples(appWindow);
    await expect(sidebar).not.toHaveClass(/collapsed/);
    const expandedWidthAfter = await readSidebarWidth();

    expect(expandedWidthAfter).toBeGreaterThan(collapsedWidth);
    expect(hasIntermediateWidthSample(expandSamples, collapsedWidth, expandedWidthAfter)).toBe(true);
  });
});
