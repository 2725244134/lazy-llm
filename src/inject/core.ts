import { reportFrontendError, toErrorMessage } from './error';

export function findElement(selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        if (element.offsetParent !== null || window.getComputedStyle(element).display !== 'none') {
          return element;
        }
      }
    } catch (error) {
      reportFrontendError(
        'inject.findElement',
        `Selector failed (${selector}): ${toErrorMessage(error)}`,
        'inject'
      );
    }
  }

  return null;
}

export function triggerEvents(element: HTMLElement): void {
  const events = [
    new Event('input', { bubbles: true, cancelable: true }),
    new Event('change', { bubbles: true, cancelable: true }),
    new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' }),
  ];

  for (const event of events) {
    element.dispatchEvent(event);
  }
}

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(element, 'value');
  const prototype = Object.getPrototypeOf(element);
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

  if (prototypeDescriptor?.set && descriptor?.set !== prototypeDescriptor.set) {
    prototypeDescriptor.set.call(element, value);
  } else if (descriptor?.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
}

function handleLexicalEditor(element: HTMLElement, text: string): void {
  element.focus();

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);

  const inserted = document.execCommand('insertText', false, text);
  if (inserted) {
    return;
  }

  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  const paragraph = document.createElement('p');
  paragraph.className = 'relative';
  const span = document.createElement('span');
  span.setAttribute('data-lexical-text', 'true');
  span.textContent = text;
  paragraph.appendChild(span);
  element.appendChild(paragraph);
  triggerEvents(element);
}

function handleQuillEditor(element: HTMLElement, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  element.appendChild(paragraph);
  triggerEvents(element);

  const richTextarea = element.closest('rich-textarea');
  if (richTextarea) {
    triggerEvents(richTextarea as HTMLElement);
  }
}

function handleContentEditable(element: HTMLElement, text: string): void {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  element.appendChild(document.createTextNode(text));
  triggerEvents(element);

  try {
    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } catch (error) {
    reportFrontendError(
      'inject.handleContentEditable',
      `Failed to set cursor: ${toErrorMessage(error)}`,
      'inject'
    );
  }
}

export function injectText(element: HTMLElement, text: string): boolean {
  element.focus();

  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    setNativeValue(element as HTMLInputElement | HTMLTextAreaElement, text);
    triggerEvents(element);
    return true;
  }

  if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
    const isLexical = element.getAttribute('data-lexical-editor') === 'true';
    const isQuill = element.classList.contains('ql-editor') || element.closest('rich-textarea') !== null;

    if (isLexical) {
      handleLexicalEditor(element, text);
    } else if (isQuill) {
      handleQuillEditor(element, text);
    } else {
      handleContentEditable(element, text);
    }

    return true;
  }

  return false;
}

export function findAllElements(selectors: string[]): HTMLElement[] {
  const results: HTMLElement[] = [];

  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll<HTMLElement>(selector);
      for (const element of elements) {
        if (!results.includes(element)) {
          results.push(element);
        }
      }
    } catch (error) {
      reportFrontendError(
        'inject.findAllElements',
        `Selector failed (${selector}): ${toErrorMessage(error)}`,
        'inject'
      );
    }
  }

  return results;
}

export function isStreaming(indicatorSelectors: string[]): boolean {
  if (!indicatorSelectors || indicatorSelectors.length === 0) {
    return false;
  }

  for (const selector of indicatorSelectors) {
    try {
      if (document.querySelector(selector)) {
        return true;
      }
    } catch (error) {
      reportFrontendError(
        'inject.isStreaming',
        `Streaming indicator selector failed (${selector}): ${toErrorMessage(error)}`,
        'inject'
      );
    }
  }

  return false;
}

export function isComplete(streamingIndicators: string[], completeIndicators: string[]): boolean {
  if (isStreaming(streamingIndicators)) {
    return false;
  }

  if (completeIndicators && completeIndicators.length > 0) {
    for (const selector of completeIndicators) {
      try {
        if (document.querySelector(selector)) {
          return true;
        }
      } catch (error) {
        reportFrontendError(
          'inject.isComplete',
          `Complete indicator selector failed (${selector}): ${toErrorMessage(error)}`,
          'inject'
        );
      }
    }

    return false;
  }

  return true;
}

function extractTextFromElement(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  clone.querySelectorAll('script, style').forEach((node) => node.remove());

  clone.querySelectorAll('pre code').forEach((code) => {
    const text = code.textContent || '';
    code.textContent = `\n\`\`\`\n${text}\n\`\`\`\n`;
  });

  clone.querySelectorAll('code:not(pre code)').forEach((code) => {
    const text = code.textContent || '';
    code.textContent = `\`${text}\``;
  });

  let text = clone.innerText || clone.textContent || '';
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

export function extractLastResponse(responseSelectors: string[]): string | null {
  const elements = findAllElements(responseSelectors);
  if (elements.length === 0) {
    return null;
  }

  return extractTextFromElement(elements[elements.length - 1]);
}

export function extractAllResponses(responseSelectors: string[]): string[] {
  const elements = findAllElements(responseSelectors);
  return elements.map((element) => extractTextFromElement(element));
}
