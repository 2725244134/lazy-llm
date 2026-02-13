export interface ProviderMeta {
  key: string;
  name: string;
  url: string;
}

export interface ProviderInject {
  inputSelectors: string[];
  submitSelectors: string[];
  responseSelectors?: string[];
  streamingIndicatorSelectors?: string[];
  completeIndicatorSelectors?: string[];
  extractMode?: 'last' | 'all';
  handleInput?: (el: HTMLElement, text: string) => void;
  detectComplete?: () => boolean;
  extractResponse?: () => string | null;
}

export interface Provider {
  meta: ProviderMeta;
  inject: ProviderInject;
  Icon: string;
}
