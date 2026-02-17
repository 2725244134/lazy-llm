import { findAllElements } from './dom-query';

const POSITIVE_BUTTON_KEYWORDS = /\b(send|submit|run)\b/i;
const NEGATIVE_BUTTON_KEYWORDS = /\b(voice|microphone|mic|stop|cancel)\b/i;

function toLowerText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

function isVisible(element: HTMLElement): boolean {
  let display = '';
  let visibility = '';

  try {
    const computed = window.getComputedStyle(element);
    display = computed.display;
    visibility = computed.visibility;
  } catch {
    // Ignore style lookup failures in synthetic test environments.
  }

  if (display === 'none' || visibility === 'hidden') {
    return false;
  }

  return element.offsetParent !== null || display !== 'none';
}

function isDisabled(button: HTMLButtonElement): boolean {
  if (button.disabled) {
    return true;
  }

  if (button.getAttribute('disabled') !== null) {
    return true;
  }

  if (toLowerText(button.getAttribute('aria-disabled')) === 'true') {
    return true;
  }

  return false;
}

function collectSignals(button: HTMLButtonElement): string {
  const className = typeof button.className === 'string' ? button.className : '';

  return [
    button.getAttribute('aria-label'),
    button.getAttribute('data-testid'),
    button.getAttribute('title'),
    button.id,
    className,
    button.textContent,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .toLowerCase();
}

function scoreButton(button: HTMLButtonElement): number {
  if (!isVisible(button)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (isDisabled(button)) {
    return Number.NEGATIVE_INFINITY;
  }

  const signals = collectSignals(button);
  const hasPositiveSignal = POSITIVE_BUTTON_KEYWORDS.test(signals);
  const hasNegativeSignal = NEGATIVE_BUTTON_KEYWORDS.test(signals);

  if (hasNegativeSignal && !hasPositiveSignal) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (hasPositiveSignal) {
    score += 10;
  }

  if (button.type === 'submit') {
    score += 4;
  }

  const dataTestId = toLowerText(button.getAttribute('data-testid'));
  if (dataTestId.includes('send') || dataTestId.includes('submit') || dataTestId.includes('run')) {
    score += 6;
  }

  const ariaLabel = toLowerText(button.getAttribute('aria-label'));
  if (ariaLabel.includes('send') || ariaLabel.includes('submit') || ariaLabel.includes('run')) {
    score += 6;
  }

  if (hasNegativeSignal) {
    score -= 2;
  }

  if (!hasPositiveSignal && !hasNegativeSignal) {
    score += 1;
  }

  return score;
}

function toButton(element: HTMLElement): HTMLButtonElement | null {
  if (element.tagName !== 'BUTTON') {
    return null;
  }
  return element as HTMLButtonElement;
}

export function pickSendableSubmitButton(candidates: HTMLButtonElement[]): HTMLButtonElement | null {
  let selected: HTMLButtonElement | null = null;
  let selectedScore = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    const score = scoreButton(candidate);
    if (score > selectedScore) {
      selected = candidate;
      selectedScore = score;
    }
  }

  if (selectedScore === Number.NEGATIVE_INFINITY) {
    return null;
  }

  return selected;
}

export function findSendableSubmitButton(submitSelectors: string[]): HTMLButtonElement | null {
  const candidates = findAllElements(submitSelectors)
    .map((element) => toButton(element))
    .filter((button): button is HTMLButtonElement => button !== null);

  return pickSendableSubmitButton(candidates);
}
