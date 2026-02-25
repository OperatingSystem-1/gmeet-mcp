import { logger } from "./logger.js";

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) break;

      const wait = delayMs * Math.pow(backoffMultiplier, attempt - 1);
      logger.warn(`Retry attempt ${attempt}/${maxAttempts} failed, waiting ${wait}ms`, {
        error: lastError.message,
      });

      onRetry?.(lastError, attempt);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw lastError;
}
