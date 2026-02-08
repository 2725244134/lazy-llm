type CssVariableKey = `--${string}`;

export type CssVariableMap = Readonly<Record<CssVariableKey, string>>;

export interface ThemePreset {
  sidebarVars: CssVariableMap;
  quickPromptVars: CssVariableMap;
}

export const THEME_PRESET_KEYS = ['rosePineMain'] as const;
export type ThemePresetKey = (typeof THEME_PRESET_KEYS)[number];

export const ACTIVE_THEME_PRESET: ThemePresetKey = 'rosePineMain';

const ROSE_PINE_MAIN_SIDEBAR_VARS = {
  '--bg': '#f7f8fb',
  '--bg-hover': '#eef1f7',
  '--border': '#d9dce6',
  '--text': '#575279',
  '--text-muted': '#797593',
  '--accent': '#d7827e',
  '--broadcast': '#eb6f92',
  '--sidebar-scrollbar-thumb': '#c6cbdb',
  '--sidebar-scrollbar-thumb-hover': '#b7bdd0',
  '--select-open-ring': 'rgba(235, 111, 146, 0.2)',
  '--select-item-hover-bg': 'rgba(235, 111, 146, 0.12)',
  '--select-item-selected-bg': 'rgba(183, 99, 122, 0.14)',
  '--input-scrollbar-thumb': 'rgba(235, 111, 146, 0.42)',
  '--input-scrollbar-thumb-hover': 'rgba(235, 111, 146, 0.58)',
  '--input-scrollbar-thumb-focus': 'rgba(235, 111, 146, 0.72)',
  '--input-border-hover': '#ea9dba',
  '--input-focus-ring': 'rgba(235, 111, 146, 0.24)',
  '--input-focus-shadow': 'rgba(235, 111, 146, 0.14)',
  '--input-inner-highlight': 'rgba(255, 255, 255, 0.66)',
  '--input-inner-highlight-hover': 'rgba(255, 255, 255, 0.82)',
} as const satisfies CssVariableMap;

const ROSE_PINE_MAIN_QUICK_PROMPT_VARS = {
  '--qp-surface': 'rgba(248, 250, 255, 0.98)',
  '--qp-surface-soft': 'rgba(242, 245, 252, 0.96)',
  '--qp-border': '#cfd4e3',
  '--qp-border-focus': '#eb6f92',
  '--qp-ring': 'rgba(235, 111, 146, 0.22)',
  '--qp-inner-stroke': 'rgba(255, 255, 255, 0.85)',
  '--qp-text': '#575279',
  '--qp-placeholder': '#797593',
  '--qp-shadow': '0 12px 24px rgba(66, 74, 99, 0.14)',
  '--qp-shadow-focus': '0 16px 30px rgba(183, 99, 122, 0.2)',
  '--qp-inset-top': 'rgba(255, 255, 255, 0.82)',
  '--qp-inset-bottom': 'rgba(235, 111, 146, 0.2)',
  '--qp-inset-top-focus': 'rgba(255, 255, 255, 0.9)',
  '--qp-inset-bottom-focus': 'rgba(235, 111, 146, 0.28)',
  '--qp-scrollbar-thumb': 'rgba(183, 99, 122, 0.46)',
  '--qp-scrollbar-thumb-hover': 'rgba(235, 111, 146, 0.66)',
} as const satisfies CssVariableMap;

const THEME_PRESETS: Record<ThemePresetKey, ThemePreset> = {
  rosePineMain: {
    sidebarVars: ROSE_PINE_MAIN_SIDEBAR_VARS,
    quickPromptVars: ROSE_PINE_MAIN_QUICK_PROMPT_VARS,
  },
};

export function getThemePreset(presetKey: ThemePresetKey = ACTIVE_THEME_PRESET): ThemePreset {
  return THEME_PRESETS[presetKey];
}

export function getSidebarThemeVars(presetKey: ThemePresetKey = ACTIVE_THEME_PRESET): CssVariableMap {
  return getThemePreset(presetKey).sidebarVars;
}

export function getQuickPromptThemeVars(
  presetKey: ThemePresetKey = ACTIVE_THEME_PRESET
): CssVariableMap {
  return getThemePreset(presetKey).quickPromptVars;
}

export function renderCssVariableBlock(vars: CssVariableMap): string {
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ');
}
