import {
  expect,
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { selectors } from '../helpers/selectors';

type ElectronFixtures = {
  electronApp: ElectronApplication;
  appWindow: Page;
};

function createLaunchEnv(): Record<string, string> {
  const envEntries = Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return {
    ...Object.fromEntries(envEntries),
    NODE_ENV: 'production',
  };
}

async function hasCouncilBridge(page: Page): Promise<boolean> {
  if (page.isClosed()) {
    return false;
  }

  try {
    return await page.evaluate(() => {
      const bridge = globalThis as unknown as {
        council?: { healthCheck?: unknown };
      };
      return typeof bridge.council?.healthCheck === 'function';
    });
  } catch {
    return false;
  }
}

async function resolveAppWindow(electronApp: ElectronApplication): Promise<Page> {
  await electronApp.firstWindow();

  const timeoutMs = 20000;
  const pollIntervalMs = 200;
  const deadline = Date.now() + timeoutMs;
  let lastObservedWindows = '<none>';

  while (Date.now() < deadline) {
    const windows = electronApp.windows();

    for (const window of windows) {
      if (!(await hasCouncilBridge(window))) {
        continue;
      }

      await window.waitForLoadState('domcontentloaded');
      return window;
    }

    lastObservedWindows = windows
      .map((window, index) => `${index}:${window.url() || '<empty-url>'}`)
      .join(', ') || '<none>';

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Unable to locate app window with council bridge within ${timeoutMs}ms. Windows: ${lastObservedWindows}`,
  );
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const electronApp = await electron.launch({
      args: ['.'],
      env: createLaunchEnv(),
    });

    await use(electronApp);
    await electronApp.close();
  },

  appWindow: async ({ electronApp }, use) => {
    const appPage = await resolveAppWindow(electronApp);
    await expect(appPage.locator(selectors.appLayout)).toBeVisible({ timeout: 15000 });
    await use(appPage);
  },
});

export { expect };
