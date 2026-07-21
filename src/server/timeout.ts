export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Bound a promise that may never settle.
 *
 * Puppeteer's `goto` and `waitForSelector` take their own timeouts, but the raw
 * CDP calls around them (newPage, evaluate, close) take none. If Chrome is alive
 * but unresponsive — the usual failure mode on a memory-starved instance — those
 * hang forever and take the whole scrape cycle with them.
 *
 * The underlying promise keeps running when the timeout wins; it is only
 * detached, so callers must assume its result is gone and clean up separately.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  // Whoever loses the race must not surface later as an unhandled rejection
  promise.catch(() => {});

  let timer: NodeJS.Timeout;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} exceeded ${ms}ms`)),
      ms,
    );
  });

  return Promise.race([promise, expiry]).finally(() => clearTimeout(timer));
}
