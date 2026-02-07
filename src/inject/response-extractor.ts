import { findAllElements } from './dom-query';

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
