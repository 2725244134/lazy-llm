import {
  expect,
  test as base,
  _electron as electron,
  type ElectronApplication,
  type Page,
} from '@playwright/test';

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
    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await use(window);
  },
});

export { expect };
