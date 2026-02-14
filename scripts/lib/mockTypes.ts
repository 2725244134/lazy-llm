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
