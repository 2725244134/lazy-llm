export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return String(error);
}

export function reportFrontendError(scope: string, message: string, source: string): void {
  console.error(`[${source}] ${scope}: ${message}`);
}
