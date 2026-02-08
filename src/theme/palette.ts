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
  '--bg': '#191724',
  '--bg-hover': '#1f1d2e',
  '--border': '#403d52',
  '--text': '#e0def4',
  '--text-muted': '#908caa',
  '--accent': '#ebbcba',
  '--broadcast': '#c4a7e7',
  '--sidebar-scrollbar-thumb': '#524f67',
  '--sidebar-scrollbar-thumb-hover': '#6e6a86',
  '--select-open-ring': 'rgba(196, 167, 231, 0.24)',
  '--select-item-hover-bg': 'rgba(196, 167, 231, 0.14)',
  '--select-item-selected-bg': 'rgba(224, 222, 244, 0.12)',
  '--input-scrollbar-thumb': 'rgba(196, 167, 231, 0.45)',
  '--input-scrollbar-thumb-hover': 'rgba(196, 167, 231, 0.58)',
  '--input-scrollbar-thumb-focus': 'rgba(196, 167, 231, 0.75)',
  '--input-border-hover': '#9ccfd8',
  '--input-focus-ring': 'rgba(196, 167, 231, 0.24)',
  '--input-focus-shadow': 'rgba(196, 167, 231, 0.16)',
  '--input-inner-highlight': 'rgba(224, 222, 244, 0.08)',
  '--input-inner-highlight-hover': 'rgba(224, 222, 244, 0.12)',
} as const satisfies CssVariableMap;

const ROSE_PINE_MAIN_QUICK_PROMPT_VARS = {
  '--qp-surface': 'rgba(31, 29, 46, 0.96)',
  '--qp-surface-soft': 'rgba(38, 35, 58, 0.94)',
  '--qp-border': '#524f67',
  '--qp-border-focus': '#c4a7e7',
  '--qp-ring': 'rgba(196, 167, 231, 0.26)',
  '--qp-inner-stroke': 'rgba(224, 222, 244, 0.18)',
  '--qp-text': '#e0def4',
  '--qp-placeholder': '#908caa',
  '--qp-shadow': '0 14px 28px rgba(25, 23, 36, 0.44)',
  '--qp-shadow-focus': '0 18px 32px rgba(25, 23, 36, 0.56)',
  '--qp-inset-top': 'rgba(224, 222, 244, 0.16)',
  '--qp-inset-bottom': 'rgba(196, 167, 231, 0.24)',
  '--qp-inset-top-focus': 'rgba(224, 222, 244, 0.2)',
  '--qp-inset-bottom-focus': 'rgba(196, 167, 231, 0.32)',
  '--qp-scrollbar-thumb': 'rgba(144, 140, 170, 0.5)',
  '--qp-scrollbar-thumb-hover': 'rgba(156, 207, 216, 0.72)',
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
