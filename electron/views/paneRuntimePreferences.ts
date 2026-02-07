export const PANE_ACCEPT_LANGUAGES = 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7';
export const PANE_DEFAULT_ZOOM_FACTOR = 1.1;

const ELECTRON_UA_TOKEN = /\bElectron\/[^\s]+/g;
const APP_UA_TOKEN = /\blazy-llm\/[^\s]+/g;
const MULTI_SPACE = /\s{2,}/g;

export function normalizePaneUserAgent(userAgent: string): string {
  const normalized = userAgent
    .replace(ELECTRON_UA_TOKEN, '')
    .replace(APP_UA_TOKEN, '')
    .replace(MULTI_SPACE, ' ')
    .trim();

  return normalized.length > 0 ? normalized : userAgent;
}
