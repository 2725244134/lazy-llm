/**
 * Shared types for mock capture/generate/parity CLI tools.
 */

/** Selector contract for a single mock provider. */
export interface MockProviderProfile {
  /** Provider key matching the inject system (e.g. 'chatgpt', 'grok', 'gemini'). */
  key: string;
  /** Display name for logging. */
  name: string;
  /** Real-site URL used during capture (login target). */
  realUrl: string;
  /** Hostname(s) used for provider detection on the real site. */
  hostnames: string[];
  /** CSS selectors for the input element. */
  inputSelectors: string[];
  /** CSS selectors for the submit button. */
  submitSelectors: string[];
  /** CSS selectors for the response container. */
  responseSelectors: string[];
  /** CSS selectors for the streaming indicator. */
  streamingIndicatorSelectors: string[];
  /** CSS selectors for the complete indicator. */
  completeIndicatorSelectors: string[];
  /** Extraction mode. */
  extractMode: 'last' | 'all';
  /** CSS selector for the chat/conversation region container (used by crawl). */
  chatRegionSelector?: string;
  /** CSS selector for the input region container (used by crawl). */
  inputRegionSelector?: string;
}

/**
 * Schema for a single entry in mock-provider-config.json.
 * Only url and urlPattern are required. Real selectors come from
 * the provider inject configs via the per-key spread merge in inject.ts.
 * Selector overrides are supported but rarely needed.
 */
export interface MockProviderConfigEntry {
  url: string;
  urlPattern: string;
  inputSelectors?: string[];
  submitSelectors?: string[];
  responseSelectors?: string[];
  streamingIndicatorSelectors?: string[];
  completeIndicatorSelectors?: string[];
  extractMode?: 'last' | 'all';
}

/** Full mock provider config file (key -> entry). */
export type MockProviderConfigFile = Record<string, MockProviderConfigEntry>;

/** Capture snapshot output. */
export interface CaptureSnapshot {
  provider: string;
  capturedAt: string;
  url: string;
  rawHtml: string;
  normalizedDom: NormalizedDomNode;
}

/** Normalized DOM tree node for parity checking. */
export interface NormalizedDomNode {
  tag: string;
  attrs: Record<string, string>;
  children: NormalizedDomNode[];
  textContent?: string;
}

/** Parity manifest entry for one provider. */
export interface ParityManifestEntry {
  provider: string;
  /** Key structural selectors that must exist in mock. */
  structuralSelectors: string[];
  /** Selector probe contracts. */
  selectorProbes: SelectorProbe[];
}

/** A single selector probe in the parity manifest. */
export interface SelectorProbe {
  /** Category of the probe. */
  category: 'input' | 'submit' | 'streaming' | 'complete' | 'extract';
  /** CSS selector to test. */
  selector: string;
  /** Whether this probe must pass for the manifest to be valid. */
  required: boolean;
}

/** Parity check result. */
export interface ParityResult {
  provider: string;
  passed: boolean;
  domParityPassed: boolean;
  selectorProbePassed: boolean;
  failures: ParityFailure[];
}

/** A single parity check failure. */
export interface ParityFailure {
  type: 'dom-parity' | 'selector-probe';
  category?: string;
  selector?: string;
  message: string;
}

/** Structured CLI output envelope. */
export interface CliOutput<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ---------------------------------------------------------------------------
// Style-aware crawl types (used by mockCrawlCli / mockTransformCli)
// ---------------------------------------------------------------------------

/** CSS properties captured during style-aware crawl. */
export const CRAWL_CSS_PROPERTIES = [
  // Box model & layout
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'box-sizing',
  // Flex
  'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink', 'flex-basis',
  'justify-content', 'align-items', 'align-self', 'gap', 'row-gap', 'column-gap',
  // Grid
  'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
  // Border
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-radius',
  // Color & background
  'color', 'background-color', 'background-image', 'opacity',
  // Typography
  'font-family', 'font-size', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-align', 'text-decoration',
  'text-transform', 'white-space', 'word-break', 'overflow-wrap',
  // Overflow & visual
  'overflow', 'overflow-x', 'overflow-y',
  'visibility', 'z-index', 'cursor', 'box-shadow', 'outline',
  'transform', 'transition',
] as const;

export type CrawlCssProperty = (typeof CRAWL_CSS_PROPERTIES)[number];

/** A DOM node with computed style diffs captured by the crawl step. */
export interface StyledDomNode {
  tag: string;
  attrs: Record<string, string>;
  children: StyledDomNode[];
  textContent?: string;
  /** Only non-default computed style values. */
  computedStyles: Partial<Record<CrawlCssProperty, string>>;
}

/** Output of the style-aware crawl step. */
export interface CrawlSnapshot {
  provider: string;
  capturedAt: string;
  url: string;
  chatRegionDom: StyledDomNode;
  inputRegionDom: StyledDomNode;
  cssVariables: Record<string, string>;
  fonts: string[];
}

/** Drift report comparing capture snapshot against parity manifest. */
export interface DriftReport {
  provider: string;
  capturedAt: string;
  selectorsFound: SelectorDriftEntry[];
  selectorsMissing: SelectorDriftEntry[];
}

/** A single selector entry in a drift report. */
export interface SelectorDriftEntry {
  selector: string;
  category: string;
  required: boolean;
}
