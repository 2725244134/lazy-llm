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
  '--bg': '#ffffff',
  '--bg-hover': '#f3f4f6',
  '--border': '#e5e7eb',
  '--text': '#1f2937',
  '--text-muted': '#6b7280',
  '--accent': '#eba0ac',
  '--broadcast': '#eba0ac',
  '--sidebar-scrollbar-thumb': '#d1d5db',
  '--sidebar-scrollbar-thumb-hover': '#b8c0cc',
  '--select-open-ring': 'rgba(235, 160, 172, 0.26)',
  '--select-item-hover-bg': 'rgba(235, 160, 172, 0.12)',
  '--select-item-selected-bg': 'rgba(245, 224, 220, 0.9)',
  '--input-scrollbar-thumb': 'rgba(235, 160, 172, 0.42)',
  '--input-scrollbar-thumb-hover': 'rgba(235, 160, 172, 0.56)',
  '--input-scrollbar-thumb-focus': 'rgba(235, 160, 172, 0.72)',
  '--input-border-hover': '#f1c7be',
  '--input-focus-ring': 'rgba(235, 160, 172, 0.24)',
  '--input-focus-shadow': 'rgba(235, 160, 172, 0.14)',
  '--input-inner-highlight': 'rgba(255, 255, 255, 0.66)',
  '--input-inner-highlight-hover': 'rgba(255, 255, 255, 0.82)',
} as const satisfies CssVariableMap;

const ROSE_PINE_MAIN_QUICK_PROMPT_VARS = {
  '--qp-surface': 'rgba(255, 255, 255, 0.97)',
  '--qp-surface-soft': 'rgba(248, 250, 252, 0.93)',
  '--qp-border': '#d7dce6',
  '--qp-border-focus': '#eba0ac',
  '--qp-ring': 'rgba(235, 160, 172, 0.2)',
  '--qp-inner-stroke': 'rgba(255, 255, 255, 0.88)',
  '--qp-text': '#1f2937',
  '--qp-placeholder': '#6b7280',
  '--qp-shadow': '0 12px 24px rgba(15, 23, 42, 0.12)',
  '--qp-shadow-focus': '0 16px 30px rgba(235, 160, 172, 0.24)',
  '--qp-inset-top': 'rgba(255, 255, 255, 0.82)',
  '--qp-inset-bottom': 'rgba(245, 224, 220, 0.34)',
  '--qp-inset-top-focus': 'rgba(255, 255, 255, 0.9)',
  '--qp-inset-bottom-focus': 'rgba(235, 160, 172, 0.3)',
  '--qp-scrollbar-thumb': 'rgba(235, 160, 172, 0.44)',
  '--qp-scrollbar-thumb-hover': 'rgba(235, 160, 172, 0.62)',
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
